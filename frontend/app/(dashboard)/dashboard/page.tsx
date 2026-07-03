"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, Video, Camera, ShieldCheck, ShieldAlert, Activity, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statisticsApi } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statisticsApi
      .dashboard()
      .then(setStats)
      .catch(() => setError("Could not load dashboard data. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Header title="Dashboard" description="Live overview of PPE compliance across your site" />

      <div className="space-y-6 p-6">
        {/* Quick upload buttons */}
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/detect/image"><ImageIcon /> Upload Image</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/detect/video"><Video /> Upload Video</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/detect/webcam"><Camera /> Start Webcam</Link>
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-graphite-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
          </div>
        )}

        {error && (
          <Card className="border-safety-orange/40 bg-safety-orange/5">
            <CardContent className="p-4 text-sm text-safety-orange">{error}</CardContent>
          </Card>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Images Processed" value={stats.total_images_processed} icon={ImageIcon} accent="neutral" />
              <StatCard label="Videos Processed" value={stats.total_videos_processed} icon={Video} accent="neutral" />
              <StatCard label="Webcam Sessions" value={stats.total_webcam_sessions} icon={Camera} accent="neutral" />
              <StatCard
                label="PPE Compliance"
                value={`${stats.compliance_percentage}%`}
                icon={ShieldCheck}
                accent="yellow"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="bg-graphite-900 border-graphite-800 lg:col-span-1">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">Violation Count</p>
                      <p className="mt-2 font-display text-3xl font-bold text-safety-orange">{stats.violation_count}</p>
                      <p className="mt-1 text-xs text-graphite-500">Across all detections</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-safety-orange/15 text-safety-orange">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-graphite-900 border-graphite-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="h-4 w-4 text-safety-yellow" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.recent_activity.length === 0 ? (
                    <p className="text-sm text-graphite-500">No detections yet. Upload an image or video to get started.</p>
                  ) : (
                    <ul className="divide-y divide-graphite-800">
                      {stats.recent_activity.map((r) => (
                        <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                          <div className="flex items-center gap-3">
                            <Badge variant={r.is_violation ? "destructive" : "success"} className="capitalize">
                              {r.source_type}
                            </Badge>
                            <span className="text-graphite-300">
                              {r.is_violation ? `Missing: ${r.missing_ppe.join(", ")}` : "Compliant"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-graphite-500">
                            <span className="font-mono">{formatDuration(r.processing_time_ms)}</span>
                            <span>{formatDate(r.created_at)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
