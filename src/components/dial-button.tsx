import { useState, type ReactNode } from "react";
import { beginOutgoingCall } from "@/lib/bq/start-call";
import type { CallKind } from "@/lib/bq/call-store";

export function DialButton({
  peerId,
  peerName,
  peerPhoto,
  kind,
  className,
  children,
  "aria-label": label,
}: {
  peerId: string;
  peerName?: string;
  peerPhoto?: string;
  kind: CallKind;
  className?: string;
  children: ReactNode;
  "aria-label": string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void beginOutgoingCall({ peerId, peerName, peerPhoto, kind }).finally(() => {
          setBusy(false);
        });
      }}
    >
      {children}
    </button>
  );
}
