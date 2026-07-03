"use client";

import { useEffect, useState } from "react";
import { Search, Download, Trash2, ShieldAlert, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { galleryApi, mediaUrl } from "@/lib/api";
import { AuthenticatedImage, AuthenticatedVideo } from "@/components/detection/authenticated-media";
import type { MediaAsset } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 12;

function GalleryGrid({ sourceType }: { sourceType: "image" | "video" }) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await galleryApi.list({
        source_type: sourceType,
        search: search || undefined,
        violations_only: violationsOnly,
        page,
        page_size: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, violationsOnly, sourceType]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item permanently?")) return;
    try {
      await galleryApi.delete(id);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-500" />
          <Input
            placeholder="Search by filename or uploader…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-graphite-900 border-graphite-700"
          />
        </form>
        <div className="flex items-center gap-2">
          <Switch id="violations-only" checked={violationsOnly} onCheckedChange={(v) => { setViolationsOnly(v); setPage(1); }} />
          <Label htmlFor="violations-only" className="text-sm text-graphite-300">Violations only</Label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-graphite-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-graphite-500">No items found. Save some detection results to see them here.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden bg-graphite-900 border-graphite-800">
              <div className="relative aspect-video bg-graphite-950">
                {sourceType === "image" ? (
                  <AuthenticatedImage src={mediaUrl(item.processed_url || item.original_url)} alt={item.original_filename} className="h-full w-full object-cover" />
                ) : (
                  <AuthenticatedVideo src={mediaUrl(item.processed_url || item.original_url)} className="h-full w-full object-cover" />
                )}
                {item.is_violation && (
                  <Badge variant="destructive" className="absolute left-2 top-2">
                    <ShieldAlert className="mr-1 h-3 w-3" /> Violation
                  </Badge>
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <p className="truncate text-sm font-medium text-white">{item.original_filename}</p>
                <div className="flex items-center justify-between text-xs text-graphite-500">
                  <span>{item.uploader_name || "Unknown"}</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <a href={mediaUrl(item.processed_url || item.original_url)} download>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 hover:border-safety-orange hover:text-safety-orange" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
  );
}

export default function GalleryPage() {
  return (
    <div>
      <Header title="Gallery" description="Saved detection results — images and videos" />
      <div className="p-6">
        <Tabs defaultValue="image">
          <TabsList>
            <TabsTrigger value="image">Images</TabsTrigger>
            <TabsTrigger value="video">Videos</TabsTrigger>
          </TabsList>
          <TabsContent value="image"><GalleryGrid sourceType="image" /></TabsContent>
          <TabsContent value="video"><GalleryGrid sourceType="video" /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
