/**
 * Self-hosted Better Auth for BQ (server-only).
 *
 * Product auth is email/password via Better Auth. There is no Grok sandbox
 * broker, no baked preview OAuth client, and no fallback to repo secrets.
 *
 * NEVER import this from client code — it pulls in `pg` + Better Auth server
 * internals. The client uses `@/lib/auth/client`.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { gateIdentitySessions } from "./gate-session.server";
import { pgliteDialect } from "./pglite-dialect";

void ensureDbReady();

const globalAuthRef = globalThis as typeof globalThis & {
  __bqAuthLocalSecret__?: string;
};

function localDevAuthSecret(): string {
  globalAuthRef.__bqAuthLocalSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__bqAuthLocalSecret__;
}

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const authDisabled = env("VITE_AUTH_ENABLED") === "false";
const databaseUrl = env("DATABASE_URL");
const isDeployed =
  Boolean(databaseUrl) ||
  Boolean(env("VERCEL")) ||
  env("NODE_ENV") === "production";

/** True when real auth is enforced (email/password product mode). */
export const authConfigured = !authDisabled && emailAndPasswordEnabled;

const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

function resolveBaseURL(): string {
  const explicit = env("BETTER_AUTH_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env("VERCEL_URL");
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}`;
  }
  if (isDeployed) {
    throw new Error(
      "[auth] BETTER_AUTH_URL is required when DATABASE_URL/VERCEL/production is set",
    );
  }
  return "http://localhost:8080";
}

const baseURL = resolveBaseURL();

const trustedOrigins: string[] = Array.from(
  new Set([baseURL, ...LOCAL_DEV_ORIGINS]),
);

function resolveAuthSecret(): string {
  const fromEnv = env("BETTER_AUTH_SECRET");
  if (fromEnv) return fromEnv;
  if (isDeployed) {
    throw new Error(
      "[auth] BETTER_AUTH_SECRET is required in production — refuse hardcoded/preview secrets",
    );
  }
  return localDevAuthSecret();
}

const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name (BQ product — not Grok sandbox). */
export const SESSION_TOKEN_COOKIE = "__Host-bq-auth.session_token";

export const auth = betterAuth({
  baseURL,
  secret: resolveAuthSecret(),
  database,
  trustedOrigins,
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: [],
      requireLocalEmailVerified: false,
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-bq-auth.session_data" },
      account_data: { name: "__Host-bq-auth.account_data" },
      dont_remember: { name: "__Host-bq-auth.dont_remember" },
    },
  },
  plugins: [
    gateIdentitySessions(),
    bearer(),
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

export { AUTH_SOCIAL_PROVIDERS } from "./providers";
