"use client";

/**
 * <img src="..."> and <video src="..."> cannot send an Authorization header,
 * but /api/media/* is protected by HTTPBearer (get_current_user). Fetching
 * through the shared `api` axios instance (which attaches the Bearer token
 * via its request interceptor) and rendering the result as a blob: URL keeps
 * media protected server-side while still displaying correctly.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function useAuthenticatedBlobUrl(src: string | null | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setError(false);
    setBlobUrl(null);

    api
      .get(src, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return { blobUrl, error };
}

interface AuthenticatedMediaProps {
  src: string | null | undefined;
  className?: string;
}

export function AuthenticatedImage({ src, className, alt = "" }: AuthenticatedMediaProps & { alt?: string }) {
  const { blobUrl, error } = useAuthenticatedBlobUrl(src);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-graphite-800 text-xs text-graphite-500", className)}>
        Failed to load image
      </div>
    );
  }
  if (!blobUrl) {
    return <div className={cn("animate-pulse bg-graphite-800", className)} />;
  }
  return <img src={blobUrl} alt={alt} className={className} />;
}

export function AuthenticatedVideo({ src, className, controls = true }: AuthenticatedMediaProps & { controls?: boolean }) {
  const { blobUrl, error } = useAuthenticatedBlobUrl(src);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-graphite-800 text-xs text-graphite-500", className)}>
        Failed to load video
      </div>
    );
  }
  if (!blobUrl) {
    return <div className={cn("animate-pulse bg-graphite-800", className)} />;
  }
  return <video src={blobUrl} controls={controls} className={className} />;
}
