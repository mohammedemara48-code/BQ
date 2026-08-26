import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Phone, Video } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { ChatComposer } from "@/components/chat-composer";
import { DmBubble } from "@/components/message-bubble";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  findPerson,
  useBqMutations,
  useMe,
  useMessages,
  usePeople,
  usePerson,
} from "@/lib/bq/hooks";
import type { MsgType } from "@/lib/bq/types";

export const Route = createFileRoute("/chat/$peerId")({
  component: ChatPage,
});

function ChatPage() {
  const { user, isPending } = useCurrentUserState();
  const { peerId } = Route.useParams();
  const navigate = useNavigate();
  const people = usePeople();
  const me = useMe();
  const remote = usePerson(peerId);
  const messages = useMessages(peerId);
  const { send, reveal, askPrivate, report } = useBqMutations();
  const scroller = useRef<HTMLDivElement>(null);
  const person = remote.data ?? findPerson(people.data, me.data, peerId);

  const lastSeenId = useMemo(() => {
    const mine = (messages.data ?? []).filter((m) => m.senderId === me.data?.userId && m.receipt === "seen");
    return mine.at(-1)?.id;
  }, [messages.data, me.data?.userId]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.data?.length]);

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;

  const name = person?.name ?? "محادثة";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg text-fg hover:bg-elevated"
          onClick={() => void navigate({ to: "/", search: { tab: "chats" } })}
          aria-label="رجوع"
        >
          <ArrowRight className="size-5" />
        </button>
        <Link
          to="/person/$id"
          params={{ id: peerId }}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <Avatar
            name={name}
            src={person?.photoUrl}
            online={person?.online}
            verified={person?.verified || person?.isAdmin}
            size="sm"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{name}</span>
            <span className="text-xs text-muted">
              {person?.online ? "متصل" : person?.role || person?.city || ""}
            </span>
          </span>
        </Link>
        {person?.hasPrivate && !person.privateGranted ? (
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
            aria-label="طلب الصور الخاصة"
            onClick={() => {
              askPrivate.mutate(peerId);
              toast.success("تم إرسال الطلب");
            }}
          >
            <Lock className="size-5" />
          </button>
        ) : null}
        <Link
          to="/call/$peerId"
          params={{ peerId }}
          search={{ kind: "audio" }}
          className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
          aria-label="صوت"
        >
          <Phone className="size-5" />
        </Link>
        <Link
          to="/call/$peerId"
          params={{ peerId }}
          search={{ kind: "video" }}
          className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
          aria-label="فيديو"
        >
          <Video className="size-5" />
        </Link>
      </header>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {(messages.data ?? []).map((m) => {
          const mine = m.senderId === me.data?.userId;
          return (
            <DmBubble
              key={m.id}
              message={m}
              mine={mine}
              lastSeen={m.id === lastSeenId}
              onReveal={() => reveal.mutate(m.id)}
              onReport={(reason) =>
                report.mutate({
                  userId: mine ? peerId : m.senderId,
                  reason,
                  kind: m.type === "text" ? "message" : "attachment",
                  messageId: m.id,
                  snippet: m.text.slice(0, 120),
                })
              }
            />
          );
        })}
      </div>

      <ChatComposer
        busy={send.isPending}
        onSend={async (d) => {
          await send.mutateAsync({
            peerId,
            text: d.text,
            type: d.type as MsgType,
            fileUrl: d.fileUrl,
            durationSec: d.durationSec,
          });
        }}
      />
    </div>
  );
}
