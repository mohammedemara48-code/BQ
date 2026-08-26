import { create } from "zustand";
import { startRingtone } from "./ringtone";

export type CallKind = "audio" | "video";
export type CallPhase = "ring" | "live";
export type CallRole = "out" | "in";

const ENDED_KEY = "bq-ended-calls";

export const endedCallIds = new Set<number>();

function persistEnded() {
  try {
    sessionStorage.setItem(ENDED_KEY, JSON.stringify([...endedCallIds].slice(-50)));
  } catch {
    /* ignore */
  }
}

export function hydrateEnded() {
  try {
    const raw = sessionStorage.getItem(ENDED_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as number[];
    if (Array.isArray(arr)) for (const id of arr) endedCallIds.add(id);
  } catch {
    /* ignore */
  }
}

export function markCallEnded(id: number | null | undefined) {
  if (!id) return;
  endedCallIds.add(id);
  persistEnded();
}

export function wasCallEnded(id: number) {
  return endedCallIds.has(id);
}

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
  preStream: MediaStream | null;
  /** Block incoming UI after hang so a stale ringing row cannot reopen. */
  ignoreIncoming: boolean;
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
  setPreStream: (s: MediaStream | null) => void;
  setIgnoreIncoming: (v: boolean) => void;
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

hydrateEnded();

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
  preStream: null,
  ignoreIncoming: false,
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
      ignoreIncoming: false,
    });
  },
  incoming: (input) => {
    const cur = get();
    if (wasCallEnded(input.callId)) return;
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
    const id = get().callId;
    markCallEnded(id);
    const stream = get().preStream;
    stream?.getTracks().forEach((t) => t.stop());
    set({
      active: false,
      callId: null,
      phase: "ring",
      minimized: false,
      startedAt: null,
      peerId: "",
      preStream: null,
      ignoreIncoming: true,
    });
  },
  setMuted: (v) => set({ muted: v }),
  setCamOff: (v) => set({ camOff: v }),
  setSpeaker: (v) => set({ speaker: v }),
  setPreStream: (s) => set({ preStream: s }),
  setIgnoreIncoming: (v) => set({ ignoreIncoming: v }),
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
