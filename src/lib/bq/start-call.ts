import { toast } from "sonner";
import { placeCall } from "./call-live";
import { startCall, useCallStore, type CallKind } from "./call-store";

export async function beginOutgoingCall(input: {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  kind: CallKind;
}): Promise<boolean> {
  const cur = useCallStore.getState();
  if (cur.active) return false;
  startCall({
    peerId: input.peerId,
    peerName: input.peerName,
    peerPhoto: input.peerPhoto,
    kind: input.kind,
    role: "out",
  });
  try {
    const res = await placeCall({ data: { peerId: input.peerId, kind: input.kind } });
    if (!res.ok) {
      useCallStore.getState().hang();
      toast.error(
        res.reason === "busy"
          ? "الشخص في مكالمة تانية"
          : res.reason === "blocked"
            ? "لا يمكن الاتصال"
            : "تعذر بدء المكالمة",
      );
      return false;
    }
    useCallStore.getState().setCallId(res.id);
    return true;
  } catch {
    useCallStore.getState().hang();
    toast.error("تعذر بدء المكالمة");
    return false;
  }
}
