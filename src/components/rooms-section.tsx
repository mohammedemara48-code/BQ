import { Link } from "@tanstack/react-router";
import { DoorOpen, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBqMutations, useRooms } from "@/lib/bq/hooks";
import { formatTime } from "@/lib/utils";

export function RoomsSection() {
  const rooms = useRooms();
  const { makeRoom, enterRoom } = useBqMutations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function create() {
    const n = name.trim();
    if (n.length < 2) return;
    const res = await makeRoom.mutateAsync({ name: n });
    setName("");
    setOpen(false);
    if (res.ok) toast.success("اتفتحت الغرفة");
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">غرف الدردشة</h2>
        <button
          type="button"
          className="text-sm text-primary"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="inline size-4" /> جديدة
        </button>
      </div>
      {open ? (
        <div className="mb-3 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الغرفة"
          />
          <Button size="sm" onClick={() => void create()} disabled={makeRoom.isPending}>
            إنشاء
          </Button>
        </div>
      ) : null}
      {rooms.isPending ? (
        <div className="h-16 animate-pulse rounded-lg bg-elevated" />
      ) : (rooms.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          لا غرف بعد
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {(rooms.data ?? []).map((r) => (
            <li key={r.id}>
              <div className="flex items-center gap-3 px-3 py-3">
                <span className="grid size-11 place-items-center rounded-full bg-elevated text-primary">
                  <Users className="size-5" />
                </span>
                <Link
                  to="/room/$roomId"
                  params={{ roomId: String(r.id) }}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.memberCount} أعضاء
                    {r.lastText ? ` · ${r.lastText}` : ""}
                    {r.lastAt ? ` · ${formatTime(r.lastAt)}` : ""}
                  </span>
                </Link>
                {r.joined ? (
                  <Link to="/room/$roomId" params={{ roomId: String(r.id) }}>
                    <Button size="sm" variant="secondary">
                      دخول
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      void enterRoom.mutateAsync(r.id).then(() => toast.success("Manager يحيكم"));
                    }}
                  >
                    <DoorOpen className="size-4" />
                    انضمام
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
