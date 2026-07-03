"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, ShieldOff } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { statisticsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { StatisticsResponse } from "@/lib/types";

const CHART_COLORS = { yellow: "#F5C300", orange: "#E8590C", gray: "#565D6D" };

function TrendChart({ data }: { data: StatisticsResponse["daily"] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.yellow} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS.yellow} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillViolation" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.orange} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#282C34" />
        <XAxis dataKey="label" stroke="#7A8194" fontSize={12} />
        <YAxis stroke="#7A8194" fontSize={12} />
        <Tooltip contentStyle={{ background: "#131519", border: "1px solid #282C34", borderRadius: 8, color: "#fff" }} />
        <Legend />
        <Area type="monotone" dataKey="total_detections" name="Total Detections" stroke={CHART_COLORS.yellow} fill="url(#fillTotal)" strokeWidth={2} />
        <Area type="monotone" dataKey="violation_count" name="Violations" stroke={CHART_COLORS.orange} fill="url(#fillViolation)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function StatisticsPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    statisticsApi
      .full()
      .then(setStats)
      .catch((err) => {
        if (err?.response?.status === 403) setForbidden(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (user && user.role !== "operator") {
    return (
      <div>
        <Header title="Statistics" />
        <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <ShieldOff className="h-10 w-10 text-graphite-600" />
          <p className="text-sm text-graphite-400">System analytics are restricted to operators.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Statistics" description="Compliance trends and detection analytics" />
      <div className="space-y-6 p-6">
        {loading && (
          <div className="flex items-center gap-2 text-graphite-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        )}

        {forbidden && <p className="text-sm text-safety-orange">You don&apos;t have permission to view system analytics.</p>}

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="bg-graphite-900 border-graphite-800">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-graphite-400">Total Images Processed</p>
                  <p className="mt-2 font-display text-2xl font-bold text-white">{stats.total_images_processed}</p>
                </CardContent>
              </Card>
              <Card className="bg-graphite-900 border-graphite-800">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-graphite-400">Total Videos Processed</p>
                  <p className="mt-2 font-display text-2xl font-bold text-white">{stats.total_videos_processed}</p>
                </CardContent>
              </Card>
              <Card className="bg-graphite-900 border-graphite-800">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-graphite-400">Avg. Processing Time</p>
                  <p className="mt-2 font-display text-2xl font-bold text-white">{stats.average_processing_time_ms.toFixed(0)}ms</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-graphite-900 border-graphite-800">
              <CardHeader><CardTitle className="text-white">Detection & Violation Trend</CardTitle></CardHeader>
              <CardContent>
                <Tabs defaultValue="daily">
                  <TabsList>
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="weekly">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  </TabsList>
                  <TabsContent value="daily"><TrendChart data={stats.daily} /></TabsContent>
                  <TabsContent value="weekly"><TrendChart data={stats.weekly} /></TabsContent>
                  <TabsContent value="monthly"><TrendChart data={stats.monthly} /></TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="bg-graphite-900 border-graphite-800">
                <CardHeader><CardTitle className="text-white">Compliance Percentage (Daily)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={stats.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#282C34" />
                      <XAxis dataKey="label" stroke="#7A8194" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="#7A8194" fontSize={12} />
                      <Tooltip contentStyle={{ background: "#131519", border: "1px solid #282C34", borderRadius: 8, color: "#fff" }} />
                      <Line type="monotone" dataKey="compliance_percentage" name="Compliance %" stroke={CHART_COLORS.yellow} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-graphite-900 border-graphite-800">
                <CardHeader><CardTitle className="text-white">Most Common Violations</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.most_common_violations} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#282C34" />
                      <XAxis type="number" stroke="#7A8194" fontSize={12} />
                      <YAxis type="category" dataKey="item" stroke="#7A8194" fontSize={12} width={100} />
                      <Tooltip contentStyle={{ background: "#131519", border: "1px solid #282C34", borderRadius: 8, color: "#fff" }} />
                      <Bar dataKey="count" name="Occurrences" fill={CHART_COLORS.orange} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
