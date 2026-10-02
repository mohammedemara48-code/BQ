import { z } from "zod";

/** Max length for http(s) URLs (blob CDN links). */
const HTTP_URL_MAX = 2048;
/** Max for data: media fallback when Blob upload is unavailable. */
const DATA_URL_MAX = 2_000_000;

const SAFE_DATA_PREFIX =
  /^data:(image\/(jpeg|jpg|png|gif|webp|avif)|video\/(mp4|webm|ogg)|audio\/(mpeg|mp4|webm|ogg|wav|aac)|application\/octet-stream);base64,/i;

/**
 * Harden user-supplied media URLs: only http(s) or safe media data: URLs.
 * Blocks javascript:, data:text/html, and other non-http(s) schemes.
 */
export function isSafeMediaUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return false;
  if (lower.startsWith("data:")) {
    if (v.length > DATA_URL_MAX) return false;
    return SAFE_DATA_PREFIX.test(v);
  }
  if (v.length > HTTP_URL_MAX) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const safeMediaUrl = z
  .string()
  .max(DATA_URL_MAX)
  .refine(isSafeMediaUrl, { message: "unsafe_media_url" });

export const optionalSafeMediaUrl = safeMediaUrl.nullable().optional();

/** Profile photo/cover: http(s) or image data: only. */
export function isSafeImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return false;
  if (lower.startsWith("data:")) {
    if (v.length > 350_000) return false;
    return /^data:image\/(jpeg|jpg|png|gif|webp|avif);base64,/i.test(v);
  }
  if (v.length > HTTP_URL_MAX) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const optionalSafeImageUrl = z
  .string()
  .max(350_000)
  .refine(isSafeImageUrl, { message: "unsafe_image_url" })
  .optional();
