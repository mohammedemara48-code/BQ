export const VAPID_PUBLIC_KEY =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VAPID_PUBLIC_KEY) ||
  "BKlA1SI4HiGzkdTHGhelH4VmAcD4vf5Y0BJtB52hdfqpUyKsR08GpWoRzqhhdNfXz0p-UXvZCtDd2L6Gno3LLYU";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function enablePush(
  save: (input: {
    endpoint: string;
    p256dh: string;
    auth: string;
  }) => Promise<unknown>,
): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON();
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh || "";
  const auth = json.keys?.auth || "";
  if (!endpoint || !p256dh || !auth) return "denied";
  await save({ endpoint, p256dh, auth });
  return "granted";
}
