import { Link } from "@tanstack/react-router";
import { Phone, PhoneIncoming, PhoneOutgoing, Video } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useCalls, usePeople } from "@/lib/bq/hooks";
import { formatDuration, formatTime } from "@/lib/utils";

export function CallsTab() {
  const calls = useCalls();
  const people = usePeople();
  const byId = new Map((people.data ?? []).map((p) => [p.userId, p]));
  const recent = (people.data ?? []).filter((p) => p.online).slice(0, 4);

  return (
    <div className="bq-enter flex flex-col gap-5 px-4 pb-8 pt-2">
      {recent.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">اتصال سريع</h2>
          <div className="grid grid-cols-2 gap-2">
            {recent.map((p) => (
              <Link
                key={p.userId}
                to="/call/$peerId"
                params={{ peerId: p.userId }}
                search={{ kind: "audio" }}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 hover:bg-elevated"
              >
                <Avatar name={p.name} src={p.photoUrl} online size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted">صوت</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">سجل المكالمات</h2>
        {calls.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-elevated" />
            ))}
          </div>
        ) : (calls.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
            <Phone className="mx-auto mb-3 size-8 text-subtle" />
            <p className="font-medium">لا مكالمات</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {(calls.data ?? []).map((c) => {
              const p = byId.get(c.peerId);
              const name = p?.name ?? "شخص";
              const DirIcon = c.direction === "in" ? PhoneIncoming : PhoneOutgoing;
              return (
                <li key={c.id}>
                  <Link
                    to="/call/$peerId"
                    params={{ peerId: c.peerId }}
                    search={{ kind: c.kind }}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-elevated"
                  >
                    <Avatar name={name} src={p?.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{name}</span>
                        {c.kind === "video" ? (
                          <Video className="size-3.5 text-accent" />
                        ) : (
                          <Phone className="size-3.5 text-muted" />
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <DirIcon className="size-3" />
                        {formatTime(c.createdAt)}
                        {c.durationSec > 0 ? ` · ${formatDuration(c.durationSec)}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
