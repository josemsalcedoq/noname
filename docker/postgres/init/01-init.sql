-- Runs once on first container start (when the data volume is empty).
-- To re-run: `docker compose down -v` to drop the volume, then `up` again.
-- Add tables here as utilities introduce persistent state.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Example: youtube downloader job log (uncomment when utility 03 is wired up).
-- CREATE TABLE youtube_jobs (
--     id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     url         TEXT NOT NULL,
--     mode        TEXT NOT NULL,        -- 'video' | 'audio-only'
--     quality     TEXT NOT NULL,
--     status      TEXT NOT NULL,        -- 'pending' | 'running' | 'done' | 'error' | 'cancelled'
--     file_path   TEXT,
--     error       TEXT,
--     started_at  TIMESTAMPTZ DEFAULT NOW(),
--     finished_at TIMESTAMPTZ
-- );
