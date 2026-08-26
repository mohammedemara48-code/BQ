import { create } from "zustand";
import { startRingtone } from "./ringtone";

export type CallKind = "audio" | "video";
export type CallPhase = "ring" | "live";
export type CallRole = "out" | "in";

type CallState = {
  active: boolean;
  callId: number | null;
  peerId: string;
  peerName: string;
  peerPhoto: string;
  kind: CallKind;
  role: CallRole;
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
    role?: CallRole;
    callId?: number | null;
  }) => void;
  incoming: (input: {
    callId: number;
    peerId: string;
    peerName?: string;
    peerPhoto?: string;
    kind: CallKind;
  }) => void;
  setCallId: (id: number) => void;
  answer: () => void;
  minimize: () => void;
  expand: () => void;
  hang: () => void;
  setMuted: (v: boolean) => void;
  setCamOff: (v: boolean) => void;
  setSpeaker: (v: boolean) => void;
};

let stopRing: (() => void) | null = null;

function ringOn() {
  stopRing?.();
  stopRing = startRingtone();
}

function ringOff() {
  stopRing?.();
  stopRing = null;
}

export const useCallStore = create<CallState>((set, get) => ({
  active: false,
  callId: null,
  peerId: "",
  peerName: "",
  peerPhoto: "",
  kind: "audio",
  role: "out",
  phase: "ring",
  minimized: false,
  muted: false,
  camOff: false,
  speaker: true,
  startedAt: null,
  start: (input) => {
    ringOn();
    set({
      active: true,
      callId: input.callId ?? null,
      peerId: input.peerId,
      peerName: input.peerName || "شخص",
      peerPhoto: input.peerPhoto || "",
      kind: input.kind,
      role: input.role || "out",
      phase: "ring",
      minimized: false,
      muted: false,
      camOff: input.kind !== "video",
      speaker: true,
      startedAt: null,
    });
  },
  incoming: (input) => {
    const cur = get();
    if (cur.active && cur.callId === input.callId) return;
    if (cur.active) return;
    ringOn();
    try {
      navigator.vibrate?.([400, 180, 400, 180, 400]);
    } catch {
      /* ignore */
    }
    set({
      active: true,
      callId: input.callId,
      peerId: input.peerId,
      peerName: input.peerName || "شخص",
      peerPhoto: input.peerPhoto || "",
      kind: input.kind,
      role: "in",
      phase: "ring",
      minimized: false,
      muted: false,
      camOff: input.kind !== "video",
      speaker: true,
      startedAt: null,
    });
  },
  setCallId: (id) => set({ callId: id }),
  answer: () => {
    ringOff();
    set({ phase: "live", startedAt: Date.now(), minimized: false });
  },
  minimize: () => set({ minimized: true }),
  expand: () => set({ minimized: false }),
  hang: () => {
    ringOff();
    set({
      active: false,
      callId: null,
      phase: "ring",
      minimized: false,
      startedAt: null,
      peerId: "",
    });
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
  role?: CallRole;
  callId?: number | null;
}) {
  useCallStore.getState().start(input);
}

export function callDurationSec(): number {
  const t = useCallStore.getState().startedAt;
  if (!t) return 0;
  return Math.max(1, Math.round((Date.now() - t) / 1000));
}
