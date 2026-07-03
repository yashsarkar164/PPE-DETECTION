"use client";

import { useRef, useState } from "react";
import { UploadCloud, Download, Save, Loader2, Video as VideoIcon, RotateCcw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ViolationCard } from "@/components/detection/violation-card";
import { AuthenticatedVideo } from "@/components/detection/authenticated-media";
import { DetectedObjectsList } from "@/components/detection/detected-objects-list";
import { detectionApi, galleryApi, mediaUrl } from "@/lib/api";
import type { VideoDetectionResponse } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { toast } from "sonner";

export default function VideoDetectionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VideoDetectionResponse | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setSaved(false);
    setUploadPct(0);
  }

  async function runDetection() {
    if (!file) return;
    setProcessing(true);
    try {
      const res = await detectionApi.detectVideo(file, setUploadPct);
      setResult(res);
      if (res.detection.is_violation) {
        toast.warning(`Violations found: missing ${res.detection.missing_ppe.join(", ")}`);
      } else {
        toast.success("Compliant — no violations detected across the video");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Video detection failed");
    } finally {
      setProcessing(false);
    }
  }

  async function saveToGallery() {
    if (!result) return;
    try {
      await galleryApi.save(result.media_asset_id);
      setSaved(true);
      toast.success("Saved to gallery");
    } catch {
      toast.error("Failed to save to gallery");
    }
  }

  function reset() {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setSaved(false);
    setUploadPct(0);
  }

  return (
    <div>
      <Header title="Video Detection" description="Upload footage to check PPE compliance frame-by-frame" />

      <div className="space-y-6 p-6">
        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 transition-colors ${
              dragActive ? "border-safety-yellow bg-safety-yellow/5" : "border-graphite-700 hover:border-graphite-600"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-graphite-500" />
            <p className="mt-4 text-sm font-medium text-white">Drop a video here, or click to browse</p>
            <p className="mt-1 text-xs text-graphite-500">MP4, AVI, MOV, or MKV — large files may take a while</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/avi,video/quicktime,video/x-matroska"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {file && !result && (
          <Card className="bg-graphite-900 border-graphite-800">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4">
                <video src={previewUrl!} controls className="max-h-96 rounded-md border border-graphite-800" />
                {processing && (
                  <div className="w-full max-w-sm space-y-1">
                    <Progress value={uploadPct} />
                    <p className="text-center text-xs text-graphite-500">
                      {uploadPct < 100 ? `Uploading… ${uploadPct}%` : "Running YOLO detection on video — this can take a minute…"}
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button onClick={runDetection} disabled={processing}>
                    {processing ? <><Loader2 className="animate-spin" /> Processing…</> : <><VideoIcon /> Run Detection</>}
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={processing}>
                    <RotateCcw /> Choose Different Video
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-6">
            {result.detection.is_violation && (
              <ViolationCard missingPpe={result.detection.missing_ppe} confidence={result.detection.violation_confidence} />
            )}

            <Card className="bg-graphite-900 border-graphite-800">
              <CardHeader><CardTitle className="text-white">Processed Video</CardTitle></CardHeader>
              <CardContent>
                <AuthenticatedVideo src={mediaUrl(result.processed_url)} controls className="w-full rounded-md border border-graphite-800" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="bg-graphite-900 border-graphite-800 lg:col-span-2">
                <CardHeader><CardTitle className="text-white">Classes Observed</CardTitle></CardHeader>
                <CardContent>
                  <DetectedObjectsList objects={result.detection.detected_objects} />
                </CardContent>
              </Card>

              <Card className="bg-graphite-900 border-graphite-800">
                <CardHeader><CardTitle className="text-white">Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-graphite-400">Max persons/frame</span><span className="font-mono text-white">{result.detection.person_count}</span></div>
                  <div className="flex justify-between"><span className="text-graphite-400">Processing time</span><span className="font-mono text-white">{formatDuration(result.detection.processing_time_ms)}</span></div>
                  <div className="flex justify-between"><span className="text-graphite-400">Status</span><span className="font-mono text-white capitalize">{result.status}</span></div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={mediaUrl(result.processed_url)} download>
                  <Download /> Download Video
                </a>
              </Button>
              <Button variant="secondary" onClick={saveToGallery} disabled={saved}>
                <Save /> {saved ? "Saved to Gallery" : "Save to Gallery"}
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw /> New Detection
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
