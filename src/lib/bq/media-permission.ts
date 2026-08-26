/** Camera/mic helpers — progressive fallbacks for picky Android browsers. */

export type MediaPermResult =
  | { ok: true; stream: MediaStream; hasVideo: boolean }
  | { ok: false; reason: "denied" | "unavailable" | "secure" | "busy" };

function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost";
}

export async function queryMediaPermission(
  name: "camera" | "microphone",
): Promise<PermissionState | "unsupported"> {
  try {
    if (!navigator.permissions?.query) return "unsupported";
    const r = await navigator.permissions.query({ name: name as PermissionName });
    return r.state;
  } catch {
    return "unsupported";
  }
}

async function tryGet(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  stream.getTracks().forEach((t) => {
    t.enabled = true;
  });
  return stream;
}

/**
 * Request mic (+ camera if video). Must run under a user gesture on mobile.
 */
export async function requestCallMedia(video: boolean): Promise<MediaPermResult> {
  if (!isSecureContext()) return { ok: false, reason: "secure" };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "unavailable" };

  // Warm up device list after permission (helps some Android builds pick a camera).
  let frontId: string | undefined;
  let anyVideoId: string | undefined;
  try {
    // Trigger permission + labels
    const warm = await tryGet(video ? { audio: true, video: true } : { audio: true, video: false });
    const hasVideo = warm.getVideoTracks().length > 0;
    if (hasVideo || !video) {
      return { ok: true, stream: warm, hasVideo };
    }
    // Got audio only despite video:true — stop and try deviceId path
    warm.getTracks().forEach((t) => t.stop());
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return { ok: false, reason: "denied" };
    }
    if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
      return { ok: false, reason: "busy" };
    }
    // continue with other attempts
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const d of devices) {
      if (d.kind !== "videoinput") continue;
      if (!anyVideoId) anyVideoId = d.deviceId;
      const label = (d.label || "").toLowerCase();
      if (label.includes("front") || label.includes("user") || label.includes("facing")) {
        frontId = d.deviceId;
      }
    }
  } catch {
    /* ignore */
  }

  const attempts: MediaStreamConstraints[] = [];
  if (video) {
    if (frontId) attempts.push({ audio: true, video: { deviceId: { exact: frontId } } });
    if (anyVideoId && anyVideoId !== frontId) {
      attempts.push({ audio: true, video: { deviceId: { exact: anyVideoId } } });
    }
    attempts.push({ audio: true, video: { facingMode: { ideal: "user" } } });
    attempts.push({ audio: true, video: true });
    attempts.push({ audio: true, video: { facingMode: "environment" } });
    // last resort: audio only
    attempts.push({ audio: true, video: false });
  } else {
    attempts.push({ audio: true, video: false });
  }

  let lastName = "";
  for (const constraints of attempts) {
    try {
      const stream = await tryGet(constraints);
      const hasVideo = stream.getVideoTracks().length > 0;
      return { ok: true, stream, hasVideo };
    } catch (err) {
      lastName = err instanceof DOMException ? err.name : String(err);
      if (lastName === "NotAllowedError" || lastName === "PermissionDeniedError") {
        return { ok: false, reason: "denied" };
      }
      if (lastName === "SecurityError") return { ok: false, reason: "denied" };
      if (lastName === "NotReadableError" || lastName === "TrackStartError") {
        return { ok: false, reason: "busy" };
      }
    }
  }

  if (lastName === "NotFoundError" || lastName === "DevicesNotFoundError") {
    return { ok: false, reason: "unavailable" };
  }
  return { ok: false, reason: "unavailable" };
}

export function mediaErrorMessage(
  reason: "denied" | "unavailable" | "secure" | "busy",
): string {
  if (reason === "secure") return "لازم التطبيق يشتغل على رابط آمن (https)";
  if (reason === "busy") return "الكاميرا مستخدمة من تطبيق تاني — اقفلها هناك وحاول تاني";
  if (reason === "unavailable")
    return "تعذر فتح الكاميرا — جرّب زر التفعيل، أو أعد تشغيل الجوال";
  return "الأذن مرفوضة — فعّل الكاميرا والميكروفون من إعدادات الموقع";
}

export const MEDIA_SETTINGS_HINT =
  "لو الأذن مسموحة والشاشة سودة: اقفل كاميرا أي تطبيق تاني، أو أعد تشغيل الجوال، وبعدين اضغط «تفعيل الكاميرا».";
