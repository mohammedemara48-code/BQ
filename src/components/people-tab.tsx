import { Link } from "@tanstack/react-router";
import { BadgeCheck, Heart, MapPin, MessageCircle, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBqMutations, useMe, usePeople, useRequests } from "@/lib/bq/hooks";
import type { Profile } from "@/lib/bq/types";
import { cn, formatKm } from "@/lib/utils";

type Filter = "all" | "online" | "near";

export function PeopleTab() {
  const people = usePeople();
  const me = useMe();
  const requests = useRequests();
  const { request, saveMe } = useBqMutations();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const requested = useMemo(() => {
    const s = new Set<string>();
    for (const r of requests.data ?? []) {
      if (r.direction === "out") s.add(r.toId);
      if (r.status === "accepted") {
        s.add(r.toId);
        s.add(r.fromId);
      }
    }
    return s;
  }, [requests.data]);

  const hasFix = me.data?.latitude != null && me.data.longitude != null;

  const list = useMemo(() => {
    const needle = q.trim();
    let rows = people.data ?? [];
    if (filter === "online") rows = rows.filter((p) => p.online);
    if (filter === "near") {
      rows = rows
        .filter((p) => p.distanceKm != null)
        .slice()
        .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
    }
    if (needle) {
      rows = rows.filter(
        (p) =>
          p.name.includes(needle) ||
          p.city.includes(needle) ||
          p.bio.includes(needle) ||
          p.role.includes(needle) ||
          p.intent.includes(needle),
      );
    }
    return rows;
  }, [people.data, q, filter]);

  const featured = filter === "near" ? list[0] : (list.find((p) => p.online) ?? list[0]);

  function shareLocation() {
    if (!navigator.geolocation) {
      toast.error("الموقع غير متاح");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void saveMe.mutateAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          showOnMap: true,
        });
      },
      () => toast.error("لم يُسمح بالموقع"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className="bq-enter flex flex-col gap-5 px-4 pb-8 pt-2">
      <div className="sticky top-14 z-10 -mx-4 space-y-3 bg-bg px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="الاسم أو المدينة"
            className="pe-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              ["all", "الكل"],
              ["online", "متصل"],
              ["near", "قريبون"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm",
                filter === id ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filter === "near" && !hasFix ? (
        <button
          type="button"
          onClick={shareLocation}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-8 text-sm"
        >
          <MapPin className="size-4 text-primary" />
          نشر موقعي لإظهار القريبين
        </button>
      ) : people.isPending ? (
        <div className="h-64 animate-pulse rounded-xl bg-elevated" />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-muted">
          لا يوجد أحد
        </p>
      ) : (
        <>
          {featured ? (
            <FeaturedCard
              person={featured}
              requested={requested.has(featured.userId)}
              onRequest={() => request.mutate(featured.userId)}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            {list
              .filter((p) => p.userId !== featured?.userId)
              .map((p) => (
                <PersonCard
                  key={p.userId}
                  person={p}
                  requested={requested.has(p.userId)}
                  onRequest={() => request.mutate(p.userId)}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function meta(person: Profile) {
  return [person.role, person.intent, person.city].filter(Boolean).join(" · ");
}

function FeaturedCard({
  person,
  requested,
  onRequest,
}: {
  person: Profile;
  requested: boolean;
  onRequest: () => void;
}) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-surface">
      <Link to="/person/$id" params={{ id: person.userId }} className="block">
        <div className="relative h-72">
          <img
            src={person.photoUrl || undefined}
            alt=""
            className="size-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-1.5 font-display text-2xl font-semibold">
                  {person.name}
                  {person.isAdmin ? <BadgeCheck className="size-5 text-primary" /> : null}
                </h3>
                <p className="text-sm text-muted">{meta(person)}</p>
                {person.distanceKm != null ? (
                  <p className="mt-1 text-xs text-accent">{formatKm(person.distanceKm)}</p>
                ) : null}
              </div>
              {person.online ? (
                <span className="rounded-full bg-online/20 px-2.5 py-1 text-xs font-medium text-online">
                  متصل
                </span>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-fg/85">{person.bio}</p>
          </div>
        </div>
      </Link>
      <div className="flex gap-2 p-3">
        <Button
          variant={requested ? "secondary" : "primary"}
          className="flex-1"
          disabled={requested}
          onClick={onRequest}
        >
          <Heart className="size-4" />
          {requested ? "تم" : "اهتمام"}
        </Button>
        <Link to="/chat/$peerId" params={{ peerId: person.userId }} className="flex-1">
          <Button variant="secondary" className="w-full">
            <MessageCircle className="size-4" />
            محادثة
          </Button>
        </Link>
      </div>
    </article>
  );
}

function PersonCard({
  person,
  requested,
  onRequest,
}: {
  person: Profile;
  requested: boolean;
  onRequest: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <Link to="/person/$id" params={{ id: person.userId }} className="block">
        <div className="relative h-40">
          {person.photoUrl ? (
            <img src={person.photoUrl} alt="" className="size-full object-cover object-top" />
          ) : (
            <div className="grid size-full place-items-center bg-elevated">
              <Avatar name={person.name} size="lg" verified={person.isAdmin} />
            </div>
          )}
          {person.online ? (
            <span className="absolute top-2 start-2 size-2.5 rounded-full bg-online ring-2 ring-bg" />
          ) : null}
        </div>
        <div className="px-3 pt-2.5">
          <h3 className="flex items-center gap-1 truncate font-medium">
            {person.name}
            {person.isAdmin ? <BadgeCheck className="size-3.5 shrink-0 text-primary" /> : null}
          </h3>
          <p className="truncate text-xs text-muted">
            {person.role || person.intent || person.city}
            {person.distanceKm != null ? ` · ${formatKm(person.distanceKm)}` : ""}
          </p>
        </div>
      </Link>
      <div className="flex justify-end gap-1 p-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-10"
          disabled={requested}
          onClick={onRequest}
          aria-label="اهتمام"
        >
          <UserPlus className={cn("size-4", requested && "text-primary")} />
        </Button>
        <Link to="/chat/$peerId" params={{ peerId: person.userId }}>
          <Button size="icon" variant="ghost" className="size-10" aria-label="محادثة">
            <MessageCircle className="size-4" />
          </Button>
        </Link>
      </div>
    </article>
  );
}
