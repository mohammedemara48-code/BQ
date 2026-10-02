/**
 * Optional social sign-in providers for BQ.
 *
 * Grok broker federation (grok-google / grok-x) was removed. BQ is a standalone
 * product: email/password is the primary auth. Social buttons appear only when
 * this list is non-empty AND the matching Better Auth env vars are configured
 * on the host (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, etc.).
 *
 * Keep empty until those product OAuth apps are wired — never fall back to
 * sandbox/preview client secrets.
 */
export type AuthSocialProvider = {
  providerId: string;
  label: string;
};

export const AUTH_SOCIAL_PROVIDERS: readonly AuthSocialProvider[] = [];
