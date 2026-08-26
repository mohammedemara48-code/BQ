import { Check, CheckCheck, Eye, Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn, formatDuration, formatTime } from "@/lib/utils";
import type { Message, Receipt, RoomMessage } from "@/lib/bq/types";

export const REPORT_REASONS = ["مزعج", "محتوى غير لائق", "تحرش", "إساءة"] as const;

export function ReceiptMarks({ receipt, seenLabel }: { receipt: Receipt; seenLabel?: boolean }) {
  if (receipt === "seen") {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold text-accent">
        <CheckCheck className="size-4" />
        اتقريت
      </span>
    );
  }
  if (receipt === "delivered") {
    return (
      <span className="inline-flex items-center gap-0.5 font-medium">
        <CheckCheck className="size-4" />
        وصلت
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-medium opacity-90">
      <Check className="size-4" />
      اتبعتت
    </span>
  );
}

export function MessageBody({
  type,
  text,
  fileUrl,
  durationSec,
  hidden,
  onReveal,
}: {
  type: string;
  text: string;
  fileUrl: string | null;
  durationSec: number;
  hidden?: boolean;
  onReveal?: () => void;
}) {
  if (hidden) {
    return (
      <button type="button" className="flex items-center gap-2" onClick={onReveal}>
        <Eye className="size-4" />
        عرض مرة واحدة
      </button>
    );
  }
  if (type === "image" && fileUrl) {
    return <img src={fileUrl} alt="" className="mb-1 max-h-56 rounded-md object-cover" />;
  }
  if (type === "video" && fileUrl) {
    return <video src={fileUrl} controls playsInline className="mb-1 max-h-56 rounded-md" />;
  }
  if (type === "voice" && fileUrl) {
    return (
      <div className="flex items-center gap-2">
        <audio src={fileUrl} controls className="h-10 max-w-[200px]" />
        <span className="text-[10px] tabular-nums opacity-80">{formatDuration(durationSec)}</span>
      </div>
    );
  }
  if (type === "file") {
    return (
      <a href={fileUrl ?? "#"} download={text} className="underline">
        {text || "ملف"}
      </a>
    );
  }
  if (type === "call") {
    return (
      <p className="flex items-center gap-1.5 whitespace-pre-wrap break-words opacity-90">
        <span aria-hidden>📞</span>
        <span>{text || "مكالمة"}</span>
      </p>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{text}</p>;
}

export function ReportMenu({
  onPick,
}: {
  onPick: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className="grid size-8 place-items-center rounded-md text-subtle hover:bg-elevated hover:text-danger"
        aria-label="إبلاغ"
        onClick={() => setOpen(true)}
      >
        <Flag className="size-3.5" />
      </button>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {REPORT_REASONS.map((reason) => (
        <button
          key={reason}
          type="button"
          className="rounded-full bg-elevated px-2 py-1 text-[10px] text-muted hover:text-danger"
          onClick={() => {
            onPick(reason);
            setOpen(false);
            toast.success("وصل البلاغ للإدارة");
          }}
        >
          {reason}
        </button>
      ))}
    </div>
  );
}

export function DmBubble({
  message,
  mine,
  lastSeen,
  onReveal,
  onReport,
}: {
  message: Message;
  mine: boolean;
  lastSeen?: boolean;
  onReveal?: () => void;
  onReport?: (reason: string) => void;
}) {
  const hidden = message.viewOnce && !message.opened && !mine;
  return (
    <div className={cn("flex items-end gap-1", mine ? "justify-start" : "justify-end")}>
      {!mine && onReport ? (
        <ReportMenu
          onPick={(reason) =>
            onReport(reason)
          }
        />
      ) : null}
      <div
        className={cn(
          "max-w-[78%] rounded-lg px-3 py-2 text-sm",
          mine ? "rounded-ss-sm bg-primary text-primary-fg" : "rounded-se-sm bg-elevated text-fg",
        )}
      >
        <MessageBody
          type={message.type}
          text={message.text}
          fileUrl={message.fileUrl}
          durationSec={message.durationSec}
          hidden={hidden}
          onReveal={onReveal}
        />
        <p className={cn("mt-1 flex items-center gap-1 text-[10px]", mine ? "text-primary-fg/80" : "text-subtle")}>
          <span>{formatTime(message.createdAt)}</span>
          {mine ? <ReceiptMarks receipt={message.receipt} seenLabel={lastSeen && message.receipt === "seen"} /> : null}
        </p>
      </div>
      {mine && onReport ? <ReportMenu onPick={(reason) => onReport(reason)} /> : null}
    </div>
  );
}

export function RoomBubble({
  message,
  mine,
  onReport,
  speakerOn,
}: {
  message: RoomMessage;
  mine: boolean;
  onReport?: (reason: string) => void;
  speakerOn?: boolean;
}) {
  if (message.system) {
    return (
      <div className="flex justify-center py-1">
        <p className="rounded-full bg-elevated px-3 py-1 text-center text-[11px] text-muted">
          {message.text}
        </p>
      </div>
    );
  }
  return (
    <div className={cn("flex items-end gap-1", mine ? "justify-start" : "justify-end")}>
      {!mine && onReport ? <ReportMenu onPick={onReport} /> : null}
      <div
        className={cn(
          "max-w-[78%] rounded-lg px-3 py-2 text-sm",
          mine ? "rounded-ss-sm bg-primary text-primary-fg" : "rounded-se-sm bg-elevated text-fg",
        )}
      >
        {!mine ? <p className="mb-1 text-[11px] font-medium opacity-80">{message.senderName}</p> : null}
        <MessageBody
          type={message.type}
          text={message.text}
          fileUrl={message.fileUrl}
          durationSec={message.durationSec}
        />
        {speakerOn && message.type === "voice" && message.fileUrl ? (
          <audio src={message.fileUrl} autoPlay className="hidden" />
        ) : null}
        <p className={cn("mt-1 text-[10px]", mine ? "text-primary-fg/70" : "text-subtle")}>
          {formatTime(message.createdAt)}
        </p>
      </div>
      {mine && onReport ? <ReportMenu onPick={onReport} /> : null}
    </div>
  );
}
