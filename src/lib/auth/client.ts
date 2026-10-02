import { createAuthClient } from "better-auth/react";
import { runSignOut } from "../../../scripts/sign-out-plan.mjs";
import { AUTH_SOCIAL_PROVIDERS } from "./providers";

/**
 * Better Auth client for BQ (browser-side).
 *
 * Talks to this app's own Better Auth at same-origin `/api/auth/*`.
 * Optional bearer token in sessionStorage helps multi-account switch;
 * cookie auth is the primary path in production.
 */
export const authClient = createAuthClient({
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** Social providers to render (empty = email/password only). */
export { AUTH_SOCIAL_PROVIDERS };

const BEARER_KEY = "bq-auth.bearer-token";
/** Legacy key from the Grok sandbox template — cleared on sign-out. */
const LEGACY_BEARER_KEY = "grok-auth.bearer-token";

export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.sessionStorage.getItem(BEARER_KEY) ||
      window.sessionStorage.getItem(LEGACY_BEARER_KEY)
    );
  } catch {
    return null;
  }
}

export function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
    window.sessionStorage.removeItem(LEGACY_BEARER_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Social OAuth is not configured for BQ standalone (email/password only). */
export async function signIn(
  _providerId: string,
  _opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  throw new Error("Social sign-in is not available — use email and password");
}

export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    livePreview: false,
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}
