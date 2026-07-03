"use client";

import { useState } from "react";
import { Camera, CameraOff, Save, Gauge, Users, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ViolationCard } from "@/components/detection/violation-card";
import { DetectedObjectsList } from "@/components/detection/detected-objects-list";
import { useWebcamDetection } from "@/hooks/use-webcam-detection";
import { toast } from "sonner";

export default function WebcamDetectionPage() {
  const { videoRef, active, connecting, lastResult, fps, error, start, stop, saveSnapshot } = useWebcamDetection();
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  async function handleSnapshot() {
    setSavingSnapshot(true);
    try {
      const res = await saveSnapshot();
      if (res) toast.success("Snapshot saved — view it in the Gallery or Image Detection results.");
    } catch {
      toast.error("Failed to save snapshot");
    } finally {
      setSavingSnapshot(false);
    }
  }

  return (
    <div>
      <Header title="Live Webcam Detection" description="Real-time PPE compliance monitoring from your camera" />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Camera feed */}
          <Card className="bg-graphite-900 border-graphite-800 lg:col-span-2">
            <CardContent className="p-4">
              <div className="relative aspect-video overflow-hidden rounded-md bg-graphite-950">
                {/* Raw camera preview (hidden once we're streaming annotated frames back) */}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`h-full w-full object-contain ${active && lastResult ? "hidden" : ""}`}
                />
                {active && lastResult && (
                  <img
                    src={lastResult.annotated_frame_base64}
                    alt="Live detection feed"
                    className="h-full w-full object-contain"
                  />
                )}

                {!active && !connecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-graphite-500">
                    <Camera className="h-10 w-10" />
                    <p className="mt-2 text-sm">Camera is off</p>
                  </div>
                )}

                {connecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-graphite-300">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="mt-2 text-sm">Connecting to camera and detection server…</p>
                  </div>
                )}

                {active && (
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <Badge variant="destructive" className="animate-pulse-warn">● LIVE</Badge>
                    <Badge variant="outline" className="border-graphite-600 bg-graphite-950/70 text-white">
                      <Gauge className="mr-1 h-3 w-3" /> {fps} FPS
                    </Badge>
                    {lastResult && (
                      <Badge variant="outline" className="border-graphite-600 bg-graphite-950/70 text-white">
                        <Users className="mr-1 h-3 w-3" /> {lastResult.person_count}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {error && <p className="mt-3 text-sm text-safety-orange">{error}</p>}

              <div className="mt-4 flex flex-wrap gap-3">
                {!active ? (
                  <Button onClick={start} disabled={connecting}>
                    <Camera /> Start Camera
                  </Button>
                ) : (
                  <Button onClick={stop} variant="destructive">
                    <CameraOff /> Stop Camera
                  </Button>
                )}
                <Button variant="secondary" onClick={handleSnapshot} disabled={!active || !lastResult || savingSnapshot}>
                  <Save /> {savingSnapshot ? "Saving…" : "Save Snapshot"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live detection info panel */}
          <div className="space-y-4">
            {lastResult?.is_violation && (
              <ViolationCard missingPpe={lastResult.missing_ppe} confidence={lastResult.violation_confidence} />
            )}

            <Card className="bg-graphite-900 border-graphite-800">
              <CardHeader><CardTitle className="text-white">Detected Objects</CardTitle></CardHeader>
              <CardContent>
                {lastResult ? (
                  <DetectedObjectsList objects={lastResult.detected_objects} />
                ) : (
                  <p className="text-sm text-graphite-500">Start the camera to begin live detection.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-graphite-900 border-graphite-800">
              <CardHeader><CardTitle className="text-white">Session Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-graphite-400">Status</span><span className={active ? "text-emerald-400" : "text-graphite-500"}>{active ? "Streaming" : "Idle"}</span></div>
                <div className="flex justify-between"><span className="text-graphite-400">Frame rate</span><span className="font-mono text-white">{fps} FPS</span></div>
                {lastResult && (
                  <div className="flex justify-between"><span className="text-graphite-400">Last frame latency</span><span className="font-mono text-white">{lastResult.processing_time_ms}ms</span></div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
