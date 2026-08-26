export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios = "standalone" in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone);
  return Boolean(mq || ios);
}

export function isAndroidUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isInstalled(): boolean {
  return isStandalone();
}

export function getDeferredInstall(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function captureInstallPrompt(): void {
  if (typeof window === "undefined" || listening) return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    listeners.forEach((fn) => fn());
    return outcome;
  } catch {
    listeners.forEach((fn) => fn());
    return "dismissed";
  }
}

export function wantsAndroidInstall(search: {
  install?: string | boolean | number;
  platform?: string;
}): boolean {
  const install = search.install;
  const on =
    install === true ||
    install === 1 ||
    install === "1" ||
    install === "true";
  if (!on) return false;
  const platform = String(search.platform ?? "android")
    .replaceAll('"', "")
    .toLowerCase();
  return platform !== "ios";
}
