import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Flag,
  Heart,
  Lock,
  MessageCircle,
  Phone,
  UserMinus,
  Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { findPerson, useBqMutations, useMe, usePeople, usePerson, useRequests } from "@/lib/bq/hooks";
import { formatKm } from "@/lib/utils";

const REPORT_REASONS = ["مزعج", "محتوى غير لائق", "حساب وهمي", "تحرش"];

export const Route = createFileRoute("/person/$id")({
  component: PersonPage,
});

function PersonPage() {
  const { user, isPending } = useCurrentUserState();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const people = usePeople();
  const me = useMe();
  const remote = usePerson(id);
  const requests = useRequests();
  const { request, block, dropFriend, report, askPrivate } = useBqMutations();
  const person = remote.data ?? findPerson(people.data, me.data, id);
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;

  if (!person) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-muted">هذا الملف غير متاح.</p>
        <Button className="mt-4" onClick={() => void navigate({ to: "/", search: { tab: "people" } })}>
          عودة
        </Button>
      </div>
    );
  }

  const friends = (requests.data ?? []).some(
    (r) => (r.toId === id || r.fromId === id) && r.status === "accepted",
  );
  const already = (requests.data ?? []).some(
    (r) =>
      (r.toId === id || r.fromId === id) &&
      (r.status === "accepted" || r.direction === "out"),
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-bg pb-10">
      <div className="relative h-72">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt="" className="size-full object-cover object-top" />
        ) : (
          <div className="grid size-full place-items-center bg-elevated">
            <Avatar name={person.name} size="xl" verified={person.isAdmin} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/40" />
        <button
          type="button"
          className="absolute top-3 start-3 grid size-11 place-items-center rounded-full bg-bg/60 backdrop-blur-sm"
          onClick={() => void navigate({ to: "/", search: { tab: "people" } })}
          aria-label="رجوع"
        >
          <ArrowRight className="size-5" />
        </button>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            {person.name}
            {person.isAdmin ? <BadgeCheck className="size-6 text-primary" /> : null}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {[person.role, person.intent, person.city].filter(Boolean).join(" · ")}
            {person.online ? " · متصل" : ""}
          </p>
          {person.distanceKm != null ? (
            <p className="mt-1 text-xs text-accent">{formatKm(person.distanceKm)}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 px-5 pt-4">
        {person.bio ? <p className="leading-relaxed text-fg/90">{person.bio}</p> : null}

        {person.gallery.length > 0 ? (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted">صور</h2>
            <ul className="grid grid-cols-3 gap-2">
              {person.gallery.map((url) => (
                <li key={url.slice(0, 32)}>
                  <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {person.hasPrivate ? (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted">صور خاصة</h2>
            {person.privateGranted && person.privateGallery.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2">
                {person.privateGallery.map((url) => (
                  <li key={url.slice(0, 32)}>
                    <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                <ul className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-elevated"
                    >
                      <Lock className="size-5 text-muted" />
                    </li>
                  ))}
                </ul>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    askPrivate.mutate(id);
                    toast.success("تم إرسال الطلب");
                  }}
                >
                  <Lock className="size-4" />
                  طلب مشاهدة
                </Button>
              </div>
            )}
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={already ? "secondary" : "primary"}
            disabled={already}
            onClick={() => request.mutate(id)}
          >
            <Heart className="size-4" />
            {already ? "تم" : "اهتمام"}
          </Button>
          <Link to="/chat/$peerId" params={{ peerId: id }}>
            <Button variant="secondary" className="w-full">
              <MessageCircle className="size-4" />
              محادثة
            </Button>
          </Link>
          <Link to="/call/$peerId" params={{ peerId: id }} search={{ kind: "audio" }}>
            <Button variant="outline" className="w-full">
              <Phone className="size-4" />
              صوت
            </Button>
          </Link>
          <Link to="/call/$peerId" params={{ peerId: id }} search={{ kind: "video" }}>
            <Button variant="outline" className="w-full">
              <Video className="size-4" />
              فيديو
            </Button>
          </Link>
        </div>

        <button
          type="button"
          className="w-full text-center text-sm text-muted"
          onClick={() => setMore((v) => !v)}
        >
          {more ? "إخفاء" : "المزيد"}
        </button>
        {more ? (
          <div className="grid gap-2">
            {friends ? (
              <Button
                variant="outline"
                onClick={() => {
                  dropFriend.mutate(id);
                  toast.success("أُلغيت الصداقة");
                }}
              >
                <UserMinus className="size-4" />
                إلغاء صداقة
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                block.mutate(id);
                toast.success("تم الحظر");
                void navigate({ to: "/", search: { tab: "people" } });
              }}
            >
              <Ban className="size-4" />
              حظر
            </Button>
            {reporting ? (
              <div className="grid grid-cols-2 gap-2">
                {REPORT_REASONS.map((reason) => (
                  <Button
                    key={reason}
                    variant="outline"
                    onClick={() => {
                      report.mutate({ userId: id, reason });
                      setReporting(false);
                      toast.success("تم الإبلاغ");
                    }}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            ) : (
              <Button variant="outline" onClick={() => setReporting(true)}>
                <Flag className="size-4" />
                إبلاغ
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
