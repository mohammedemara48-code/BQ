/** Camera/mic helpers — progressive fallbacks for picky Android browsers. */

export type MediaPermResult =
  | { ok: true; stream: MediaStream }
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

/**
 * Request mic (+ camera if video). Must run under a user gesture on mobile.
 * Tries several constraint sets because many Android devices reject ideal width/facingMode.
 */
export async function requestCallMedia(video: boolean): Promise<MediaPermResult> {
  if (!isSecureContext()) return { ok: false, reason: "secure" };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "unavailable" };

  const attempts: MediaStreamConstraints[] = video
    ? [
        // 1) simple boolean — works on most Android Chrome builds
        { audio: true, video: true },
        // 2) facingMode only
        { audio: true, video: { facingMode: "user" } },
        // 3) facingMode environment (some devices invert)
        { audio: true, video: { facingMode: "environment" } },
        // 4) audio only as last resort so the call can still connect
        { audio: true, video: false },
      ]
    : [
        { audio: true, video: false },
        { audio: { echoCancellation: true, noiseSuppression: true }, video: false },
      ];

  let lastName = "";
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Ensure tracks are live and enabled
      stream.getTracks().forEach((t) => {
        t.enabled = true;
      });
      return { ok: true, stream };
    } catch (err) {
      lastName = err instanceof DOMException ? err.name : String(err);
      if (lastName === "NotAllowedError" || lastName === "PermissionDeniedError") {
        return { ok: false, reason: "denied" };
      }
      if (lastName === "SecurityError") {
        return { ok: false, reason: "denied" };
      }
      if (lastName === "NotReadableError" || lastName === "TrackStartError" || lastName === "AbortError") {
        // Camera held by another app
        return { ok: false, reason: "busy" };
      }
      // NotFoundError / OverconstrainedError → try next constraint set
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
  if (reason === "busy") return "الكاميرا مستخدمة من تطبيق تاني — اقفل الكاميرا هناك وحاول تاني";
  if (reason === "unavailable") return "تعذر فتح الكاميرا/الميكروفون — جرّب من زر التفعيل تحت أو أعد تشغيل المتصفح";
  return "الأذن مرفوضة — فعّل الكاميرا والميكروفون من إعدادات الموقع";
}

export const MEDIA_SETTINGS_HINT =
  "الأذونات مفعّلة؟ لو لسه مش شغال: اقفل أي تطبيق فاتح الكاميرا، أو امسح بيانات الموقع من الإعدادات وافتح التطبيق من جديد واضغط سماح.";
