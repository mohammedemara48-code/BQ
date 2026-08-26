import { createFileRoute } from "@tanstack/react-router";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/blob")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return new Response(JSON.stringify({ error: "no-blob" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        const body = (await request.json()) as HandleUploadBody;
        try {
          const result = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
              allowedContentTypes: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "image/heic",
                "video/mp4",
                "video/webm",
                "video/quicktime",
                "video/3gpp",
                "video/x-m4v",
                "audio/webm",
                "audio/mp4",
                "audio/mpeg",
                "audio/ogg",
                "audio/aac",
                "audio/wav",
                "audio/x-m4a",
                "application/octet-stream",
              ],
              maximumSizeInBytes: 90 * 1024 * 1024,
              addRandomSuffix: true,
            }),
          });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "blob-failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
