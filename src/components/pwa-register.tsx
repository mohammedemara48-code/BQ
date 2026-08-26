import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, Smartphone } from "lucide-react";
import { BqMark } from "@/components/bq-mark";
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

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — install still works via manifest on newer Chrome */
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

export function InstallBanner() {
  const { ready, installed, android } = useCanInstall();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  if (installed) return null;

  async function install() {
    setBusy(true);
    const result = await promptInstall();
    setBusy(false);
    if (result === "unavailable") setHelp(true);
  }

  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">ثبّت BQ على هاتفك</p>
          <p className="mt-1 text-sm text-muted">يفتح كتطبيق أندرويد من الشاشة الرئيسية.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Button className="w-full" disabled={busy} onClick={() => void install()}>
          <Download className="size-4" />
          {busy ? "جاري التثبيت…" : ready ? "تثبيت التطبيق" : "تثبيت على أندرويد"}
        </Button>
        {help || (android && !ready) ? <AndroidSteps compact /> : null}
      </div>
    </div>
  );
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
        <BqMark className="size-16" />
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">ثبّت BQ</h1>
        <p className="mt-2 text-sm text-muted">يظهر على شاشتك الرئيسية كتطبيق أندرويد.</p>
      </div>

      {installed ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm">
          التطبيق مثبّت. افتحه من الشاشة الرئيسية.
        </p>
      ) : (
        <div className="space-y-4">
          {ready ? (
            <Button className="w-full" disabled={busy} onClick={() => void install()}>
              <Download className="size-4" />
              {busy ? "جاري التثبيت…" : "تثبيت التطبيق"}
            </Button>
          ) : null}
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
    <ol className={compact ? "space-y-2 text-sm text-muted" : "space-y-3 rounded-xl border border-border bg-surface p-4 text-sm"}>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-elevated">
          <MoreVertical className="size-4" />
        </span>
        <span>من Chrome اضغط القائمة أعلى اليمين.</span>
      </li>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-elevated">
          <Share className="size-4" />
        </span>
        <span>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</span>
      </li>
      <li className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-elevated">
          <Download className="size-4" />
        </span>
        <span>أكد التثبيت. أيقونة BQ هتظهر مع باقي التطبيقات.</span>
      </li>
    </ol>
  );
}
