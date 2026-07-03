"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { webcamApi, detectionApi } from "@/lib/api";
import type { WebcamFrameResult } from "@/lib/types";

const SEND_INTERVAL_MS = 300; // ~3-4 fps sent to backend; annotated frame is what's rendered

export function useWebcamDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const frameCountRef = useRef(0);
  const violationCountRef = useRef(0);
  const fpsWindowRef = useRef<number[]>([]);

  const accessToken = useAuthStore((s) => s.accessToken);

  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastResult, setLastResult] = useState<WebcamFrameResult | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const session = await webcamApi.startSession();
      sessionIdRef.current = session.session_id;
      frameCountRef.current = 0;
      violationCountRef.current = 0;
      fpsWindowRef.current = [];

      const apiBase =
  process.env.NEXT_PUBLIC_API_URL ||
  `${window.location.protocol}//${window.location.host}`;

const wsBase = apiBase.replace(/^https?/, (match) =>
  match === "https" ? "wss" : "ws"
);
      const ws = new WebSocket(`${wsBase}/api/webcam/stream/${session.session_id}?token=${accessToken}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnecting(false);
        setActive(true);

        captureCanvasRef.current = document.createElement("canvas");

        sendTimerRef.current = setInterval(() => {
          if (!videoRef.current || ws.readyState !== WebSocket.OPEN) return;
          const canvas = captureCanvasRef.current!;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(videoRef.current, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          ws.send(dataUrl);

          const now = performance.now();
          fpsWindowRef.current.push(now);
          fpsWindowRef.current = fpsWindowRef.current.filter((t) => now - t < 2000);
          setFps(Math.round((fpsWindowRef.current.length / 2) * 10) / 10);
        }, SEND_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        const data: WebcamFrameResult & { error?: string } = JSON.parse(event.data);
        if (data.error) return;
        frameCountRef.current += 1;
        if (data.is_violation) violationCountRef.current += 1;
        setLastResult(data);
      };

      ws.onerror = () => setError("Connection to detection server lost.");
      ws.onclose = () => setActive(false);
    } catch (err: any) {
      setError(err?.message || "Could not access webcam");
      setConnecting(false);
    }
  }, [accessToken]);

  const stop = useCallback(async () => {
    if (sendTimerRef.current) clearInterval(sendTimerRef.current);
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    if (sessionIdRef.current) {
      try {
        await webcamApi.endSession(
          sessionIdRef.current,
          frameCountRef.current,
          violationCountRef.current,
          fpsWindowRef.current.length ? fps : undefined
        );
      } catch {
        // best-effort
      }
    }
    setActive(false);
    setLastResult(null);
    setFps(0);
  }, [fps]);

  const saveSnapshot = useCallback(async () => {
    if (!lastResult) return null;
    // Re-capture current frame from video element for a fresh snapshot upload
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return null;
    const file = new File([blob], `webcam-snapshot-${Date.now()}.jpg`, { type: "image/jpeg" });
    return detectionApi.detectImage(file);
  }, [lastResult]);

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) clearInterval(sendTimerRef.current);
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, active, connecting, lastResult, fps, error, start, stop, saveSnapshot, frameCount: frameCountRef.current, violationCount: violationCountRef.current };
}
