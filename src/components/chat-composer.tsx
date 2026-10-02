import {
  Eye,
  EyeOff,
  FileUp,
  ImagePlus,
  Mic,
  Paperclip,
  Send,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadMedia } from "@/lib/bq/upload";
import type { MsgType } from "@/lib/bq/types";
import { cn, formatDuration } from "@/lib/utils";

type Draft = {
  type: MsgType;
  url: string;
  name: string;
  durationSec: number;
};

export function ChatComposer({
  onSend,
  busy,
}: {
  onSend: (d: {
    text: string;
    type: MsgType;
    fileUrl?: string | null;
    durationSec?: number;
    viewOnce?: boolean;
  }) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rec, setRec] = useState<"off" | "on">("off");
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const discard = useRef(false);

  useEffect(() => {
    if (rec !== "on") return;
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started.current) / 1000));
    }, 200);
    return () => window.clearInterval(t);
  }, [rec]);

  async function pick(kind: "image" | "video" | "file", file: File | undefined) {
    setMenu(false);
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file, kind === "file" ? "file" : kind);
      setDraft({
        type: kind === "image" ? "image" : kind === "video" ? "video" : "file",
        url,
        name: file.name,
        durationSec: 0,
      });
    } catch {
      toast.error("تعذر رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  async function startRec() {
    setMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recoder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24000 });
      chunks.current = [];
      discard.current = false;
      recoder.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recoder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discard.current) {
          discard.current = false;
          setRec("off");
          setElapsed(0);
          return;
        }
        const blob = new Blob(chunks.current, { type: recoder.mimeType || "audio/webm" });
        const dur = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        setRec("off");
        setUploading(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, {
            type: (blob.type || "audio/webm").split(";")[0],
          });
          const url = await uploadMedia(file, "audio");
          setDraft({ type: "voice", url, name: "صوت", durationSec: dur });
        } catch {
          toast.error("تعذر رفع التسجيل");
        } finally {
          setUploading(false);
          setElapsed(0);
        }
      };
      media.current = recoder;
      started.current = Date.now();
      setElapsed(0);
      setRec("on");
      recoder.start(1000);
    } catch {
      toast.error("الميكروفون غير متاح");
    }
  }

  function stopRec() {
    media.current?.stop();
  }

  function cancelRec() {
    discard.current = true;
    media.current?.stop();
  }

  async function sendDraft() {
    if (!draft || busy || uploading) return;
    const d = draft;
    setDraft(null);
    const once = viewOnce && (d.type === "image" || d.type === "video");
    setViewOnce(false);
    await onSend({
      text: d.name,
      type: d.type,
      fileUrl: d.url,
      durationSec: d.durationSec,
      viewOnce: once,
    });
  }

  async function sendText() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    await onSend({ text: t, type: "text" });
  }

  const blocked = busy || uploading;

  return (
    <div className="border-t border-border bg-surface px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {uploading ? (
        <p className="mb-2 px-2 text-xs text-muted">جاري الرفع…</p>
      ) : null}

      {draft ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-elevated px-3 py-2">
          {draft.type === "image" ? (
            <img src={draft.url} alt="" className="size-12 rounded-md object-cover" />
          ) : draft.type === "video" ? (
            <video src={draft.url} className="size-12 rounded-md object-cover" />
          ) : draft.type === "voice" ? (
            <span className="font-display text-lg font-semibold tabular-nums text-primary">
              {formatDuration(draft.durationSec)}
            </span>
          ) : (
            <span className="truncate text-sm">{draft.name}</span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {draft.type === "image"
              ? "صورة"
              : draft.type === "video"
                ? "فيديو"
                : draft.type === "voice"
                  ? "رسالة صوتية"
                  : "ملف"}
          </span>
          {(draft.type === "image" || draft.type === "video") ? (
            <button
              type="button"
              onClick={() => setViewOnce((v) => !v)}
              aria-label={viewOnce ? "إلغاء عرض مرة" : "عرض مرة واحدة"}
              className={cn(
                "grid size-11 place-items-center rounded-full",
                viewOnce ? "bg-primary text-primary-fg" : "bg-bg text-muted",
              )}
              title="عرض مرة واحدة"
            >
              {viewOnce ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          ) : null}
          <button type="button" onClick={() => setDraft(null)} aria-label="حذف" className="grid size-11 place-items-center">
            <Trash2 className="size-4 text-danger" />
          </button>
          <Button size="sm" disabled={blocked} onClick={() => void sendDraft()}>
            {viewOnce && (draft.type === "image" || draft.type === "video") ? "مرة واحدة" : "إرسال"}
          </Button>
        </div>
      ) : null}

      {rec === "on" ? (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-elevated px-3 py-3">
          <span className="size-2.5 animate-pulse rounded-full bg-danger" />
          <span className="text-[11px] font-medium tracking-widest text-danger">REC</span>
          <span className="font-display text-2xl tabular-nums tracking-wide">
            {formatDuration(elapsed)}
          </span>
          <div className="flex h-7 min-w-0 flex-1 items-end gap-0.5">
            {Array.from({ length: 22 }).map((_, i) => (
              <span
                key={i}
                className="flex-1 rounded-full bg-primary/80"
                style={{ height: `${28 + ((i * 17 + elapsed * 13) % 72)}%` }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={cancelRec}
            className="grid size-11 place-items-center rounded-full bg-bg text-muted"
            aria-label="إلغاء"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={stopRec}
            className="grid size-12 place-items-center rounded-full bg-danger text-primary-fg"
            aria-label="إيقاف"
          >
            <Square className="size-4 fill-current" />
          </button>
        </div>
      ) : null}

      {menu ? (
        <div className="mb-2 grid grid-cols-3 gap-2">
          <AttachBtn icon={ImagePlus} label="صورة" onClick={() => photoRef.current?.click()} />
          <AttachBtn icon={Video} label="فيديو" onClick={() => videoRef.current?.click()} />
          <AttachBtn icon={FileUp} label="ملف" onClick={() => fileRef.current?.click()} />
        </div>
      ) : null}

      {rec === "on" ? null : (
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void sendText();
          }}
        >
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void pick("image", e.target.files?.[0])}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => void pick("video", e.target.files?.[0])}
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => void pick("file", e.target.files?.[0])}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="إرفاق"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X className="size-5" /> : <Paperclip className="size-5" />}
          </Button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="رسالة"
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm outline-none focus:border-primary/70"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="رسالة صوتية"
            onClick={() => void startRec()}
            disabled={blocked}
          >
            <Mic className="size-5" />
          </Button>
          <Button type="submit" size="icon" disabled={!text.trim() || blocked} aria-label="إرسال">
            <Send className="size-4 rtl:-scale-x-100" />
          </Button>
        </form>
      )}
    </div>
  );
}

function AttachBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ImagePlus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1 rounded-lg bg-elevated text-xs text-muted",
      )}
    >
      <Icon className="size-5 text-fg" />
      {label}
    </button>
  );
}
