import axios, { AxiosError } from "axios";
import { useAuthStore } from "./auth-store";
import type {
  AuthTokens,
  DashboardStats,
  DetectionResult,
  GalleryListResponse,
  ImageDetectionResponse,
  StatisticsResponse,
  User,
  VideoDetectionResponse,
  ViolationListResponse,
} from "./types";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  timeout: 120_000, // video processing can take a while
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, try a single refresh-and-retry; otherwise clear auth and redirect to login.
let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, setAuth, clearAuth, user } = useAuthStore.getState();
    if (!refreshToken) {
      clearAuth();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      await new Promise<void>((resolve) => pendingQueue.push(resolve));
      return api(original);
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post<AuthTokens>(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/refresh`,
        { refresh_token: refreshToken }
      );
      setAuth(data.access_token, data.refresh_token, data.user ?? user!);
      pendingQueue.forEach((resolve) => resolve());
      pendingQueue = [];
      return api(original);
    } catch (refreshError) {
      clearAuth();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthTokens>("/api/auth/login", { username, password }).then((r) => r.data),
  me: () => api.get<User>("/api/auth/me").then((r) => r.data),
  logout: (refreshToken: string) => api.post("/api/auth/logout", { refresh_token: refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/api/auth/change-password", { current_password: currentPassword, new_password: newPassword }),
};

export const detectionApi = {
  detectImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ImageDetectionResponse>("/api/detection/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  detectVideo: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<VideoDetectionResponse>("/api/detection/video", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      })
      .then((r) => r.data);
  },
  history: (limit = 50, offset = 0) =>
    api.get<DetectionResult[]>("/api/detection/history", { params: { limit, offset } }).then((r) => r.data),
};

export const webcamApi = {
  startSession: () => api.post<{ session_id: string; started_at: string }>("/api/webcam/session/start").then((r) => r.data),
  endSession: (sessionId: string, frameCount: number, violationCount: number, avgFps?: number) =>
    api.post(`/api/webcam/session/${sessionId}/end`, {
      frame_count: frameCount,
      violation_count: violationCount,
      avg_fps: avgFps,
    }),
};

export const galleryApi = {
  list: (params: {
    source_type?: string;
    search?: string;
    violations_only?: boolean;
    page?: number;
    page_size?: number;
  }) => api.get<GalleryListResponse>("/api/gallery", { params }).then((r) => r.data),
  save: (mediaAssetId: string) => api.post(`/api/gallery/${mediaAssetId}/save`),
  delete: (mediaAssetId: string) => api.delete(`/api/gallery/${mediaAssetId}`),
};

export const statisticsApi = {
  dashboard: () => api.get<DashboardStats>("/api/statistics/dashboard").then((r) => r.data),
  full: () => api.get<StatisticsResponse>("/api/statistics").then((r) => r.data),
};

export const violationsApi = {
  list: (params: { source_type?: string; reviewed?: boolean; page?: number; page_size?: number }) =>
    api.get<ViolationListResponse>("/api/violations", { params }).then((r) => r.data),
  review: (id: string, reviewed: boolean, notes?: string) =>
    api.patch(`/api/violations/${id}/review`, { reviewed, notes }),
};

export const usersApi = {
  list: () => api.get<User[]>("/api/users").then((r) => r.data),
  create: (payload: { username: string; password: string; full_name?: string; role: string }) =>
    api.post<User>("/api/users", payload).then((r) => r.data),
  update: (id: string, payload: { full_name?: string; is_active?: boolean; role?: string }) =>
    api.patch<User>(`/api/users/${id}`, payload).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/users/${id}`),
};

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  const base = process.env.NEXT_PUBLIC_API_URL || "";
  return `${base}${path}`;
}
