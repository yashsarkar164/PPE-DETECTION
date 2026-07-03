"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Moon, Sun, UserCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
const refreshToken = useAuthStore((s) => s.refreshToken);
const clearAuth = useAuthStore((s) => s.clearAuth);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme-dark");
    const isDark = stored !== "false";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme(checked: boolean) {
    setDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
    localStorage.setItem("theme-dark", String(checked));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setChanging(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to change password");
    } finally {
      setChanging(false);
    }
  }

  async function handleLogout() {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {}
    }
    clearAuth();
    router.push("/login");
  }

  return (
    <div>
      <Header title="Settings" description="Manage your profile and preferences" />
      <div className="max-w-2xl space-y-6 p-6">
        <Card className="bg-graphite-900 border-graphite-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><UserCircle className="h-4 w-4 text-safety-yellow" /> Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-graphite-400">Username</span><span className="text-white">{user?.username}</span></div>
            <div className="flex justify-between text-sm"><span className="text-graphite-400">Full name</span><span className="text-white">{user?.full_name || "—"}</span></div>
            <div className="flex justify-between text-sm items-center"><span className="text-graphite-400">Role</span><Badge className="capitalize">{user?.role}</Badge></div>
          </CardContent>
        </Card>

        <Card className="bg-graphite-900 border-graphite-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><KeyRound className="h-4 w-4 text-safety-yellow" /> Change Password</CardTitle>
            <CardDescription>Choose a strong password you haven&apos;t used elsewhere.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="bg-graphite-950 border-graphite-700" />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="bg-graphite-950 border-graphite-700" />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-graphite-950 border-graphite-700" />
              </div>
              <Button type="submit" disabled={changing}>{changing ? "Updating…" : "Update Password"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-graphite-900 border-graphite-800">
          <CardHeader><CardTitle className="text-white">Appearance</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-graphite-300">
                {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {darkMode ? "Dark Mode" : "Light Mode"}
              </div>
              <Switch checked={darkMode} onCheckedChange={toggleTheme} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-safety-orange/30 bg-safety-orange/5">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-medium text-white">Sign out</p>
              <p className="text-xs text-graphite-400">End your session on this device.</p>
            </div>
            <Button variant="destructive" onClick={handleLogout}><LogOut className="h-4 w-4" /> Logout</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
