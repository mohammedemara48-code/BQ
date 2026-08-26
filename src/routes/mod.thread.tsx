import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DmBubble, RoomBubble } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAdminThread, useBqMutations, useMe } from "@/lib/bq/hooks";

type Search = {
  a?: string;
  b?: string;
  roomId?: number;
  reportId?: number;
};

export const Route = createFileRoute("/mod/thread")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const next: Search = {};
    if (typeof s.a === "string") next.a = s.a;
    if (typeof s.b === "string") next.b = s.b;
    if (typeof s.roomId === "number") next.roomId = s.roomId;
    if (typeof s.roomId === "string" && /^\d+$/.test(s.roomId)) next.roomId = Number(s.roomId);
    if (typeof s.reportId === "number") next.reportId = s.reportId;
    if (typeof s.reportId === "string" && /^\d+$/.test(s.reportId)) next.reportId = Number(s.reportId);
    return next;
  },
  component: ModThread,
});

function ModThread() {
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const me = useMe();
  const { closeReport } = useBqMutations();
  const thread = useAdminThread(
    { peerA: search.a, peerB: search.b, roomId: search.roomId },
    Boolean(me.data?.isAdmin),
  );

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;
  if (me.data && !me.data.isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted">غير مسموح</div>
    );
  }

  const data = thread.data;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-border px-2 py-2">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
          onClick={() => void navigate({ to: "/", search: { tab: "me" } })}
          aria-label="رجوع"
        >
          <ArrowRight className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium">مراجعة البلاغ</p>
          <p className="text-xs text-muted">صلاحية المالك على المحادثة</p>
        </div>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {data?.kind === "room"
          ? (data.room ?? []).map((m) => (
              <RoomBubble key={m.id} message={m} mine={false} />
            ))
          : (data?.messages ?? []).map((m) => (
              <DmBubble key={m.id} message={m} mine={m.senderId === search.a} />
            ))}
        {thread.isPending ? <div className="h-32 animate-pulse rounded-lg bg-elevated" /> : null}
      </div>
      {search.reportId ? (
        <div className="grid grid-cols-3 gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void closeReport.mutateAsync({ id: search.reportId!, action: "dismiss" }).then(() =>
                navigate({ to: "/", search: { tab: "me" } }),
              );
            }}
          >
            حفظ
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void closeReport.mutateAsync({ id: search.reportId!, action: "delete_message" }).then(() =>
                navigate({ to: "/", search: { tab: "me" } }),
              );
            }}
          >
            حذف المحتوى
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              void closeReport.mutateAsync({ id: search.reportId!, action: "remove_user" }).then(() =>
                navigate({ to: "/", search: { tab: "me" } }),
              );
            }}
          >
            إزالة العضو
          </Button>
        </div>
      ) : null}
    </div>
  );
}
