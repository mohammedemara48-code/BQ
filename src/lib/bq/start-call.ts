import { toast } from "sonner";
import { placeCall } from "./call-live";
import { startCall, useCallStore, type CallKind } from "./call-store";

async function acquireMedia(video: boolean): Promise<MediaStream> {
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
      const stream = await navigator.mediaDevices.getUserMedia(c);
      stream.getTracks().forEach((t) => {
        t.enabled = true;
      });
      return stream;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("getUserMedia failed");
}

export async function beginOutgoingCall(input: {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  kind: CallKind;
}): Promise<boolean> {
  const cur = useCallStore.getState();
  if (cur.active) return false;
  let stream: MediaStream | null = null;
  try {
    stream = await acquireMedia(input.kind === "video");
  } catch {
    toast.error("اسمح للميكروفون والكاميرا من الإعدادات");
    return false;
  }
  startCall({
    peerId: input.peerId,
    peerName: input.peerName,
    peerPhoto: input.peerPhoto,
    kind: input.kind,
    role: "out",
  });
  useCallStore.getState().setPreStream(stream);
  try {
    const res = await placeCall({ data: { peerId: input.peerId, kind: input.kind } });
    if (!res.ok) {
      stream.getTracks().forEach((t) => t.stop());
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
    stream.getTracks().forEach((t) => t.stop());
    useCallStore.getState().hang();
    toast.error("تعذر بدء المكالمة");
    return false;
  }
}
