import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { findPerson, useMe, usePeople } from "@/lib/bq/hooks";
import { startCall } from "@/lib/bq/call-store";

export const Route = createFileRoute("/call/$peerId")({
  validateSearch: (s: Record<string, unknown>): { kind: "audio" | "video" } => ({
    kind: s.kind === "video" ? "video" : "audio",
  }),
  component: CallPage,
});

function CallPage() {
  const { user, isPending } = useCurrentUserState();
  const { peerId } = Route.useParams();
  const { kind } = Route.useSearch();
  const navigate = useNavigate();
  const people = usePeople();
  const me = useMe();
  const person = findPerson(people.data, me.data, peerId);

  useEffect(() => {
    if (!user) return;
    startCall({
      peerId,
      kind,
      peerName: person?.name,
      peerPhoto: person?.photoUrl,
    });
    void navigate({ to: "/chat/$peerId", params: { peerId } });
  }, [user, peerId, kind, person?.name, person?.photoUrl, navigate]);

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;
  return <div className="min-h-dvh bg-bg" />;
}
