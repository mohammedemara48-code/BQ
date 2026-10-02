/** Saved logins so the visitor can switch accounts without typing again. */

import { authClient } from "@/lib/auth/client";

const ACCOUNTS_KEY = "bq.accounts";
const TOKENS_KEY = "bq.account-tokens";
const BEARER_KEY = "bq-auth.bearer-token";
const LEGACY_BEARER_KEY = "grok-auth.bearer-token";

export type SavedAccount = {
  id: string;
  name: string;
  email: string;
  photo: string;
  /** Present only while this browser session still holds the token. */
  token: string;
};

type AccountMeta = Omit<SavedAccount, "token">;

function readMeta(): AccountMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (a): a is AccountMeta & { token?: string } =>
          Boolean(a) &&
          typeof a === "object" &&
          typeof (a as AccountMeta).id === "string",
      )
      .map((a) => ({
        id: a.id,
        name: typeof a.name === "string" ? a.name : "عضو",
        email: typeof a.email === "string" ? a.email : "",
        photo: typeof a.photo === "string" ? a.photo : "",
      }));
  } catch {
    return [];
  }
}

function writeMeta(list: AccountMeta[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify(list.slice(0, 8).map(({ id, name, email, photo }) => ({ id, name, email, photo }))),
    );
  } catch {
    /* ignore */
  }
}

function readTokenMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(TOKENS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 8) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeTokenMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOKENS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function migrateLegacyTokens() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    const map = readTokenMap();
    let moved = false;
    for (const a of parsed) {
      if (
        a &&
        typeof a === "object" &&
        typeof (a as SavedAccount).id === "string" &&
        typeof (a as SavedAccount).token === "string" &&
        (a as SavedAccount).token.length > 8
      ) {
        map[(a as SavedAccount).id] = (a as SavedAccount).token;
        moved = true;
      }
    }
    if (moved) {
      writeTokenMap(map);
      writeMeta(
        parsed
          .filter((a): a is SavedAccount => Boolean(a) && typeof a === "object" && typeof (a as SavedAccount).id === "string")
          .map((a) => ({
            id: a.id,
            name: a.name || "عضو",
            email: a.email || "",
            photo: a.photo || "",
          })),
      );
    }
  } catch {
    /* ignore */
  }
}

function readBearer(): string {
  if (typeof window === "undefined") return "";
  try {
    return (
      window.sessionStorage.getItem(BEARER_KEY) ||
      window.sessionStorage.getItem(LEGACY_BEARER_KEY) ||
      ""
    );
  } catch {
    return "";
  }
}

function writeBearer(token: string) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
    window.sessionStorage.removeItem(LEGACY_BEARER_KEY);
  } catch {
    /* ignore */
  }
}

export function hasBearerToken(): boolean {
  return Boolean(readBearer().length);
}

export function listAccounts(): SavedAccount[] {
  migrateLegacyTokens();
  const tokens = readTokenMap();
  return readMeta().map((a) => ({ ...a, token: tokens[a.id] || "" }));
}

export async function rememberAccount(partial: {
  id: string;
  name?: string | null;
  email?: string | null;
  photo?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  migrateLegacyTokens();
  let token = readBearer();
  if (!token) {
    try {
      const sess = await authClient.getSession();
      const raw = sess.data as { session?: { token?: string } } | null;
      const next = raw?.session?.token;
      if (typeof next === "string" && next.length > 8) {
        token = next;
        writeBearer(next);
      }
    } catch {
      /* cookie session without exposed token */
    }
  }
  const prev = readMeta().filter((a) => a.id !== partial.id);
  const existing = readMeta().find((a) => a.id === partial.id);
  writeMeta([
    {
      id: partial.id,
      name: partial.name || existing?.name || "عضو",
      email: partial.email || existing?.email || "",
      photo: partial.photo || existing?.photo || "",
    },
    ...prev,
  ]);
  if (token) {
    const map = readTokenMap();
    map[partial.id] = token;
    writeTokenMap(map);
  }
}

export async function switchAccount(id: string): Promise<boolean> {
  migrateLegacyTokens();
  const hit = listAccounts().find((a) => a.id === id);
  if (!hit?.token) return false;
  try {
    await authClient.signOut();
  } catch {
    /* leftover cookie session — still swap bearer */
  }
  writeBearer(hit.token);
  window.location.assign("/?tab=me");
  return true;
}

export function forgetAccount(id: string): void {
  writeMeta(readMeta().filter((a) => a.id !== id));
  const map = readTokenMap();
  delete map[id];
  writeTokenMap(map);
}
