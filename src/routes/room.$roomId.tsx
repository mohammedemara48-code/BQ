import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, DoorOpen, LogOut, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ChatComposer } from "@/components/chat-composer";
import { RoomBubble } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBqMutations, useMe, useRoomMessages, useRooms } from "@/lib/bq/hooks";
import type { MsgType } from "@/lib/bq/types";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
});

function RoomPage() {
  const { user, isPending } = useCurrentUserState();
  const { roomId: raw } = Route.useParams();
  const roomId = Number(raw);
  const navigate = useNavigate();
  const rooms = useRooms();
  const me = useMe();
  const messages = useRoomMessages(roomId, Number.isFinite(roomId));
  const { enterRoom, exitRoom, speaker, sendRoom, report } = useBqMutations();
  const scroller = useRef<HTMLDivElement>(null);
  const room = (rooms.data ?? []).find((r) => r.id === roomId);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.data?.length]);

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;

  const joined = Boolean(room?.joined || me.data?.isAdmin);
  const speakerOn = Boolean(room?.speakerOn);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
          onClick={() => void navigate({ to: "/", search: { tab: "chats" } })}
          aria-label="رجوع"
        >
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{room?.name ?? "غرفة"}</p>
          <p className="text-xs text-muted">{room?.memberCount ?? 0} أعضاء</p>
        </div>
        {joined ? (
          <>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
              aria-label={speakerOn ? "إغلاق المكبر" : "مكبر الصوت"}
              onClick={() => {
                speaker.mutate({ roomId, on: !speakerOn });
                toast.success(speakerOn ? "المكبر اتقفل" : "المكبر شغال");
              }}
            >
              {speakerOn ? <Volume2 className="size-5 text-accent" /> : <VolumeX className="size-5" />}
            </button>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
              aria-label="خروج"
              onClick={() => {
                void exitRoom.mutateAsync(roomId).then(() => {
                  toast.success("خرجت من الغرفة");
                  void navigate({ to: "/", search: { tab: "chats" } });
                });
              }}
            >
              <LogOut className="size-5" />
            </button>
          </>
        ) : null}
      </header>

      {!joined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-medium">ادخل الغرفة عشان تشوف الرسائل</p>
          <p className="text-sm text-muted">بعد الدخول هتوصلك رسالة ترحيب من الإدارة.</p>
          <Button
            onClick={() => {
              void enterRoom.mutateAsync(roomId).then(() => toast.success("Manager يحيكم"));
            }}
          >
            <DoorOpen className="size-4" />
            دخول الغرفة
          </Button>
        </div>
      ) : (
        <>
          <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {(messages.data ?? []).map((m) => (
              <RoomBubble
                key={m.id}
                message={m}
                mine={m.senderId === me.data?.userId}
                speakerOn={speakerOn}
                onReport={
                  m.system
                    ? undefined
                    : (reason) =>
                        report.mutate({
                          userId: m.senderId,
                          reason,
                          kind: m.type === "text" ? "room" : "attachment",
                          roomId,
                          roomMessageId: m.id,
                          snippet: m.text.slice(0, 120),
                        })
                }
              />
            ))}
          </div>
          <ChatComposer
            busy={sendRoom.isPending}
            onSend={async (d) => {
              await sendRoom.mutateAsync({
                roomId,
                text: d.text,
                type: d.type as MsgType,
                fileUrl: d.fileUrl,
                durationSec: d.durationSec,
              });
            }}
          />
        </>
      )}
    </div>
  );
}
