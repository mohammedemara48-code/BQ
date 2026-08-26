import { defaultIceServers } from "@/lib/multiplayer/p2p";

export type SignalKind = "offer" | "answer" | "ice";

export class MediaCall {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remote = new MediaStream();
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private queue: Promise<void> = Promise.resolve();
  onLocalStream: ((s: MediaStream) => void) | null = null;
  onRemoteStream: ((s: MediaStream) => void) | null = null;
  onSignal: ((kind: SignalKind, payload: unknown) => void) | null = null;

  get ready() {
    return this.pc !== null;
  }

  async open(video: boolean, existing?: MediaStream | null) {
    // Tear down the old PC without stopping tracks we may reuse.
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.pendingIce = [];
    this.remoteSet = false;
    this.remote = new MediaStream();
    this.pc = new RTCPeerConnection({ iceServers: defaultIceServers() });
    this.remote = new MediaStream();
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.onSignal?.("ice", ev.candidate.toJSON());
    };
    this.pc.ontrack = (ev) => {
      const track = ev.track;
      if (!this.remote.getTracks().some((t) => t.id === track.id)) {
        this.remote.addTrack(track);
      }
      this.onRemoteStream?.(this.remote);
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "failed") {
        try {
          this.pc.restartIce();
        } catch {
          /* ignore */
        }
      }
    };
    if (existing && existing.getTracks().some((t) => t.readyState === "live")) {
      this.local = existing;
    } else {
      try {
        this.local = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: Boolean(video),
        });
      } catch {
        this.local = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
    }
    this.local.getTracks().forEach((t) => {
      t.enabled = true;
      this.pc!.addTrack(t, this.local!);
    });
    this.onLocalStream?.(this.local);
  }

  async offer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    this.onSignal?.("offer", this.pc.localDescription);
  }

  handle(kind: string, payload: unknown) {
    this.queue = this.queue.then(() => this.handleOne(kind, payload)).catch(() => undefined);
    return this.queue;
  }

  private async handleOne(kind: string, payload: unknown) {
    if (!this.pc) return;
    try {
      if (kind === "offer") {
        const desc = payload as RTCSessionDescriptionInit;
        await this.pc.setRemoteDescription(desc);
        this.remoteSet = true;
        await this.flushIce();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.onSignal?.("answer", this.pc.localDescription);
      } else if (kind === "answer") {
        if (this.pc.signalingState !== "have-local-offer") return;
        await this.pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        this.remoteSet = true;
        await this.flushIce();
      } else if (kind === "ice") {
        const c = payload as RTCIceCandidateInit;
        if (!c?.candidate && c?.candidate !== "") return;
        if (this.remoteSet) {
          await this.pc.addIceCandidate(c);
        } else {
          this.pendingIce.push(c);
        }
      }
    } catch {
      /* glare / late ice */
    }
  }

  private async flushIce() {
    if (!this.pc) return;
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

  restartIce() {
    try {
      this.pc?.restartIce();
    } catch {
      /* ignore */
    }
  }

  close(opts?: { stopLocal?: boolean }) {
    const stopLocal = opts?.stopLocal !== false;
    if (stopLocal) {
      this.local?.getTracks().forEach((t) => t.stop());
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.local = null;
    this.pendingIce = [];
    this.remoteSet = false;
    this.remote = new MediaStream();
  }
}
