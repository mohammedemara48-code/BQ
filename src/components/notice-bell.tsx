import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBqMutations, useNotices, usePeople } from "@/lib/bq/hooks";
import { formatTime } from "@/lib/utils";

export function NoticeBell() {
  const notices = useNotices();
  const people = usePeople();
  const { allowPrivate, readNotices } = useBqMutations();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = (notices.data ?? []).filter((n) => !n.read).length;
  const byId = new Map((people.data ?? []).map((p) => [p.userId, p]));

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) void readNotices.mutate();
  }

  function go(kind: string) {
    setOpen(false);
    if (kind === "verify" || kind === "mail" || kind === "report") {
      void navigate({ to: "/", search: { tab: "admin" } });
    } else if (kind === "request") {
      void navigate({ to: "/", search: { tab: "people" } });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative grid size-11 place-items-center rounded-lg hover:bg-elevated"
        aria-label="الإشعارات"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-primary" />
        ) : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default bg-transparent"
            aria-label="إغلاق الإشعارات"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-12 end-0 z-30 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-glow)]">
            <p className="border-b border-border px-3 py-2 text-sm font-medium">الإشعارات</p>
            <ul className="max-h-80 overflow-y-auto">
              {(notices.data ?? []).length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted">لا إشعارات</li>
              ) : (
                (notices.data ?? []).map((n) => {
                  const who = byId.get(n.fromId)?.name;
                  const adminKind = n.kind === "verify" || n.kind === "mail" || n.kind === "report";
                  return (
                    <li key={n.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-start"
                        onClick={() => go(n.kind)}
                      >
                        <p className="text-sm">
                          {adminKind ? (
                            <span>{n.text}</span>
                          ) : (
                            <>
                              <span className="font-medium">{who ?? "شخص"}</span>
                              <span className="text-muted"> · {n.text}</span>
                            </>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-subtle">{formatTime(n.createdAt)}</p>
                      </button>
                      {n.kind === "photo_ask" ? (
                        <div className="flex gap-2 px-3 pb-2">
                          <Button
                            size="sm"
                            onClick={() => allowPrivate.mutate({ viewerId: n.fromId, accept: true })}
                          >
                            سماح
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => allowPrivate.mutate({ viewerId: n.fromId, accept: false })}
                          >
                            رفض
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
