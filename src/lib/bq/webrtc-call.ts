import { defaultIceServers } from "@/lib/multiplayer/p2p";

export type SignalKind = "offer" | "answer" | "ice";

export class MediaCall {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  onLocalStream: ((s: MediaStream) => void) | null = null;
  onRemoteStream: ((s: MediaStream) => void) | null = null;
  onSignal: ((kind: SignalKind, payload: unknown) => void) | null = null;

  get ready() {
    return this.pc !== null;
  }

  async open(video: boolean) {
    this.close();
    this.pc = new RTCPeerConnection({ iceServers: defaultIceServers() });
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.onSignal?.("ice", ev.candidate.toJSON());
    };
    this.pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.onRemoteStream?.(stream);
    };
    this.local = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video ? { facingMode: "user" } : false,
    });
    this.local.getTracks().forEach((t) => this.pc!.addTrack(t, this.local!));
    this.onLocalStream?.(this.local);
  }

  async offer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.onSignal?.("offer", this.pc.localDescription);
  }

  async handle(kind: string, payload: unknown) {
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

  close() {
    this.local?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.local = null;
    this.pendingIce = [];
    this.remoteSet = false;
  }
}
