import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Phone, User } from "lucide-react";
import { useEffect, useState } from "react";
import { BqWordmark } from "@/components/bq-mark";
import { CallsTab } from "@/components/calls-tab";
import { ChatsTab } from "@/components/chats-tab";
import { CompleteProfile } from "@/components/complete-profile";
import { BqSplash, LoginForm } from "@/components/login-form";
import { NoticeBell } from "@/components/notice-bell";
import { PeopleTab } from "@/components/people-tab";
import { ProfileTab } from "@/components/profile-tab";
import { AndroidInstallPage } from "@/components/pwa-register";
import { Button } from "@/components/ui/button";
import { rememberAccount, hasBearerToken } from "@/lib/bq/accounts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBqMutations, useChats, useMe, usePeople, useRequests } from "@/lib/bq/hooks";
import { wantsAndroidInstall } from "@/lib/bq/pwa";
import { isProfileComplete } from "@/lib/bq/types";
import { cn } from "@/lib/utils";

export type Tab = "chats" | "people" | "calls" | "me";

type HomeSearch = {
  tab: Tab;
  install?: boolean;
  platform?: string;
};

function isInstallFlag(value: unknown): boolean {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (typeof value === "string" && value.replaceAll('"', "") === "1") return true;
  return false;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const next: HomeSearch = {
      tab:
        search.tab === "people" || search.tab === "calls" || search.tab === "me"
          ? search.tab
          : "chats",
    };
    if (isInstallFlag(search.install)) next.install = true;
    if (typeof search.platform === "string" && search.platform.replaceAll('"', "").length > 0) {
      next.platform = search.platform.replaceAll('"', "");
    }
    return next;
  },
  component: Home,
});

function Home() {
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const { tab } = search;
  const installMode = wantsAndroidInstall(search);
  const [waited, setWaited] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const t = window.setTimeout(() => setWaited(true), 2800);
    return () => window.clearTimeout(t);
  }, []);
  const signedIn = Boolean(user) && !isPending && !installMode;
  usePeople(signedIn);
  useChats(signedIn);
  const me = useMe(signedIn);

  useEffect(() => {
    if (!user) return;
    rememberAccount({
      id: user.id,
      name: me.data?.name || user.displayName,
      email: user.primaryEmail,
      photo: me.data?.photoUrl || user.profileImageUrl,
    });
  }, [user, me.data?.name, me.data?.photoUrl]);

  if (installMode) {
    return <AndroidInstallPage />;
  }

  if (!user) {
    if (hydrated && isPending && hasBearerToken() && !waited) return <BqSplash />;
    return <LoginForm />;
  }
  if (hydrated && me.isPending && !waited) return <BqSplash />;
  if (!me.data || !isProfileComplete(me.data)) return <CompleteProfile />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-bg/85 px-4 py-3 backdrop-blur-md">
        <BqWordmark />
        <NoticeBell />
      </header>
      <IncomingBanner />
      <main className="flex-1 pb-24">
        {tab === "chats" ? <ChatsTab /> : null}
        {tab === "people" ? <PeopleTab /> : null}
        {tab === "calls" ? <CallsTab /> : null}
        {tab === "me" ? <ProfileTab /> : null}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="grid grid-cols-4">
          <NavItem to="chats" icon={MessageCircle} label="المحادثات" active={tab === "chats"} />
          <NavItem to="people" icon={Heart} label="الأشخاص" active={tab === "people"} />
          <NavItem to="calls" icon={Phone} label="المكالمات" active={tab === "calls"} />
          <NavItem to="me" icon={User} label="حسابي" active={tab === "me"} />
        </ul>
      </nav>
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: Tab;
  icon: typeof Heart;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to="/"
        search={{ tab: to }}
        className={cn(
          "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
          active ? "text-primary" : "text-muted",
        )}
      >
        <Icon className={cn("size-5", active && "fill-primary/20")} />
        {label}
      </Link>
    </li>
  );
}

function IncomingBanner() {
  const requests = useRequests();
  const people = usePeople();
  const { respond } = useBqMutations();
  const incoming = (requests.data ?? []).filter(
    (r) => r.direction === "in" && r.status === "pending",
  );
  if (incoming.length === 0) return null;
  const first = incoming[0]!;
  const person = people.data?.find((p) => p.userId === first.fromId);

  return (
    <div className="mx-4 mt-3 rounded-lg border border-primary/30 bg-elevated px-3 py-3">
      <p className="text-sm">
        <span className="font-medium">{person?.name ?? "شخص"}</span>
        <span className="text-muted"> أرسل طلب صداقة</span>
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => respond.mutate({ id: first.id, accept: true })}>
          قبول
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => respond.mutate({ id: first.id, accept: false })}
        >
          رفض
        </Button>
      </div>
    </div>
  );
}
