import { useEffect } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { heartbeat, signOutPresence } from "@/lib/bq/server";

const INTERVAL_MS = 25_000;

/** Keeps presence truthful: online only while the tab is active. */
export function PresenceHeartbeat() {
  const { user } = useCurrentUserState();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    let timer: number | undefined;

    const beat = () => {
      if (!alive) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void heartbeat().catch(() => undefined);
    };

    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") {
        beat();
        timer = window.setInterval(beat, INTERVAL_MS);
      }
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        window.clearInterval(timer);
        void signOutPresence().catch(() => undefined);
      } else {
        schedule();
      }
    };

    const onUnload = () => {
      try {
        void signOutPresence();
      } catch {
        /* ignore */
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onUnload);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [user?.id]);

  return null;
}
