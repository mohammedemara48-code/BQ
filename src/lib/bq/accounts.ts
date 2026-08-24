/** Saved logins so the visitor can switch accounts without typing again. */

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

export function hasBearerToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.sessionStorage.getItem(BEARER_KEY)?.length);
  } catch {
    return false;
  }
}

export function listAccounts(): SavedAccount[] {
  return readRaw();
}

export function rememberAccount(partial: {
  id: string;
  name?: string | null;
  email?: string | null;
  photo?: string | null;
}): void {
  if (typeof window === "undefined") return;
  let token = "";
  try {
    token = window.sessionStorage.getItem(BEARER_KEY) ?? "";
  } catch {
    token = "";
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

export function switchAccount(id: string): boolean {
  const hit = readRaw().find((a) => a.id === id);
  if (!hit?.token) return false;
  try {
    window.sessionStorage.setItem(BEARER_KEY, hit.token);
  } catch {
    return false;
  }
  window.location.assign("/?tab=me");
  return true;
}

export function forgetAccount(id: string): void {
  writeRaw(readRaw().filter((a) => a.id !== id));
}
