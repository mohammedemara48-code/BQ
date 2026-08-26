import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, Map, MessageCircle, Phone, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { BqWordmark } from "@/components/bq-mark";
import { AdminPanel } from "@/components/admin-panel";
import { CallsTab } from "@/components/calls-tab";
import { ChatsTab } from "@/components/chats-tab";
import { CompleteProfile } from "@/components/complete-profile";
import { BqSplash, LoginForm } from "@/components/login-form";
import { MapTab } from "@/components/map-tab";
import { NoticeBell } from "@/components/notice-bell";
import { PeopleTab } from "@/components/people-tab";
import { ProfileTab } from "@/components/profile-tab";
import { AndroidInstallPage, InstallDock } from "@/components/pwa-register";
import { Button } from "@/components/ui/button";
import { rememberAccount, hasBearerToken } from "@/lib/bq/accounts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAdminBadge, useBqMutations, useChats, useMe, usePeople, useRequests } from "@/lib/bq/hooks";
import { wantsAndroidInstall } from "@/lib/bq/pwa";
import { isProfileComplete } from "@/lib/bq/types";
import { cn, normalizeSerial } from "@/lib/utils";

export type Tab = "chats" | "people" | "calls" | "me" | "map" | "admin";

type HomeSearch = {
  tab: Tab;
  install?: boolean;
  platform?: string;
  s?: string;
};

function isInstallFlag(value: unknown): boolean {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (typeof value === "string" && value.replaceAll('"', "") === "1") return true;
  return false;
}

function parseTab(value: unknown): Tab {
  if (
    value === "people" ||
    value === "calls" ||
    value === "me" ||
    value === "map" ||
    value === "admin" ||
    value === "chats"
  ) {
    return value;
  }
  return "chats";
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const next: HomeSearch = { tab: parseTab(search.tab) };
    if (isInstallFlag(search.install)) next.install = true;
    if (typeof search.platform === "string" && search.platform.replaceAll('"', "").length > 0) {
      next.platform = search.platform.replaceAll('"', "");
    }
    if (typeof search.s === "string" && search.s.trim()) next.s = search.s.trim();
    return next;
  },
  component: Home,
});

function Home() {
  const { user, isPending } = useCurrentUserState();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const installMode = wantsAndroidInstall(search);
  const [waited, setWaited] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const t = window.setTimeout(() => setWaited(true), 2800);
    return () => window.clearTimeout(t);
  }, []);
  const signedIn = Boolean(user) && !isPending && !installMode;
  const people = usePeople(signedIn);
  useChats(signedIn);
  const me = useMe(signedIn);
  const badge = useAdminBadge(signedIn && Boolean(me.data?.isAdmin));
  const tab = search.tab === "admin" && !me.data?.isAdmin ? "chats" : search.tab;
  const adminCount = (badge.data?.reports ?? 0) + (badge.data?.verify ?? 0) + (badge.data?.mail ?? 0);

  useEffect(() => {
    if (!user) return;
    void rememberAccount({
      id: user.id,
      name: me.data?.name || user.displayName,
      email: user.primaryEmail,
      photo: me.data?.photoUrl || user.profileImageUrl,
    });
  }, [user, me.data?.name, me.data?.photoUrl]);

  useEffect(() => {
    if (!search.s || !people.data) return;
    const key = normalizeSerial(search.s);
    const hit =
      people.data.find((p) => p.serial === key || p.serial === search.s) ??
      (me.data && (me.data.serial === key || me.data.serial === search.s) ? me.data : undefined);
    if (hit) {
      void navigate({ to: "/person/$id", params: { id: hit.userId } });
    }
  }, [search.s, people.data, me.data, navigate]);

  if (installMode) {
    return <AndroidInstallPage />;
  }

  if (!user) {
    if (hydrated && isPending && hasBearerToken() && !waited) return <BqSplash />;
    return <LoginForm />;
  }
  if (hydrated && me.isPending && !waited) return <BqSplash />;
  if (!me.data || !isProfileComplete(me.data)) return <CompleteProfile />;

  const admin = Boolean(me.data.isAdmin);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-bg/85 px-4 py-3 backdrop-blur-md">
        <BqWordmark />
        <div className="flex items-center">
          {admin ? (
            <Link
              to="/"
              search={{ tab: "admin" }}
              className={cn(
                "relative grid size-11 place-items-center rounded-lg",
                tab === "admin" ? "text-primary" : "hover:bg-elevated",
              )}
              aria-label="الإدارة"
            >
              <Shield className="size-5" />
              {adminCount > 0 ? (
                <span className="absolute top-1.5 end-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-fg">
                  {adminCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          <NoticeBell />
        </div>
      </header>
      <InstallDock />
      <IncomingBanner />
      <main className="flex-1 pb-24">
        {tab === "chats" ? <ChatsTab /> : null}
        {tab === "people" ? <PeopleTab /> : null}
        {tab === "map" ? <MapTab /> : null}
        {tab === "calls" ? <CallsTab /> : null}
        {tab === "me" ? <ProfileTab /> : null}
        {tab === "admin" && admin ? <AdminPanel enabled /> : null}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className={cn("grid", admin ? "grid-cols-6" : "grid-cols-5")}>
          <NavItem to="chats" icon={MessageCircle} label="محادثات" active={tab === "chats"} />
          <NavItem to="people" icon={Heart} label="الأعضاء" active={tab === "people"} />
          <NavItem to="map" icon={Map} label="الخريطة" active={tab === "map"} />
          <NavItem to="calls" icon={Phone} label="اتصال" active={tab === "calls"} />
          {admin ? (
            <NavItem to="admin" icon={Shield} label="إدارة" active={tab === "admin"} badge={adminCount} />
          ) : null}
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
  badge,
}: {
  to: Tab;
  icon: typeof Heart;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <li>
      <Link
        to="/"
        search={{ tab: to }}
        className={cn(
          "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
          active ? "text-primary" : "text-muted",
        )}
      >
        <Icon className={cn("size-5", active && "fill-primary/20")} />
        {label}
        {badge && badge > 0 ? (
          <span className="absolute top-1 end-2 size-1.5 rounded-full bg-primary" />
        ) : null}
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
        <span className="text-muted"> أرسل طلب متابعة</span>
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
