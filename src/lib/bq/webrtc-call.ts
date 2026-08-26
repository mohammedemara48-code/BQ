import { defaultIceServers } from "@/lib/multiplayer/p2p";

export type SignalKind = "offer" | "answer" | "ice";

export class MediaCall {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remote: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private offering = false;
  private closed = false;
  private queue: Promise<void> = Promise.resolve();
  /** When true, close() must not stop local tracks (ownership transferred elsewhere). */
  private keepLocalTracks = false;
  onLocalStream: ((s: MediaStream) => void) | null = null;
  onRemoteStream: ((s: MediaStream) => void) | null = null;
  onSignal: ((kind: SignalKind, payload: unknown) => void) | null = null;

  get ready() {
    return this.pc !== null && !this.closed;
  }

  get remoteStream() {
    return this.remote;
  }

  get localStream() {
    return this.local;
  }

  get hasLocalVideo() {
    return (this.local?.getVideoTracks().filter((t) => t.readyState === "live").length ?? 0) > 0;
  }

  get hasRemoteVideo() {
    return (this.remote?.getVideoTracks().filter((t) => t.readyState === "live").length ?? 0) > 0;
  }

  static async acquire(video: boolean): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = video
      ? [
          { audio: true, video: true },
          { audio: true, video: { facingMode: "user" } },
          { audio: true, video: false },
        ]
      : [{ audio: true, video: false }];
    let last: unknown;
    for (const c of attempts) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        s.getTracks().forEach((t) => {
          t.enabled = true;
        });
        return s;
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error("getUserMedia failed");
  }

  async open(video: boolean, existing?: MediaStream | null) {
    // Close previous PC but keep tracks if we are about to reuse `existing`
    this.keepLocalTracks = Boolean(existing);
    this.close();
    this.keepLocalTracks = false;
    this.closed = false;
    this.pc = new RTCPeerConnection({ iceServers: defaultIceServers() });
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && !this.closed) {
        this.onSignal?.("ice", ev.candidate.toJSON());
      }
    };
    this.pc.ontrack = (ev) => {
      if (this.closed) return;
      if (!this.remote) this.remote = new MediaStream();
      // Always add the fired track; also merge any stream tracks
      if (!this.remote.getTracks().some((t) => t.id === ev.track.id)) {
        this.remote.addTrack(ev.track);
      }
      if (ev.streams[0]) {
        for (const track of ev.streams[0].getTracks()) {
          if (!this.remote.getTracks().some((t) => t.id === track.id)) {
            this.remote.addTrack(track);
          }
        }
      }
      this.onRemoteStream?.(this.remote);
    };
    this.pc.onconnectionstatechange = () => {
      if (!this.pc || this.closed) return;
      if (this.pc.connectionState === "failed") {
        try {
          void this.pc.restartIce();
        } catch {
          /* ignore */
        }
      }
    };

    if (existing && existing.getTracks().some((t) => t.readyState === "live")) {
      this.local = existing;
    } else {
      this.local = await MediaCall.acquire(video);
    }
    if (this.closed) {
      this.local.getTracks().forEach((t) => t.stop());
      this.local = null;
      return;
    }
    this.local.getTracks().forEach((t) => {
      t.enabled = true;
      this.pc!.addTrack(t, this.local!);
    });
    this.onLocalStream?.(this.local);
  }

  async offer() {
    if (!this.pc || this.offering || this.closed) return;
    if (this.pc.signalingState !== "stable") return;
    this.offering = true;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      if (this.closed || !this.pc) return;
      await this.pc.setLocalDescription(offer);
      this.onSignal?.("offer", this.pc.localDescription);
    } finally {
      this.offering = false;
    }
  }

  async handle(kind: string, payload: unknown) {
    this.queue = this.queue.then(() => this.handleOne(kind, payload)).catch(() => undefined);
    await this.queue;
  }

  private async handleOne(kind: string, payload: unknown) {
    if (!this.pc || this.closed) return;
    try {
      if (kind === "offer") {
        const desc = payload as RTCSessionDescriptionInit;
        const state = this.pc.signalingState;
        if (state !== "stable" && state !== "have-local-offer") return;
        if (state === "have-local-offer") {
          await this.pc.setLocalDescription({ type: "rollback" });
        }
        await this.pc.setRemoteDescription(desc);
        this.remoteSet = true;
        await this.flushIce();
        const answer = await this.pc.createAnswer();
        if (this.closed || !this.pc) return;
        await this.pc.setLocalDescription(answer);
        this.onSignal?.("answer", this.pc.localDescription);
      } else if (kind === "answer") {
        if (this.pc.signalingState !== "have-local-offer") return;
        await this.pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        this.remoteSet = true;
        await this.flushIce();
      } else if (kind === "ice") {
        const c = payload as RTCIceCandidateInit;
        if (!c) return;
        if (this.remoteSet) {
          try {
            await this.pc.addIceCandidate(c);
          } catch {
            /* stale */
          }
        } else {
          this.pendingIce.push(c);
        }
      }
    } catch {
      /* glare / late ice */
    }
  }

  private async flushIce() {
    if (!this.pc || this.closed) return;
    for (const c of this.pendingIce) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* stale */
      }
    }
    this.pendingIce = [];
  }

  setMuted(v: boolean) {
    this.local?.getAudioTracks().forEach((t) => {
      t.enabled = !v;
    });
  }

  setCamOff(v: boolean) {
    this.local?.getVideoTracks().forEach((t) => {
      t.enabled = !v;
    });
  }

  close() {
    this.closed = true;
    if (!this.keepLocalTracks) {
      this.local?.getTracks().forEach((t) => t.stop());
    }
    // Never stop remote tracks we don't own exclusively — just detach
    this.remote?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.local = null;
    this.remote = null;
    this.pendingIce = [];
    this.remoteSet = false;
    this.offering = false;
  }
}
