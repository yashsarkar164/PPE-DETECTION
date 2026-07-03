"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HardHat, Lock, User as UserIcon, ShieldAlert } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login(username, password);
      setAuth(data.access_token, data.refresh_token, data.user);
      toast.success(`Welcome back, ${data.user.full_name || data.user.username}`);
      router.push("/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Login failed. Check your credentials.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-graphite-950">
      {/* Left: brand panel with hazard-stripe signature */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-graphite-900 p-12">
        <div className="absolute inset-x-0 top-0 h-3 hazard-stripe" />
        <div className="absolute inset-x-0 bottom-0 h-3 hazard-stripe" />

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-safety-yellow">
            <HardHat className="h-6 w-6 text-graphite-950" />
          </div>
          <span className="font-display text-xl font-semibold tracking-wide text-white">SITE COMPLIANCE</span>
        </div>

        <div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-5xl font-bold leading-[1.05] text-white"
          >
            Every worker,
            <br />
            <span className="text-safety-yellow">verified compliant.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 max-w-md text-graphite-300"
          >
            Real-time hardhat, mask, and safety-vest detection across images, video,
            and live camera feeds — built for the floor, not the boardroom.
          </motion.p>
        </div>

        <div className="flex items-center gap-2 text-xs text-graphite-400">
          <ShieldAlert className="h-4 w-4 text-safety-orange" />
          Restricted access. Authorized personnel only.
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-safety-yellow">
              <HardHat className="h-5 w-5 text-graphite-950" />
            </div>
            <span className="font-display text-lg font-semibold text-white">SITE COMPLIANCE</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-white">Sign in</h2>
          <p className="mt-1 text-sm text-graphite-400">Enter your credentials to access the console.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-graphite-200">Username</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-500" />
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 bg-graphite-900 border-graphite-700 text-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-graphite-200">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-500" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-graphite-900 border-graphite-700 text-white"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-safety-orange/40 bg-safety-orange/10 px-3 py-2 text-sm text-safety-orange">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-graphite-500">
            Accounts are provisioned by an operator. Contact your site administrator if you need access.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
