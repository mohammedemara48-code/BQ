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
  if (cur.active) {
    useCallStore.getState().hang();
  }

  const media = await requestCallMedia(input.kind === "video");
  if (!media.ok) {
    toast.error(mediaErrorMessage(media.reason));
    return false;
  }

  startCall({
    peerId: input.peerId,
    peerName: input.peerName,
    peerPhoto: input.peerPhoto,
    kind: input.kind,
    role: "out",
  });
  // If video requested but only audio granted, keep kind as video UI but cam may be off
  if (input.kind === "video" && !media.hasVideo) {
    useCallStore.getState().setCamOff(true);
  }
  useCallStore.getState().setPreStream(media.stream);

  try {
    const res = await Promise.race([
      placeCall({ data: { peerId: input.peerId, kind: input.kind } }),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("timeout")), 12_000);
      }),
    ]);
    if (!res.ok) {
      media.stream.getTracks().forEach((t) => t.stop());
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
    media.stream.getTracks().forEach((t) => t.stop());
    useCallStore.getState().hang();
    toast.error("تعذر بدء المكالمة — حاول تاني");
    return false;
  }
}
