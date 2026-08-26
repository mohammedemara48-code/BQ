import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/**
 * Legacy URL. Must NEVER start a call — Android back / notification
 * history used to remount this page and place a brand-new ringing call.
 */
export const Route = createFileRoute("/call/$peerId")({
  validateSearch: (s: Record<string, unknown>): { kind: "audio" | "video" } => ({
    kind: s.kind === "video" ? "video" : "audio",
  }),
  component: CallPage,
});

function CallPage() {
  const { user, isPending } = useCurrentUserState();
  const { peerId } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    void navigate({ to: "/chat/$peerId", params: { peerId }, replace: true });
  }, [user, peerId, navigate]);

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;
  return <div className="min-h-dvh bg-bg" />;
}
