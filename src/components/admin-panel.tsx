import { Link } from "@tanstack/react-router";
import { BadgeCheck, Flag, Mail, Shield, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  useAdminMail,
  useAdminReports,
  useBqMutations,
  useMembers,
  useVerifyRequests,
} from "@/lib/bq/hooks";
import { cn, formatTime } from "@/lib/utils";

type Pane = "members" | "reports" | "verify" | "mail";

export function AdminPanel({ enabled }: { enabled: boolean }) {
  const [pane, setPane] = useState<Pane>("reports");
  return (
    <section className="mt-8 rounded-xl border border-primary/30 bg-surface p-4">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-primary" />
        <h2 className="font-medium">لوحة الإدارة</h2>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-elevated p-1">
        {(
          [
            ["reports", "بلاغات", Flag],
            ["verify", "توثيق", BadgeCheck],
            ["mail", "تواصل", Mail],
            ["members", "أعضاء", Users],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "flex h-11 flex-col items-center justify-center rounded-md text-[10px]",
              pane === id ? "bg-primary text-primary-fg" : "text-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {pane === "members" ? <MembersPane enabled={enabled} /> : null}
      {pane === "reports" ? <ReportsPane enabled={enabled} /> : null}
      {pane === "verify" ? <VerifyPane enabled={enabled} /> : null}
      {pane === "mail" ? <MailPane enabled={enabled} /> : null}
    </section>
  );
}

function MembersPane({ enabled }: { enabled: boolean }) {
  const members = useMembers(enabled);
  const { kick } = useBqMutations();
  const list = members.data ?? [];

  async function remove(userId: string, name: string) {
    const ok = window.confirm(`إزالة ${name} من BQ؟`);
    if (!ok) return;
    const res = await kick.mutateAsync(userId);
    if (res.ok) toast.success(`تمت إزالة ${name}`);
    else toast.error("تعذر إزالة هذا الحساب");
  }

  return (
    <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
      {list.length === 0 ? (
        <li className="px-3 py-6 text-center text-sm text-muted">لا يوجد أعضاء بعد.</li>
      ) : (
        list.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={m.name} src={m.photoUrl} size="sm" online={m.online} verified={m.verified} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.isAdmin ? <span className="ms-2 text-[10px] text-primary">مالك</span> : null}
              </p>
              <p className="truncate text-[11px] text-muted">{m.city || "بدون مدينة"}</p>
            </div>
            {m.isAdmin ? null : (
              <Button
                size="icon"
                variant="ghost"
                className="size-10 text-danger"
                aria-label={`إزالة ${m.name}`}
                disabled={kick.isPending}
                onClick={() => void remove(m.userId, m.name)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))
      )}
    </ul>
  );
}

function ReportsPane({ enabled }: { enabled: boolean }) {
  const reports = useAdminReports(enabled);
  const { closeReport } = useBqMutations();
  const list = reports.data ?? [];

  return (
    <ul className="mt-3 space-y-2">
      {list.length === 0 ? (
        <li className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted">
          لا بلاغات
        </li>
      ) : (
        list.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-elevated p-3">
            <p className="text-sm">
              <span className="font-medium">{r.reporterName}</span>
              <span className="text-muted"> أبلغ عن </span>
              <span className="font-medium">{r.targetName}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {r.kind === "room" ? "غرفة" : r.kind === "attachment" ? "مرفق" : r.kind === "message" ? "رسالة" : "حساب"}
              {" · "}
              {r.reason}
              {r.status === "closed" ? " · مغلق" : ""}
            </p>
            {r.snippet ? <p className="mt-1 line-clamp-2 text-xs">{r.snippet}</p> : null}
            <p className="mt-1 text-[11px] text-subtle">{formatTime(r.createdAt)}</p>
            {r.status === "open" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.roomId ? (
                  <Link
                    to="/mod/thread"
                    search={{ roomId: r.roomId, reportId: r.id }}
                    className="text-sm text-primary"
                  >
                    فتح الغرفة
                  </Link>
                ) : r.peerA && r.peerB ? (
                  <Link
                    to="/mod/thread"
                    search={{ a: r.peerA, b: r.peerB, reportId: r.id }}
                    className="text-sm text-primary"
                  >
                    فتح المحادثة
                  </Link>
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => closeReport.mutate({ id: r.id, action: "dismiss" })}>
                  حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={() => closeReport.mutate({ id: r.id, action: "delete_message" })}>
                  حذف المحتوى
                </Button>
                <Button size="sm" variant="danger" onClick={() => closeReport.mutate({ id: r.id, action: "remove_user" })}>
                  إزالة
                </Button>
              </div>
            ) : null}
          </li>
        ))
      )}
    </ul>
  );
}

function VerifyPane({ enabled }: { enabled: boolean }) {
  const list = useVerifyRequests(enabled);
  const { decideV } = useBqMutations();
  const rows = list.data ?? [];
  return (
    <ul className="mt-3 space-y-2">
      {rows.length === 0 ? (
        <li className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted">
          لا طلبات توثيق
        </li>
      ) : (
        rows.map((v) => (
          <li key={v.id} className="flex items-center gap-3 rounded-lg border border-border bg-elevated p-3">
            <Avatar name={v.name} src={v.photoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{v.name}</p>
              <p className="truncate text-xs text-muted">{v.note || v.status}</p>
            </div>
            {v.status === "pending" ? (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => decideV.mutate({ id: v.id, accept: true })}>
                  قبول
                </Button>
                <Button size="sm" variant="secondary" onClick={() => decideV.mutate({ id: v.id, accept: false })}>
                  رفض
                </Button>
              </div>
            ) : (
              <span className="text-[11px] text-muted">{v.status === "accepted" ? "موثّق" : "مرفوض"}</span>
            )}
          </li>
        ))
      )}
    </ul>
  );
}

function MailPane({ enabled }: { enabled: boolean }) {
  const list = useAdminMail(enabled);
  const { closeMail } = useBqMutations();
  const rows = list.data ?? [];
  return (
    <ul className="mt-3 space-y-2">
      {rows.length === 0 ? (
        <li className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted">
          لا رسائل
        </li>
      ) : (
        rows.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-elevated p-3">
            <div className="flex items-center gap-2">
              <Avatar name={m.name} src={m.photoUrl} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</p>
              <span className="text-[11px] text-subtle">{formatTime(m.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{m.body}</p>
            {m.status === "open" ? (
              <Button size="sm" className="mt-2" variant="secondary" onClick={() => closeMail.mutate(m.id)}>
                تمت المراجعة
              </Button>
            ) : (
              <p className="mt-2 text-[11px] text-muted">مغلقة</p>
            )}
          </li>
        ))
      )}
    </ul>
  );
}
