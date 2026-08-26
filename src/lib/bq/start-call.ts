import { toast } from "sonner";
import { placeCall } from "./call-live";
import { startCall, useCallStore, type CallKind } from "./call-store";
import { mediaErrorMessage, requestCallMedia } from "./media-permission";

export async function beginOutgoingCall(input: {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  kind: CallKind;
}): Promise<boolean> {
  const cur = useCallStore.getState();
  if (cur.active) return false;

  // Open camera/mic under the user gesture (required on mobile browsers).
  const media = await requestCallMedia(input.kind === "video");
  if (!media.ok) {
    toast.error(mediaErrorMessage(media.reason), {
      duration: 6000,
      description:
        media.reason === "denied"
          ? "من إعدادات الموقع فعّل الكاميرا والميكروفون، أو امسح بيانات الموقع وافتح التطبيق تاني"
          : undefined,
    });
    return false;
  }

  startCall({
    peerId: input.peerId,
    peerName: input.peerName,
    peerPhoto: input.peerPhoto,
    kind: input.kind,
    role: "out",
    preStream: media.stream,
  });
  try {
    const res = await placeCall({ data: { peerId: input.peerId, kind: input.kind } });
    if (!res.ok) {
      useCallStore.getState().hang();
      media.stream.getTracks().forEach((t) => t.stop());
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
    media.stream.getTracks().forEach((t) => t.stop());
    toast.error("تعذر بدء المكالمة");
    return false;
  }
}
