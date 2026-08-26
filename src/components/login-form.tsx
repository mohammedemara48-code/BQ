import { useEffect, useState, type FormEvent } from "react";
import { BqMark } from "@/components/bq-mark";
import { InstallBanner } from "@/components/pwa-register";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { toast } from "sonner";
import { listAccounts, rememberAccount, switchAccount } from "@/lib/bq/accounts";

const PREVIEW_BEARER_KEY = "grok-auth.bearer-token";

function persistAuthToken(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as { token?: unknown; session?: { token?: unknown } };
  const token =
    (typeof data.token === "string" && data.token) ||
    (typeof data.session?.token === "string" && data.session.token) ||
    "";
  if (token.length < 8) return false;
  try {
    window.sessionStorage.setItem(PREVIEW_BEARER_KEY, token);
    return true;
  } catch {
    return false;
  }
}

async function stashSession() {
  try {
    const sess = await authClient.getSession();
    persistAuthToken(sess.data);
    const user = sess.data?.user;
    if (user?.id) {
      await rememberAccount({
        id: user.id,
        name: user.name,
        email: user.email,
        photo: user.image,
      });
    }
  } catch {
    /* next page load will retry */
  }
}

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<ReturnType<typeof listAccounts>>([]);
  useEffect(() => {
    setSaved(listAccounts());
  }, []);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const mail = email.trim();
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email: mail,
          password,
          name: name.trim() || mail.split("@")[0] || "عضو",
        });
        if (res.error) throw new Error(res.error.message || "تعذر إنشاء الحساب");
        persistAuthToken(res.data);
        await stashSession();
      } else {
        const res = await authClient.signIn.email({
          email: mail,
          password,
        });
        if (res.error) throw new Error(res.error.message || "بيانات غير صحيحة");
        persistAuthToken(res.data);
        await stashSession();
      }
      try {
        await authClient.getSession();
      } catch {
        /* cookie/bearer session may settle on the next load */
      }
      window.location.assign("/?tab=me");
    } catch (err) {
      setError(err instanceof Error ? arabicAuthError(err.message) : "حدث خطأ");
      setBusy(false);
    }
  }

  async function onOauth(providerId: string) {
    setError("");
    setBusy(true);
    try {
      await signIn(providerId, { callbackURL: "/?tab=me" });
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof Error
          ? arabicAuthError(err.message)
          : "تعذر فتح نافذة الدخول",
      );
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BqMark className="size-16" />
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">BQ</h1>
        </div>

        {saved.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {saved.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-start"
                  onClick={() => {
                    void switchAccount(a.id).then((ok) => {
                      if (!ok) toast.error("أعد دخول هذا الحساب");
                    });
                  }}
                >
                  {a.photo ? (
                    <img src={a.photo} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-full bg-elevated text-sm">
                      {(a.name || a.email || "?").slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.name || "حساب"}</span>
                    <span className="block truncate text-xs text-muted">{a.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-xl border border-border bg-surface p-5">
          {!authEnabled ? (
            <p className="text-sm text-muted">الدخول غير مفعّل.</p>
          ) : (
            <>
              <form onSubmit={(e) => void onEmail(e)} className="space-y-3">
                {mode === "up" ? (
                  <div>
                    <Label htmlFor="name">الاسم</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="email">البريد</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    dir="ltr"
                    className="text-start"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    dir="ltr"
                    className="text-start"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "جاري…" : mode === "up" ? "إنشاء حساب" : "دخول"}
                </Button>
              </form>

              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-muted hover:text-fg"
                onClick={() => {
                  setMode(mode === "up" ? "in" : "up");
                  setError("");
                }}
              >
                {mode === "up" ? "لدي حساب" : "حساب جديد"}
              </button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-subtle">أو</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    variant="secondary"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void onOauth(p.providerId)}
                  >
                    {p.label === "Google" ? "Google" : "X"}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-4">
          <InstallBanner />
        </div>
      </div>
    </main>
  );
}

export function BqSplash() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <BqMark className="mx-auto size-16" />
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">BQ</h1>
      </div>
    </div>
  );
}

function arabicAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("popup") || m.includes("pop-up") || m.includes("blocked")) {
    return "المتصفح منع النافذة. استخدم البريد.";
  }
  if (m.includes("invalid origin") || m.includes("forbidden")) {
    return "تعذر إكمال الدخول من هذا الرابط. أعد المحاولة أو استخدم البريد.";
  }
  if (m.includes("invalid email or password") || m.includes("invalid") || m.includes("credential")) {
    return "البريد أو كلمة المرور غير صحيحة";
  }
  if (m.includes("exist") || m.includes("already")) return "هذا البريد مسجّل. اضغط لدي حساب.";
  if (m.includes("password")) return "كلمة المرور يجب ألا تقل عن 8 أحرف";
  if (m.includes("email")) return "تحقق من البريد";
  return msg;
}
