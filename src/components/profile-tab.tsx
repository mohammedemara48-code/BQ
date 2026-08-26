import { BadgeCheck, Camera, Copy, LogOut, Mail, MapPin, QrCode, Shield, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { forgetAccount, listAccounts, switchAccount } from "@/lib/bq/accounts";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { signOutPresence } from "@/lib/bq/server";
import { useBqMutations, useBlobStatus, useMe } from "@/lib/bq/hooks";
import { uploadMedia } from "@/lib/bq/upload";
import { INTENTS, ROLES, type Intent, type Role } from "@/lib/bq/types";
import { cn, compressImage } from "@/lib/utils";

export function ProfileTab() {
  const me = useMe();
  const user = useCurrentUser();
  const { saveMe, askVerify, mailAdmin, postStory } = useBqMutations();
  const blob = useBlobStatus(true);
  const photoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const pubRef = useRef<HTMLInputElement>(null);
  const privRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("");
  const [intent, setIntent] = useState<Intent>("");
  const [showOnMap, setShowOnMap] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState("");
  const [accounts, setAccounts] = useState<ReturnType<typeof listAccounts>>([]);

  useEffect(() => {
    setAccounts(listAccounts());
  }, [me.data?.userId]);

  useEffect(() => {
    if (!me.data) return;
    setName(me.data.name);
    setBio(me.data.bio);
    setCity(me.data.city);
    setPhone(me.data.phone);
    setRole(me.data.role);
    setIntent(me.data.intent);
    setShowOnMap(me.data.showOnMap);
  }, [me.data]);

  const p = me.data;

  async function onPick(kind: "photo" | "cover", file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, kind === "photo" ? 720 : 960);
      await saveMe.mutateAsync(kind === "photo" ? { photoUrl: dataUrl } : { coverUrl: dataUrl });
    } catch {
      toast.error("تعذر قراءة الصورة");
    }
  }

  async function addTo(kind: "gallery" | "private", file: File | undefined) {
    if (!file || !p) return;
    try {
      const url = await compressImage(file, 720);
      if (kind === "gallery") {
        await saveMe.mutateAsync({ gallery: [...p.gallery, url].slice(0, 8) });
      } else {
        await saveMe.mutateAsync({ privateGallery: [...p.privateGallery, url].slice(0, 8) });
      }
    } catch {
      toast.error("تعذر قراءة الصورة");
    }
  }

  async function save() {
    setBusy(true);
    try {
      await saveMe.mutateAsync({
        name: name.trim() || "عضو",
        bio,
        city,
        phone: phone.trim(),
        role,
        intent,
        lookingFor: intent,
        showOnMap,
      });
      toast.success("تم الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function locate() {
    if (!navigator.geolocation) {
      toast.error("الموقع غير متاح");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await saveMe.mutateAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        toast.success("تم تحديد الموقع");
      },
      () => toast.error("لم يُسمح بالموقع"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function out() {
    try {
      await signOutPresence();
    } catch {
      /* still sign out */
    }
    try {
      await signOut();
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  }

  if (!p) {
    return <div className="mx-4 mt-4 h-64 animate-pulse rounded-xl bg-elevated" />;
  }

  return (
    <div className="bq-enter px-4 pb-10 pt-2">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          className="relative block h-36 w-full bg-elevated"
          aria-label="الغلاف"
        >
          {p.coverUrl ? (
            <img src={p.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="absolute inset-0 bg-elevated" />
          )}
          <span className="absolute bottom-2 start-2 grid size-9 place-items-center rounded-full bg-bg/70">
            <Camera className="size-4" />
          </span>
        </button>
        <div className="-mt-10 flex flex-col items-center px-4 pb-5">
          <button type="button" onClick={() => photoRef.current?.click()} className="relative" aria-label="الصورة">
            <Avatar
              name={p.name}
              src={p.photoUrl}
              size="xl"
              verified={p.verified || p.isAdmin}
              className="ring-4 ring-surface"
            />
            <span className="absolute bottom-1 start-1 grid size-8 place-items-center rounded-full bg-primary text-primary-fg">
              <Camera className="size-3.5" />
            </span>
          </button>
          <p className="mt-3 font-display text-xl font-semibold">{p.name}</p>
          {p.isAdmin ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <Shield className="size-3" />
              المالك
            </p>
          ) : p.verified ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <BadgeCheck className="size-3" />
              موثّق
            </p>
          ) : null}
          <p className="text-sm text-muted">{user?.primaryEmail}</p>
          {p.serial ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1 text-xs text-muted"
              dir="ltr"
              onClick={() => {
                void navigator.clipboard?.writeText(p.serial).then(
                  () => toast.success("تم نسخ الرقم"),
                  () => toast.error("تعذر النسخ"),
                );
              }}
            >
              <Copy className="size-3" />
              {p.serial}
            </button>
          ) : null}
        </div>
      </div>

      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => void onPick("photo", e.target.files?.[0])} />
      <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => void onPick("cover", e.target.files?.[0])} />
      <input ref={pubRef} type="file" accept="image/*" hidden onChange={(e) => void addTo("gallery", e.target.files?.[0])} />
      <input ref={privRef} type="file" accept="image/*" hidden onChange={(e) => void addTo("private", e.target.files?.[0])} />
      <input
        ref={storyRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const isVideo = file.type.startsWith("video/");
            const url = await uploadMedia(file, isVideo ? "video" : "image");
            await postStory.mutateAsync({ type: isVideo ? "video" : "image", fileUrl: url });
            toast.success("نُشرت الحالة");
          } catch {
            toast.error("تعذر نشر الحالة");
          }
        }}
      />

      <SerialCard serial={p.serial} />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => storyRef.current?.click()}>
          إضافة حالة
        </Button>
        {p.verified ? (
          <Button variant="secondary" disabled>
            <BadgeCheck className="size-4" />
            موثّق
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              void askVerify.mutateAsync("طلب توثيق الحساب").then((res) => {
                toast.success(res.already ? "طلبك قيد المراجعة" : "اترسل طلب التوثيق للمالك");
              });
            }}
          >
            <BadgeCheck className="size-4" />
            طلب توثيق
          </Button>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-border bg-surface p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4" />
          تواصل مع الإدارة
        </p>
        <Textarea
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          placeholder="اكتب طلبك للمالك"
          maxLength={500}
        />
        <Button
          className="mt-2 w-full"
          variant="secondary"
          disabled={!mail.trim()}
          onClick={() => {
            void mailAdmin.mutateAsync(mail.trim()).then(() => {
              setMail("");
              toast.success("وصل طلبك للإدارة");
            });
          }}
        >
          إرسال للإدارة
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">الاسم</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>نوعك</Label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "h-11 rounded-lg text-sm font-medium",
                  role === r ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>تفضيلات</Label>
          <div className="grid grid-cols-3 gap-2">
            {INTENTS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIntent(i)}
                className={cn(
                  "h-11 rounded-lg text-sm font-medium",
                  intent === i ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="bio">نبذة</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="city">المدينة</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">الجوال — اختياري</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="text-start"
              inputMode="tel"
            />
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">صور شخصية</Label>
            <button type="button" className="text-sm text-primary" onClick={() => pubRef.current?.click()}>
              إضافة
            </button>
          </div>
          <Gallery urls={p.gallery} onRemove={(url) => void saveMe.mutateAsync({ gallery: p.gallery.filter((u) => u !== url) })} />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">صور خاصة</Label>
            <button type="button" className="text-sm text-primary" onClick={() => privRef.current?.click()}>
              إضافة
            </button>
          </div>
          <Gallery
            urls={p.privateGallery}
            locked
            onRemove={(url) =>
              void saveMe.mutateAsync({ privateGallery: p.privateGallery.filter((u) => u !== url) })
            }
          />
        </section>

        <label className="flex items-center justify-between rounded-lg border border-border bg-elevated px-4 py-3">
          <span className="text-sm">الظهور على خريطة الأعضاء</span>
          <input
            type="checkbox"
            checked={showOnMap}
            onChange={(e) => setShowOnMap(e.target.checked)}
            className="size-5 accent-primary"
          />
        </label>

        <Button className="w-full" onClick={() => void save()} disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => void locate()}>
          <MapPin className="size-4" />
          تحديد موقعي
        </Button>

        {accounts.length > 1 ? (
          <section className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Users className="size-4" />
              الحسابات
            </p>
            <ul className="space-y-1">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-start text-sm",
                      a.id === p.userId ? "bg-elevated" : "hover:bg-elevated",
                    )}
                    onClick={() => {
                      if (a.id === p.userId) return;
                      void switchAccount(a.id).then((ok) => {
                        if (!ok) toast.error("أعد دخول هذا الحساب من شاشة الدخول");
                      });
                    }}
                  >
                    <Avatar name={a.name} src={a.photo} size="sm" />
                    <span className="min-w-0 truncate">{a.name || a.email}</span>
                  </button>
                  {a.id === p.userId ? null : (
                    <button
                      type="button"
                      className="px-2 text-xs text-muted"
                      onClick={() => {
                        forgetAccount(a.id);
                        toast.success("أزيل الحساب");
                      }}
                    >
                      مسح
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-center text-[11px] text-subtle">نسخة ٢٦ أغسطس · مكالمات وإيصالات</p>
        <Button variant="outline" className="w-full" onClick={() => void out()}>
          <LogOut className="size-4" />
          تسجيل الخروج
        </Button>
        <p className="text-center text-[11px] text-subtle">
          {blob.data?.ok ? "المساحة على التخزين السحابي" : "رفع محلي محدود — فعّل التخزين السحابي"}
        </p>
      </div>
    </div>
  );
}

function SerialCard({ serial }: { serial: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!serial) return null;
  const share = origin ? `${origin}/?s=${encodeURIComponent(serial)}` : serial;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=ffffff&color=070711&data=${encodeURIComponent(share)}`;
  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium">
        <QrCode className="size-4" />
        باركود الحساب
      </p>
      <div className="flex items-center gap-4">
        <img src={qr} alt="" width={110} height={110} className="size-[110px] rounded-lg bg-bg" />
        <div className="min-w-0">
          <p className="text-xs text-muted">الرقم التسلسلي</p>
          <p className="font-display text-lg font-semibold tracking-wide" dir="ltr">
            {serial}
          </p>
          <p className="mt-1 text-[11px] text-subtle">امسح للوصول لملفك أو ابحث بالرقم</p>
        </div>
      </div>
    </section>
  );
}

function Gallery({
  urls,
  locked,
  onRemove,
}: {
  urls: string[];
  locked?: boolean;
  onRemove: (url: string) => void;
}) {
  if (urls.length === 0) {
    return (
      <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border text-sm text-muted">
        {locked ? "لا صور خاصة" : "لا صور"}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2">
      {urls.map((url) => (
        <li key={url.slice(0, 40)} className="relative overflow-hidden rounded-lg">
          <img src={url} alt="" className="aspect-square size-full object-cover" />
          <button
            type="button"
            className="absolute top-1 start-1 rounded-full bg-bg/70 px-2 py-0.5 text-[10px]"
            onClick={() => onRemove(url)}
          >
            حذف
          </button>
        </li>
      ))}
    </ul>
  );
}
