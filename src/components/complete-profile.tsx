import { MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BqMark } from "@/components/bq-mark";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useBqMutations, useMe } from "@/lib/bq/hooks";
import { INTENTS, ROLES, type Intent, type Role } from "@/lib/bq/types";
import { cn, compressImage } from "@/lib/utils";

export function CompleteProfile() {
  const me = useMe();
  const { saveMe } = useBqMutations();
  const p = me.data;
  const [name, setName] = useState(p?.name && p.name !== "عضو جديد" ? p.name : "");
  const [bio, setBio] = useState(p?.bio ?? "");
  const [city, setCity] = useState(p?.city ?? "");
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [role, setRole] = useState<Role>(p?.role || "");
  const [intent, setIntent] = useState<Intent>(p?.intent || "");
  const [located, setLocated] = useState(p?.latitude != null);
  const [busy, setBusy] = useState(false);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const photoUrl = await compressImage(file, 720);
      await saveMe.mutateAsync({ photoUrl });
    } catch {
      toast.error("تعذر قراءة الصورة");
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      toast.error("الموقع غير متاح");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void saveMe
          .mutateAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            showOnMap: true,
          })
          .then(() => setLocated(true));
      },
      () => toast.error("لم يُسمح بالموقع"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function save() {
    if (!name.trim() || !role || !intent) {
      toast.error("الاسم والنوع والتفضيل مطلوبون");
      return;
    }
    setBusy(true);
    try {
      await saveMe.mutateAsync({
        name: name.trim(),
        bio,
        city,
        phone: phone.trim(),
        role,
        intent,
        lookingFor: intent,
      });
      locate();
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <BqMark className="size-14" />
        <h1 className="mt-4 font-display text-2xl font-semibold">ملفك</h1>
      </div>

      <div className="space-y-5">
        <label className="mx-auto flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-elevated ring-2 ring-border">
          {p?.photoUrl ? (
            <img src={p.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-sm text-muted">صورة</span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
        </label>

        <div>
          <Label htmlFor="cp-name">الاسم</Label>
          <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} />
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
          <Label htmlFor="cp-city">المدينة</Label>
          <Input id="cp-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cp-phone">الجوال — اختياري</Label>
          <Input
            id="cp-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            className="text-start"
            inputMode="tel"
          />
        </div>
        <div>
          <Label htmlFor="cp-bio">نبذة</Label>
          <Textarea id="cp-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
        </div>
        <Button variant="secondary" className="w-full" type="button" onClick={locate}>
          <MapPin className="size-4" />
          {located ? "تم تحديد الموقع" : "تحديد موقعي"}
        </Button>
        <Button className="w-full" disabled={busy} onClick={() => void save()}>
          {busy ? "جارٍ الحفظ…" : "حفظ والمتابعة"}
        </Button>
      </div>
    </main>
  );
}
