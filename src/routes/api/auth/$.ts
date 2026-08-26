import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

const LOCAL_TRUSTED = new Set([
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
]);

function configuredOrigin(): string | null {
  const raw = process.env.BETTER_AUTH_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function headerHosts(request: Request): string[] {
  const out: string[] = [];
  for (const key of ["x-forwarded-host", "host"] as const) {
    const raw = request.headers.get(key);
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const host = part.trim().toLowerCase();
      if (host) out.push(host);
    }
  }
  try {
    out.push(new URL(request.url).host.toLowerCase());
  } catch {
    /* ignore */
  }
  return out;
}

/** True when Origin is this app — including Vercel aliases / forwarded hosts. */
function isFirstPartyOrigin(request: Request, originUrl: URL): boolean {
  const originHost = originUrl.host.toLowerCase();
  return headerHosts(request).some((host) => host === originHost);
}

function isTrustedOrigin(origin: string): boolean {
  const configured = configuredOrigin();
  if (configured && origin === configured) return true;
  return LOCAL_TRUSTED.has(origin);
}

function applyOrigin(request: Request, trusted: string): Request {
  try {
    request.headers.set("origin", trusted);
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const next = new URL(referer);
        const base = new URL(trusted);
        next.protocol = base.protocol;
        next.host = base.host;
        request.headers.set("referer", next.toString());
      } catch {
        request.headers.set("referer", `${trusted}/`);
      }
    }
    return request;
  } catch {
    /* headers immutable */
  }

  const headers = new Headers(request.headers);
  headers.set("origin", trusted);
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(request.url, init);
}

/**
 * Better Auth CSRF only trusts BETTER_AUTH_URL + local preview hosts.
 * Vercel aliases (bq-waslapp, unique deployment URLs, grok publish hosts)
 * POST with a matching first-party Origin and still get INVALID_ORIGIN.
 * Rewrite that Origin onto a trusted one — never for cross-site Origins.
 */
function withTrustedOrigin(request: Request): Request {
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return request;

  let originUrl: URL;
  try {
    originUrl = new URL(rawOrigin);
  } catch {
    return request;
  }
  if (!isFirstPartyOrigin(request, originUrl)) return request;

  const origin = originUrl.origin;
  if (isTrustedOrigin(origin)) return request;

  const trusted = configuredOrigin() ?? "http://localhost:8080";
  if (trusted === origin) return request;
  return applyOrigin(request, trusted);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(withTrustedOrigin(request)),
      POST: ({ request }) => auth.handler(withTrustedOrigin(request)),
    },
  },
});
