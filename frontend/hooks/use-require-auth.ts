"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/** Redirects to /login if no access token is present. Returns hydration-safe ready state. */
export function useRequireAuth() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace("/login");
  }, [hydrated, accessToken, router]);

  return { ready: hydrated && !!accessToken, user };
}
