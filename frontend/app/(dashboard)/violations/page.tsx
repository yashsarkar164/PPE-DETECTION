"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { violationsApi } from "@/lib/api";
import type { Violation } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 15;

export default function ViolationsPage() {
  const [items, setItems] = useState<Violation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reviewedFilter, setReviewedFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await violationsApi.list({
        page,
        page_size: PAGE_SIZE,
        reviewed: reviewedFilter === "all" ? undefined : reviewedFilter === "reviewed",
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load violations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reviewedFilter]);

  async function markReviewed(v: Violation) {
    try {
      await violationsApi.review(v.id, true);
      toast.success("Marked as reviewed");
      load();
    } catch {
      toast.error("Failed to update");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <Header title="Violations" description="Every PPE violation logged across images, videos, and webcam sessions" />
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Select value={reviewedFilter} onValueChange={(v) => { setReviewedFilter(v); setPage(1); }}>
            <SelectTrigger className="w-48 bg-graphite-900 border-graphite-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All violations</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-graphite-500">{total} total</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-graphite-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-graphite-500">No violations found for this filter.</p>
        ) : (
          <div className="space-y-3">
            {items.map((v) => (
              <Card key={v.id} className="border-graphite-800 bg-graphite-900">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-safety-orange" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="destructive" className="capitalize">{v.source_type}</Badge>
                        {v.reviewed ? (
                          <Badge variant="success">Reviewed</Badge>
                        ) : (
                          <Badge variant="outline" className="border-safety-yellow text-safety-yellow">Needs Review</Badge>
                        )}
                        {v.confidence != null && (
                          <span className="text-xs font-mono text-graphite-400">{(v.confidence * 100).toFixed(1)}% confidence</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-white">Missing: {v.missing_ppe.join(", ")}</p>
                      <p className="mt-0.5 text-xs text-graphite-500">{formatDate(v.created_at)}</p>
                    </div>
                  </div>
                  {!v.reviewed && (
                    <Button size="sm" variant="secondary" onClick={() => markReviewed(v)}>
                      <Check className="h-3.5 w-3.5" /> Mark Reviewed
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-graphite-400">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
