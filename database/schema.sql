-- ============================================================================
-- PPE Detection Management System — PostgreSQL Schema
-- ============================================================================
-- Run with: psql -U <user> -d <database> -f schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('operator', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE detection_source AS ENUM ('image', 'video', 'webcam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- USERS
-- Added directly via DB — no registration endpoint exists in the app.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt hash
    full_name       VARCHAR(150),
    role            user_role NOT NULL DEFAULT 'staff',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ----------------------------------------------------------------------------
-- MEDIA ASSETS
-- Represents an uploaded image or video (webcam sessions log frames separately).
-- storage_provider / storage_key are designed for a clean swap to S3 later:
-- local -> file path relative to backend/uploads; s3 -> object key.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_assets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type         detection_source NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    storage_provider     VARCHAR(20) NOT NULL DEFAULT 'local',   -- 'local' | 's3'
    original_storage_key VARCHAR(500) NOT NULL,                  -- path/key of original file
    result_storage_key   VARCHAR(500),                           -- path/key of processed output
    thumbnail_storage_key VARCHAR(500),
    mime_type           VARCHAR(100),
    file_size_bytes     BIGINT,
    status              processing_status NOT NULL DEFAULT 'pending',
    processing_time_ms  INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media_assets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_source_type ON media_assets(source_type);
CREATE INDEX IF NOT EXISTS idx_media_status ON media_assets(status);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media_assets(created_at DESC);

-- ----------------------------------------------------------------------------
-- WEBCAM SESSIONS
-- One row per "Start Camera" -> "Stop Camera" session. Individual frame
-- detections roll up into detection_results with source_type='webcam' and
-- webcam_session_id set.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webcam_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    frame_count     INTEGER NOT NULL DEFAULT 0,
    violation_count INTEGER NOT NULL DEFAULT 0,
    avg_fps         NUMERIC(6,2)
);

CREATE INDEX IF NOT EXISTS idx_webcam_sessions_user ON webcam_sessions(user_id);

-- ----------------------------------------------------------------------------
-- DETECTION RESULTS
-- One row per inference run: one per image, one per processed video, or one
-- per (optionally sampled) webcam frame. detected_objects / missing_ppe are
-- stored as JSONB for flexibility across model versions.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS detection_results (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_asset_id      UUID REFERENCES media_assets(id) ON DELETE CASCADE,
    webcam_session_id   UUID REFERENCES webcam_sessions(id) ON DELETE CASCADE,
    processed_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type         detection_source NOT NULL,

    -- Raw model output: [{ "class": "Hardhat", "confidence": 0.94, "bbox": [x1,y1,x2,y2] }, ...]
    detected_objects    JSONB NOT NULL DEFAULT '[]',

    -- Derived: which required PPE classes were NOT found for detected persons
    missing_ppe         JSONB NOT NULL DEFAULT '[]',

    is_violation        BOOLEAN NOT NULL DEFAULT FALSE,
    violation_confidence NUMERIC(5,4),      -- confidence of the triggering NO-* detection
    person_count        INTEGER NOT NULL DEFAULT 0,

    processing_time_ms  INTEGER,
    model_version        VARCHAR(100),       -- e.g. filename/hash of iocl_ppe.pt used

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detection_media ON detection_results(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_detection_webcam_session ON detection_results(webcam_session_id);
CREATE INDEX IF NOT EXISTS idx_detection_processed_by ON detection_results(processed_by);
CREATE INDEX IF NOT EXISTS idx_detection_is_violation ON detection_results(is_violation);
CREATE INDEX IF NOT EXISTS idx_detection_created_at ON detection_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_source_type ON detection_results(source_type);

-- ----------------------------------------------------------------------------
-- VIOLATIONS
-- Denormalized, queryable log specifically for the Violations review page.
-- Populated whenever a detection_result has is_violation = TRUE.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS violations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detection_result_id UUID NOT NULL REFERENCES detection_results(id) ON DELETE CASCADE,
    media_asset_id      UUID REFERENCES media_assets(id) ON DELETE CASCADE,
    reported_by         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    missing_ppe         JSONB NOT NULL DEFAULT '[]',   -- e.g. ["Hardhat", "Mask"]
    confidence          NUMERIC(5,4),
    source_type         detection_source NOT NULL,
    reviewed            BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violations_created_at ON violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_reviewed ON violations(reviewed);
CREATE INDEX IF NOT EXISTS idx_violations_reported_by ON violations(reported_by);

-- ----------------------------------------------------------------------------
-- GALLERY SAVES
-- Explicit "Save to Gallery" action (upload alone doesn't guarantee a gallery
-- entry, matching the spec's separate "Save Result to Gallery" button).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gallery_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_asset_id  UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    saved_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (media_asset_id)
);

-- ----------------------------------------------------------------------------
-- REFRESH TOKENS (JWT refresh token tracking / revocation)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_media_updated_at ON media_assets;
CREATE TRIGGER trg_media_updated_at BEFORE UPDATE ON media_assets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Convenience view: daily aggregate stats for the Statistics dashboard
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW daily_detection_stats AS
SELECT
    date_trunc('day', dr.created_at) AS day,
    dr.source_type,
    COUNT(*)                                   AS total_detections,
    COUNT(*) FILTER (WHERE dr.is_violation)    AS violation_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE NOT dr.is_violation) / NULLIF(COUNT(*), 0), 2
    ) AS compliance_percentage,
    ROUND(AVG(dr.processing_time_ms), 2)       AS avg_processing_time_ms
FROM detection_results dr
GROUP BY 1, 2
ORDER BY 1 DESC;
