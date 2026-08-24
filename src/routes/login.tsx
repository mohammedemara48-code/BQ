import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { BqSplash, LoginForm } from "@/components/login-form";
import { hasBearerToken } from "@/lib/bq/accounts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 2800);
    return () => window.clearTimeout(t);
  }, []);
  if (!isPending && user) return <Navigate to="/" search={{ tab: "me" }} />;
  if (isPending && hasBearerToken() && !waited) return <BqSplash />;
  return <LoginForm />;
}