import { create } from "zustand";
import { startRingtone } from "./ringtone";

export type CallKind = "audio" | "video";
export type CallPhase = "ring" | "live";

type CallState = {
  active: boolean;
  peerId: string;
  peerName: string;
  peerPhoto: string;
  kind: CallKind;
  phase: CallPhase;
  minimized: boolean;
  muted: boolean;
  camOff: boolean;
  speaker: boolean;
  startedAt: number | null;
  start: (input: {
    peerId: string;
    peerName?: string;
    peerPhoto?: string;
    kind: CallKind;
  }) => void;
  answer: () => void;
  minimize: () => void;
  expand: () => void;
  hang: () => void;
  setMuted: (v: boolean) => void;
  setCamOff: (v: boolean) => void;
  setSpeaker: (v: boolean) => void;
};

let stopRing: (() => void) | null = null;

export const useCallStore = create<CallState>((set) => ({
  active: false,
  peerId: "",
  peerName: "",
  peerPhoto: "",
  kind: "audio",
  phase: "ring",
  minimized: false,
  muted: false,
  camOff: false,
  speaker: true,
  startedAt: null,
  start: (input) => {
    stopRing?.();
    stopRing = startRingtone();
    set({
      active: true,
      peerId: input.peerId,
      peerName: input.peerName || "شخص",
      peerPhoto: input.peerPhoto || "",
      kind: input.kind,
      phase: "ring",
      minimized: false,
      muted: false,
      camOff: input.kind !== "video",
      speaker: true,
      startedAt: null,
    });
  },
  answer: () => {
    stopRing?.();
    stopRing = null;
    set({ phase: "live", startedAt: Date.now() });
  },
  minimize: () => set({ minimized: true }),
  expand: () => set({ minimized: false }),
  hang: () => {
    stopRing?.();
    stopRing = null;
    set({ active: false, phase: "ring", minimized: false, startedAt: null, peerId: "" });
  },
  setMuted: (v) => set({ muted: v }),
  setCamOff: (v) => set({ camOff: v }),
  setSpeaker: (v) => set({ speaker: v }),
}));

export function startCall(input: {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  kind: CallKind;
}) {
  useCallStore.getState().start(input);
}

export function callDurationSec(): number {
  const t = useCallStore.getState().startedAt;
  if (!t) return 0;
  return Math.max(1, Math.round((Date.now() - t) / 1000));
}
