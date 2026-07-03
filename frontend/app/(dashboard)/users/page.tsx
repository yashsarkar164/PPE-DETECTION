"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldOff, Trash2, UserCog, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usersApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { User, UserRole } from "@/lib/types";
import { toast } from "sonner";

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "staff" as UserRole });

  async function load() {
    setLoading(true);
    try {
      setUsers(await usersApi.list());
    } catch (err: any) {
      if (err?.response?.status !== 403) toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await usersApi.create(form);
      toast.success("Account created");
      setDialogOpen(false);
      setForm({ username: "", password: "", full_name: "", role: "staff" });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(u: User) {
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update account");
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`Remove ${u.username}? This cannot be undone.`)) return;
    try {
      await usersApi.delete(u.id);
      toast.success("Account removed");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to remove account");
    }
  }

  if (currentUser && currentUser.role !== "operator") {
    return (
      <div>
        <Header title="Manage Staff" />
        <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <ShieldOff className="h-10 w-10 text-graphite-600" />
          <p className="text-sm text-graphite-400">Staff management is restricted to operators.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Manage Staff" description="Create and manage operator/staff accounts" />
      <div className="space-y-4 p-6">
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus /> New Account</Button>
            </DialogTrigger>
            <DialogContent className="bg-graphite-900 border-graphite-800">
              <DialogHeader>
                <DialogTitle className="text-white">Create Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input required minLength={3} value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="bg-graphite-950 border-graphite-700" />
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="bg-graphite-950 border-graphite-700" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="bg-graphite-950 border-graphite-700" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                    <SelectTrigger className="bg-graphite-950 border-graphite-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create Account"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-graphite-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <Card key={u.id} className="bg-graphite-900 border-graphite-800">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-safety-yellow font-display font-bold text-graphite-950">
                      {(u.full_name || u.username)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{u.full_name || u.username} {u.id === currentUser?.id && <span className="text-xs text-graphite-500">(you)</span>}</p>
                      <p className="text-xs text-graphite-500">@{u.username}</p>
                    </div>
                    <Badge className="capitalize" variant={u.role === "operator" ? "default" : "secondary"}>{u.role}</Badge>
                    {!u.is_active && <Badge variant="destructive">Deactivated</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} disabled={u.id === currentUser?.id} />
                      <span className="text-xs text-graphite-400">Active</span>
                    </div>
                    <Button size="icon" variant="outline" className="hover:border-safety-orange hover:text-safety-orange" onClick={() => handleDelete(u)} disabled={u.id === currentUser?.id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
