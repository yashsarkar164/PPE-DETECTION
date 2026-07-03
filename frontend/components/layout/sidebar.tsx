"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ImageIcon,
  Video,
  Camera,
  Images,
  BarChart3,
  ShieldAlert,
  Settings,
  LogOut,
  HardHat,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "@/lib/api";
import type { UserRole } from "@/lib/types";

const NAV_ITEMS: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["operator", "staff"] },
  { href: "/detect/image", label: "Image Detection", icon: ImageIcon, roles: ["operator", "staff"] },
  { href: "/detect/video", label: "Video Detection", icon: Video, roles: ["operator", "staff"] },
  { href: "/detect/webcam", label: "Live Webcam", icon: Camera, roles: ["operator", "staff"] },
  { href: "/gallery", label: "Gallery", icon: Images, roles: ["operator", "staff"] },
  { href: "/violations", label: "Violations", icon: ShieldAlert, roles: ["operator", "staff"] },
  { href: "/statistics", label: "Statistics", icon: BarChart3, roles: ["operator"] },
  { href: "/users", label: "Manage Staff", icon: Users, roles: ["operator"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["operator", "staff"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
const user = useAuthStore((s) => s.user);
const refreshToken = useAuthStore((s) => s.refreshToken);
const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // best-effort revoke; proceed with local logout regardless
      }
    }
    clearAuth();
    router.push("/login");
  }

  const items = NAV_ITEMS.filter((item) => !user || item.roles.includes(user.role));

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-graphite-800 bg-graphite-900">
      <div className="flex h-16 items-center gap-3 border-b border-graphite-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-safety-yellow">
          <HardHat className="h-5 w-5 text-graphite-950" />
        </div>
        <span className="font-display text-sm font-semibold tracking-wide text-white">SITE COMPLIANCE</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-safety-yellow text-graphite-950"
                  : "text-graphite-300 hover:bg-graphite-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-graphite-800 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-graphite-300 transition-colors hover:bg-safety-orange/10 hover:text-safety-orange"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
