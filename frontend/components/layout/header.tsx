"use client";

import { useAuthStore } from "@/lib/auth-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function Header({ title, description }: { title: string; description?: string }) {
  const user = useAuthStore((s) => s.user);
  const initials = (user?.full_name || user?.username || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-graphite-800 bg-graphite-950/60 px-6 backdrop-blur">
      <div>
        <h1 className="font-display text-lg font-semibold text-white">{title}</h1>
        {description && <p className="text-xs text-graphite-400">{description}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={user?.role === "operator" ? "default" : "secondary"} className="uppercase tracking-wide">
          {user?.role}
        </Badge>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{user?.full_name || user?.username}</div>
          <div className="text-xs text-graphite-400">@{user?.username}</div>
        </div>
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
