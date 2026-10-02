/**
 * ICE helpers for WebRTC media calls.
 * Uses Google/Cloudflare STUN plus Open Relay Project free TURN
 * (static-auth HMAC, 20 GB/mo community quota).
 */

export type SignalKind = "offer" | "answer" | "ice";

export function defaultIceServers(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_STUN_URLS as string | undefined)
    ?.split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return [
    {
      urls: urls?.length
        ? urls
        : ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478", "stun:openrelay.metered.ca:80"],
    },
  ];
}

/** Merge STUN defaults with optional TURN from the server. */
export function mergeIceServers(extra?: RTCIceServer[] | null): RTCIceServer[] {
  const base = defaultIceServers();
  if (!extra?.length) return base;
  return [...base, ...extra];
}
