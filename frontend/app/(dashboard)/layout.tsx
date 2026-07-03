"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-graphite-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-safety-yellow border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-graphite-950">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
