// Shared types mirroring backend/api/schemas.py

export type UserRole = "operator" | "staff";
export type DetectionSource = "image" | "video" | "webcam";
export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface User {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface DetectedObject {
  class: string;
  confidence: number;
  bbox?: [number, number, number, number];
  occurrences?: number;
}

export interface DetectionResult {
  id: string;
  media_asset_id: string | null;
  source_type: DetectionSource;
  detected_objects: DetectedObject[];
  missing_ppe: string[];
  is_violation: boolean;
  violation_confidence: number | null;
  person_count: number;
  processing_time_ms: number | null;
  model_version: string | null;
  processed_by: string;
  created_at: string;
}

export interface ImageDetectionResponse {
  media_asset_id: string;
  detection: DetectionResult;
  original_url: string;
  processed_url: string;
}

export interface VideoDetectionResponse {
  media_asset_id: string;
  detection: DetectionResult;
  original_url: string;
  processed_url: string;
  status: ProcessingStatus;
}

export interface MediaAsset {
  id: string;
  source_type: DetectionSource;
  original_filename: string;
  status: ProcessingStatus;
  original_url: string;
  processed_url: string | null;
  uploaded_by: string;
  uploader_name?: string | null;
  created_at: string;
  is_violation?: boolean | null;
}

export interface GalleryListResponse {
  items: MediaAsset[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardStats {
  total_images_processed: number;
  total_videos_processed: number;
  total_webcam_sessions: number;
  compliance_percentage: number;
  violation_count: number;
  recent_activity: DetectionResult[];
}

export interface TrendPoint {
  label: string;
  total_detections: number;
  violation_count: number;
  compliance_percentage: number;
}

export interface CommonViolation {
  item: string;
  count: number;
}

export interface StatisticsResponse {
  daily: TrendPoint[];
  weekly: TrendPoint[];
  monthly: TrendPoint[];
  most_common_violations: CommonViolation[];
  total_images_processed: number;
  total_videos_processed: number;
  average_processing_time_ms: number;
}

export interface Violation {
  id: string;
  detection_result_id: string;
  media_asset_id: string | null;
  missing_ppe: string[];
  confidence: number | null;
  source_type: DetectionSource;
  reviewed: boolean;
  reported_by: string;
  created_at: string;
}

export interface ViolationListResponse {
  items: Violation[];
  total: number;
  page: number;
  page_size: number;
}

export interface WebcamFrameResult {
  detected_objects: DetectedObject[];
  missing_ppe: string[];
  is_violation: boolean;
  violation_confidence: number | null;
  person_count: number;
  processing_time_ms: number;
  annotated_frame_base64: string;
}
