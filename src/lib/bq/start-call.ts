import { toast } from "sonner";
import { placeCall } from "./call-live";
import { startCall, useCallStore, type CallKind } from "./call-store";
import { MediaCall } from "./webrtc-call";

export async function beginOutgoingCall(input: {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  kind: CallKind;
}): Promise<boolean> {
  const cur = useCallStore.getState();
  if (cur.active) return false;

  // Open camera/mic under the user gesture (required on mobile browsers).
  let stream: MediaStream | null = null;
  try {
    stream = await MediaCall.acquire(input.kind === "video");
  } catch {
    toast.error("اسمح للميكروفون والكاميرا من إعدادات المتصفح");
    return false;
  }

  startCall({
    peerId: input.peerId,
    peerName: input.peerName,
    peerPhoto: input.peerPhoto,
    kind: input.kind,
    role: "out",
    preStream: stream,
  });
  try {
    const res = await placeCall({ data: { peerId: input.peerId, kind: input.kind } });
    if (!res.ok) {
      useCallStore.getState().hang();
      stream.getTracks().forEach((t) => t.stop());
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
    stream.getTracks().forEach((t) => t.stop());
    toast.error("تعذر بدء المكالمة");
    return false;
  }
}
