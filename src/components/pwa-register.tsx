import { useEffect, useState } from "react";
import { Download, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  captureInstallPrompt,
  getDeferredInstall,
  isAndroidUserAgent,
  isInstalled,
  promptInstall,
  subscribeInstallPrompt,
} from "@/lib/bq/pwa";

captureInstallPrompt();

const ICON = "/icons/icon-192.png";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore */
    });
  }, []);
  return null;
}

export function useCanInstall() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    setReady(Boolean(getDeferredInstall()));
    setInstalled(isInstalled());
    setAndroid(isAndroidUserAgent());
    return subscribeInstallPrompt(() => {
      setReady(Boolean(getDeferredInstall()));
      setInstalled(isInstalled());
    });
  }, []);
  return { ready, installed, android };
}

export function InstallDock() {
  const { ready, installed } = useCanInstall();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  if (installed) return null;

  async function install() {
    setBusy(true);
    const result = await promptInstall();
    setBusy(false);
    if (result !== "accepted") setHelp(true);
  }

  return (
    <div className="border-b border-border bg-surface px-3 py-3">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl bg-elevated px-3 py-3 text-start"
        onClick={() => void install()}
        disabled={busy}
      >
        <img
          src={ICON}
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-[22%] ring-1 ring-border"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">تنزيل تطبيق BQ</span>
          <span className="mt-0.5 block text-xs text-muted">
            أيقونة B على شاشتك مع باقي التطبيقات
          </span>
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-fg">
          <Download className="size-5" />
        </span>
      </button>
      {help ? (
        <div className="relative mt-3">
          <button
            type="button"
            className="absolute end-0 top-0 grid size-8 place-items-center text-muted"
            onClick={() => setHelp(false)}
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
          <AndroidSteps compact />
        </div>
      ) : ready ? (
        <p className="mt-2 text-center text-xs text-muted">اضغط لتنزيل التطبيق بأيقونة BQ</p>
      ) : null}
    </div>
  );
}

export function InstallBanner() {
  return <InstallDock />;
}

export function AndroidInstallPage() {
  const { ready, installed } = useCanInstall();
  const [busy, setBusy] = useState(false);

  async function install() {
    setBusy(true);
    await promptInstall();
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <img
          src={ICON}
          alt="BQ"
          width={96}
          height={96}
          className="size-24 rounded-[22%] ring-1 ring-border"
        />
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">تنزيل BQ</h1>
        <p className="mt-2 text-sm text-muted">التطبيق يظهر بأيقونة B على الشاشة الرئيسية.</p>
      </div>

      {installed ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm">
          التطبيق مثبّت. افتحه من الشاشة الرئيسية.
        </p>
      ) : (
        <div className="space-y-4">
          <Button className="w-full" disabled={busy} onClick={() => void install()}>
            <Download className="size-4" />
            {busy ? "جاري التنزيل…" : ready ? "تنزيل التطبيق" : "تنزيل بأيقونة BQ"}
          </Button>
          <AndroidSteps />
          <a
            href="/?tab=chats"
            className="block w-full rounded-lg bg-elevated py-3 text-center text-sm text-muted"
          >
            فتح التطبيق في المتصفح
          </a>
        </div>
      )}
    </main>
  );
}

function AndroidSteps({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      className={
        compact
          ? "space-y-2 text-sm text-muted"
          : "space-y-3 rounded-xl border border-border bg-surface p-4 text-sm"
      }
    >
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-elevated">
          <MoreVertical className="size-4" />
        </span>
        <span>من Chrome اضغط النقاط الثلاث أعلى الشاشة.</span>
      </li>
      <li className="flex items-start gap-3">
        <img
          src={ICON}
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-md ring-1 ring-border"
        />
        <span>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</span>
      </li>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-fg">
          <Download className="size-4" />
        </span>
        <span>أكد. أيقونة B الوردية هتظهر مع التطبيقات.</span>
      </li>
    </ol>
  );
}
