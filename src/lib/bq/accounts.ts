/** Saved logins so the visitor can switch accounts without typing again. */

import { authClient } from "@/lib/auth/client";

const ACCOUNTS_KEY = "bq.accounts";
const BEARER_KEY = "grok-auth.bearer-token";

export type SavedAccount = {
  id: string;
  name: string;
  email: string;
  photo: string;
  token: string;
};

function readRaw(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is SavedAccount =>
        a &&
        typeof a === "object" &&
        typeof (a as SavedAccount).id === "string" &&
        typeof (a as SavedAccount).token === "string",
    );
  } catch {
    return [];
  }
}

function writeRaw(list: SavedAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* ignore */
  }
}

function readBearer(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(BEARER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeBearer(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}

export function hasBearerToken(): boolean {
  return Boolean(readBearer().length);
}

export function listAccounts(): SavedAccount[] {
  return readRaw();
}

export async function rememberAccount(partial: {
  id: string;
  name?: string | null;
  email?: string | null;
  photo?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
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
  const prev = readRaw().filter((a) => a.id !== partial.id);
  const existing = readRaw().find((a) => a.id === partial.id);
  writeRaw([
    {
      id: partial.id,
      name: partial.name || existing?.name || "عضو",
      email: partial.email || existing?.email || "",
      photo: partial.photo || existing?.photo || "",
      token: token || existing?.token || "",
    },
    ...prev,
  ]);
}

export async function switchAccount(id: string): Promise<boolean> {
  const hit = readRaw().find((a) => a.id === id);
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
  writeRaw(readRaw().filter((a) => a.id !== id));
}
