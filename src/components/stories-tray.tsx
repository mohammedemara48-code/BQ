import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { useBqMutations, useMe, usePeople, useStories } from "@/lib/bq/hooks";
import { uploadMedia } from "@/lib/bq/upload";
import type { Story } from "@/lib/bq/types";

export function StoriesTray() {
  const stories = useStories();
  const people = usePeople();
  const me = useMe();
  const { postStory, dropStory } = useBqMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState<Story[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const by = new Map<string, Story[]>();
    for (const s of stories.data ?? []) {
      const list = by.get(s.userId) ?? [];
      list.push(s);
      by.set(s.userId, list);
    }
    return [...by.entries()];
  }, [stories.data]);

  const mine = groups.find(([id]) => id === me.data?.userId);
  const others = groups.filter(([id]) => id !== me.data?.userId);
  const byId = new Map((people.data ?? []).map((p) => [p.userId, p]));

  async function add(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const url = await uploadMedia(file, isVideo ? "video" : "image");
      await postStory.mutateAsync({ type: isVideo ? "video" : "image", fileUrl: url });
      toast.success("نُشرت الحالة");
    } catch {
      toast.error("تعذر نشر الحالة");
    } finally {
      setBusy(false);
    }
  }

  function open(list: Story[]) {
    setViewer(list);
    setIdx(0);
  }

  const current = viewer?.[idx];

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted">الحالات</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <span className="relative">
            <Avatar name={me.data?.name ?? "أنت"} src={me.data?.photoUrl} size="md" />
            <span className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full bg-primary text-primary-fg ring-2 ring-bg">
              <Plus className="size-3" />
            </span>
          </span>
          <span className="w-full truncate text-center text-xs text-muted">
            {busy ? "رفع…" : "صورة/فيديو"}
          </span>
        </button>
        {mine ? (
          <StoryChip
            name="أنت"
            photo={me.data?.photoUrl}
            onClick={() => open(mine[1])}
            live
            hasVideo={mine[1].some((s) => s.type === "video")}
          />
        ) : null}
        {others.map(([id, list]) => {
          const p = byId.get(id);
          return (
            <StoryChip
              key={id}
              name={p?.name ?? "عضو"}
              photo={p?.photoUrl}
              onClick={() => open(list)}
              live
              hasVideo={list.some((s) => s.type === "video")}
            />
          );
        })}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => void add(e.target.files?.[0])}
      />

      {current && viewer ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg">
          <div className="flex gap-1 px-3 pt-3">
            {viewer.map((s, i) => (
              <span key={s.id} className="h-1 flex-1 rounded-full bg-elevated">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: i < idx ? "100%" : i === idx ? "100%" : "0%" }}
                />
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-medium">
              {current.userId === me.data?.userId
                ? "حالتي"
                : byId.get(current.userId)?.name ?? "حالة"}
            </p>
            <button
              type="button"
              className="grid size-11 place-items-center"
              onClick={() => setViewer(null)}
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>
          <button
            type="button"
            className="flex flex-1 items-center justify-center px-4"
            onClick={() => {
              if (idx + 1 < viewer.length) setIdx(idx + 1);
              else setViewer(null);
            }}
          >
            {current.type === "video" && current.fileUrl ? (
              <video src={current.fileUrl} autoPlay controls playsInline className="max-h-[70dvh] rounded-xl" />
            ) : current.fileUrl ? (
              <img src={current.fileUrl} alt="" className="max-h-[70dvh] rounded-xl object-contain" />
            ) : (
              <p className="font-display text-2xl">{current.text}</p>
            )}
          </button>
          <div className="flex gap-2 px-4 pb-8">
            {current.userId === me.data?.userId ? (
              <Button
                className="flex-1"
                variant="secondary"
                disabled={dropStory.isPending}
                onClick={() => {
                  const id = current.id;
                  void dropStory.mutateAsync(id).then(() => {
                    toast.success("تم حذف الحالة");
                    const next = (viewer ?? []).filter((s) => s.id !== id);
                    if (next.length === 0) setViewer(null);
                    else {
                      setViewer(next);
                      setIdx((i) => Math.min(i, next.length - 1));
                    }
                  });
                }}
              >
                <Trash2 className="size-4" />
                حذف
              </Button>
            ) : null}
            <Button className="flex-1" variant="secondary" onClick={() => setViewer(null)}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StoryChip({
  name,
  photo,
  onClick,
  live,
  hasVideo,
}: {
  name: string;
  photo?: string;
  onClick: () => void;
  live?: boolean;
  hasVideo?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
      <span className={live ? "rounded-full bg-primary p-[2px]" : ""}>
        <span className="relative">
          <Avatar name={name} src={photo} size="md" />
          {hasVideo ? (
            <span className="absolute bottom-0 end-0 rounded bg-bg/80 px-1 text-[9px] text-primary">فيديو</span>
          ) : null}
        </span>
      </span>
      <span className="w-full truncate text-center text-xs text-muted">{name}</span>
    </button>
  );
}
