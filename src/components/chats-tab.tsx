import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useChats, useMe, usePeople } from "@/lib/bq/hooks";
import { formatTime } from "@/lib/utils";

export function ChatsTab() {
  const chats = useChats();
  const people = usePeople();
  const me = useMe();
  const online = (people.data ?? []).filter((p) => p.online);
  const byId = new Map((people.data ?? []).map((p) => [p.userId, p]));

  return (
    <div className="bq-enter flex flex-col gap-5 px-4 pb-8 pt-2">
      {online.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">متصلون الآن</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {online.map((p) => (
              <Link
                key={p.userId}
                to="/chat/$peerId"
                params={{ peerId: p.userId }}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <Avatar name={p.name} src={p.photoUrl} online size="md" />
                <span className="w-full truncate text-center text-xs text-muted">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">المحادثات</h2>
        {chats.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-elevated" />
            ))}
          </div>
        ) : (chats.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
            <MessageCircle className="mx-auto mb-3 size-8 text-subtle" />
            <p className="font-medium">لا محادثات</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {(chats.data ?? []).map((c) => {
              const p = byId.get(c.peerId);
              const name = p?.name ?? "شخص";
              const preview =
                c.lastType === "image"
                  ? "صورة"
                  : c.lastType === "video"
                    ? "فيديو"
                    : c.lastType === "voice"
                      ? "صوتية"
                      : c.lastType === "file"
                        ? "ملف"
                        : c.lastText || "رسالة";
              const mine = c.lastSenderId === me.data?.userId;
              return (
                <li key={c.peerId}>
                  <Link
                    to="/chat/$peerId"
                    params={{ peerId: c.peerId }}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-elevated"
                  >
                    <Avatar
                      name={name}
                      src={p?.photoUrl}
                      online={p?.online}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{name}</span>
                        <span className="shrink-0 text-xs text-subtle">
                          {formatTime(c.lastAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted">
                        {mine ? "أنت: " : ""}
                        {preview}
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
