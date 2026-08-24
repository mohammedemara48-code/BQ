import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, Lock, Phone, Video } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { ChatComposer } from "@/components/chat-composer";
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
import { cn, formatDuration, formatTime } from "@/lib/utils";

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
  const { send, reveal, askPrivate } = useBqMutations();
  const scroller = useRef<HTMLDivElement>(null);
  const person = remote.data ?? findPerson(people.data, me.data, peerId);

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
            verified={person?.isAdmin}
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
          const hidden = m.viewOnce && !m.opened && !mine;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-lg px-3 py-2 text-sm",
                  mine
                    ? "rounded-ss-sm bg-primary text-primary-fg"
                    : "rounded-se-sm bg-elevated text-fg",
                )}
              >
                {hidden ? (
                  <button
                    type="button"
                    className="flex items-center gap-2"
                    onClick={() => reveal.mutate(m.id)}
                  >
                    <Eye className="size-4" />
                    عرض مرة واحدة
                  </button>
                ) : m.type === "image" && m.fileUrl ? (
                  <img src={m.fileUrl} alt="" className="mb-1 max-h-56 rounded-md object-cover" />
                ) : m.type === "video" && m.fileUrl ? (
                  <video src={m.fileUrl} controls className="mb-1 max-h-56 rounded-md" />
                ) : m.type === "voice" && m.fileUrl ? (
                  <div className="flex items-center gap-2">
                    <audio src={m.fileUrl} controls className="h-10 max-w-[200px]" />
                    <span className="text-[10px] tabular-nums opacity-80">
                      {formatDuration(m.durationSec)}
                    </span>
                  </div>
                ) : m.type === "file" ? (
                  <a href={m.fileUrl ?? "#"} download={m.text} className="underline">
                    {m.text || "ملف"}
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                )}
                <p className={cn("mt-1 text-[10px]", mine ? "text-primary-fg/70" : "text-subtle")}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
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
