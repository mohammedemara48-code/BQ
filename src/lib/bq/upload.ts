import { upload } from "@vercel/blob/client";
import { getBearerToken } from "@/lib/auth/client";
import { compressImage, fileToDataUrl } from "@/lib/utils";

export async function uploadMedia(file: File, kind: "image" | "video" | "audio" | "file"): Promise<string> {
  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 40) || "file";
  const pathname = `bq/${kind}/${Date.now()}-${safeName}`;

  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/blob",
      headers,
      multipart: file.size > 4_000_000,
      contentType: file.type || undefined,
    });
    if (blob?.url) return blob.url;
  } catch {
    /* preview or missing token — fall back */
  }

  if (kind === "image") return compressImage(file, 960);
  return fileToDataUrl(file, kind === "video" ? 1_400_000 : 900_000);
}

export function blobConfiguredHint(ok: boolean): string {
  return ok ? "المساحة على التخزين السحابي" : "رفع محلي محدود";
}
