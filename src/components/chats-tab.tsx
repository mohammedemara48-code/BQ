import { Link } from "@tanstack/react-router";
import { Check, CheckCheck, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { RoomsSection } from "@/components/rooms-section";
import { StoriesTray } from "@/components/stories-tray";
import { useBqMutations, useChats, useMe, usePeople } from "@/lib/bq/hooks";
import type { ChatPreview } from "@/lib/bq/types";
import { formatTime } from "@/lib/utils";

export function ChatsTab() {
  const chats = useChats();
  const people = usePeople();
  const me = useMe();
  const { acceptMsg } = useBqMutations();
  const online = (people.data ?? []).filter((p) => p.online);
  const byId = new Map((people.data ?? []).map((p) => [p.userId, p]));
  const all = chats.data ?? [];
  const inbox = all.filter((c) => !c.isRequest);
  const requests = all.filter((c) => c.isRequest);

  return (
    <div className="bq-enter flex flex-col gap-5 px-4 pb-8 pt-2">
      <StoriesTray />

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
                <Avatar name={p.name} src={p.photoUrl} online size="md" verified={p.verified} />
                <span className="w-full truncate text-center text-xs text-muted">{p.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <RoomsSection />

      {requests.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">طلبات المراسلة</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-primary/30 bg-surface">
            {requests.map((c) => (
              <ChatRow
                key={c.peerId}
                chat={c}
                name={byId.get(c.peerId)?.name ?? "شخص"}
                photo={byId.get(c.peerId)?.photoUrl}
                online={byId.get(c.peerId)?.online}
                verified={byId.get(c.peerId)?.verified}
                mine={c.lastSenderId === me.data?.userId}
                request
                onAccept={() => acceptMsg.mutate(c.peerId)}
                accepting={acceptMsg.isPending}
              />
            ))}
          </ul>
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
        ) : inbox.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
            <MessageCircle className="mx-auto mb-3 size-8 text-subtle" />
            <p className="font-medium">لا محادثات</p>
            <p className="mt-1 text-sm text-muted">أضف صديق من تبويب الأشخاص</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {inbox.map((c) => (
              <ChatRow
                key={c.peerId}
                chat={c}
                name={byId.get(c.peerId)?.name ?? "شخص"}
                photo={byId.get(c.peerId)?.photoUrl}
                online={byId.get(c.peerId)?.online}
                verified={byId.get(c.peerId)?.verified}
                mine={c.lastSenderId === me.data?.userId}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChatRow({
  chat: c,
  name,
  photo,
  online,
  verified,
  mine,
  request,
  onAccept,
  accepting,
}: {
  chat: ChatPreview;
  name: string;
  photo?: string;
  online?: boolean;
  verified?: boolean;
  mine: boolean;
  request?: boolean;
  onAccept?: () => void;
  accepting?: boolean;
}) {
  const preview =
    c.lastType === "image"
      ? "صورة"
      : c.lastType === "video"
        ? "فيديو"
        : c.lastType === "voice"
          ? "صوتية"
          : c.lastType === "file"
            ? "ملف"
            : c.lastType === "call"
              ? c.lastText || "مكالمة"
              : c.lastText || "رسالة";
  return (
    <li>
      <div className="flex items-center gap-2 px-2 py-2">
        <Link
          to="/chat/$peerId"
          params={{ peerId: c.peerId }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 hover:bg-elevated"
        >
          <Avatar name={name} src={photo} online={online} verified={verified} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{name}</span>
              <span className="shrink-0 text-xs text-subtle">{formatTime(c.lastAt)}</span>
            </span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
              {mine ? (
                c.lastSeen ? (
                  <CheckCheck className="size-3.5 shrink-0 text-primary" />
                ) : c.lastDelivered ? (
                  <CheckCheck className="size-3.5 shrink-0" />
                ) : (
                  <Check className="size-3.5 shrink-0" />
                )
              ) : null}
              <span className="truncate">
                {mine ? "أنت: " : ""}
                {preview}
              </span>
              {c.unread > 0 ? (
                <span className="ms-auto grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] text-primary-fg">
                  {c.unread}
                </span>
              ) : null}
            </span>
          </span>
        </Link>
        {request && onAccept ? (
          <Button size="sm" onClick={onAccept} disabled={accepting}>
            قبول
          </Button>
        ) : null}
      </div>
    </li>
  );
}
