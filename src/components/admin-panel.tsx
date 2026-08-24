import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { useBqMutations, useMembers } from "@/lib/bq/hooks";

export function AdminPanel({ enabled }: { enabled: boolean }) {
  const members = useMembers(enabled);
  const { kick } = useBqMutations();
  const list = members.data ?? [];
  const people = list.filter((m) => !m.isAdmin);
  const owner = list.find((m) => m.isAdmin);

  async function remove(userId: string, name: string) {
    const ok = window.confirm(`إزالة ${name} من BQ؟ لن يظهر ملفه بعد الآن.`);
    if (!ok) return;
    const res = await kick.mutateAsync(userId);
    if (res.ok) toast.success(`تمت إزالة ${name}`);
    else toast.error("تعذر إزالة هذا الحساب");
  }

  return (
    <section className="mt-8 rounded-xl border border-primary/30 bg-surface p-4">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-primary" />
        <h2 className="font-medium">لوحة الإدارة</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-elevated px-3 py-3">
          <p className="font-display text-xl">{list.length}</p>
          <p className="text-[11px] text-muted">أعضاء</p>
        </div>
        <div className="rounded-lg bg-elevated px-3 py-3">
          <p className="font-display text-xl">{people.filter((p) => p.online).length}</p>
          <p className="text-[11px] text-muted">متصلون الآن</p>
        </div>
      </div>

      {owner ? (
        <p className="mt-4 text-xs text-muted">
          المالك: <span className="text-fg">{owner.name}</span>
        </p>
      ) : null}

      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {members.isPending ? (
          <li className="h-16 animate-pulse bg-elevated" />
        ) : list.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted">لا يوجد أعضاء بعد.</li>
        ) : (
          list.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={m.name} src={m.photoUrl} size="sm" online={m.online} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name}
                  {m.isAdmin ? (
                    <span className="ms-2 text-[10px] font-medium text-primary">مالك</span>
                  ) : null}
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
    </section>
  );
}
