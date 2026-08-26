/** Helpers for camera/mic permission on mobile browsers (especially Android Chrome). */

export type MediaPermResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: "denied" | "unavailable" | "secure" };

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

/**
 * Request mic (+ camera if video). Must be called from a user gesture on mobile.
 * Returns a live MediaStream on success.
 */
export async function requestCallMedia(video: boolean): Promise<MediaPermResult> {
  if (!isSecureContext()) {
    return { ok: false, reason: "secure" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unavailable" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video
        ? {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          }
        : false,
    });
    return { ok: true, stream };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, reason: "denied" };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { ok: false, reason: "unavailable" };
    }
    // Some Android builds throw SecurityError when blocked
    if (name === "SecurityError") {
      return { ok: false, reason: "denied" };
    }
    return { ok: false, reason: "unavailable" };
  }
}

export function mediaErrorMessage(reason: "denied" | "unavailable" | "secure"): string {
  if (reason === "secure") {
    return "لازم التطبيق يشتغل على رابط آمن (https)";
  }
  if (reason === "unavailable") {
    return "مفيش كاميرا أو ميكروفون على الجهاز";
  }
  return "الأذن مرفوضة — لازم تفعّل الكاميرا والميكروفون من إعدادات الموقع";
}

/** Short Arabic steps for Android Chrome site settings. */
export const MEDIA_SETTINGS_HINT =
  "من إعدادات الموقع فوق ← الأذونات ← فعّل الكاميرا والميكروفون. لو مش ظاهرين: اضغط «حذف البيانات وإعادة ضبط الأذونات» بعدين افتح التطبيق تاني واضغط السماح.";
