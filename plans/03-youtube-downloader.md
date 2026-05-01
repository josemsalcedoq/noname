# 03 — Utility: YouTube Downloader (yt-dlp)

## Goal
Paste a YouTube URL, pick a format (video / audio-only) and quality, download the file locally. Wraps `yt-dlp`. Personal use.

## Why
- Save videos / extract audio for offline reference without browser-extension noise.
- yt-dlp's CLI is powerful but unfriendly — a tiny GUI in front of it is the whole win.

## Legal / scope note
This is a personal-use tool. Do not redistribute downloads. Respect YouTube's ToS — the user is responsible for what they download. No public deployment.

## Inputs / Outputs
- **Input:** a single YouTube URL (video, short, or single-video-from-playlist).
- **Output:** a media file (mp4, mp3, m4a, webm, etc.) saved to a configured download directory; the UI offers a browser download too.

## Functional requirements
- F1. URL input with paste/clear buttons and basic validation (must be `youtube.com` or `youtu.be`).
- F2. "Probe" step: fetch metadata (title, duration, thumbnail, available formats) before download.
- F3. User chooses **mode**: `video` (best video+audio merge) or `audio-only` (extract MP3/M4A).
- F4. User chooses **quality**: `best`, `1080p`, `720p`, `480p`, `audio-128k`, `audio-192k`.
- F5. Real-time progress (percent, ETA, speed) streamed to the UI.
- F6. On success, show a download link to the resulting file and the filesystem path.
- F7. "Cancel" button stops the in-flight job.

## Non-functional requirements
- NF1. Concurrency: only 1 active download at a time (single-user, keep it simple).
- NF2. Files saved under a configurable `DOWNLOAD_DIR` (default: `~/Downloads/noname/`).
- NF3. yt-dlp is invoked as a subprocess; stdout/stderr is parsed for progress, not piped to the user as raw logs.
- NF4. No URL or metadata is logged to disk.

## BDD scenarios

```gherkin
Feature: Download a YouTube video or audio

  Scenario: Probe a valid URL
    Given a valid YouTube URL
    When I click "Probe"
    Then the UI shows title, duration, thumbnail, and available qualities
    And no download starts yet

  Scenario: Download as video at 1080p
    Given a valid URL has been probed
    And I select mode "video" and quality "1080p"
    When I click "Download"
    Then the UI shows a progress bar advancing 0 -> 100%
    And the resulting .mp4 is saved to DOWNLOAD_DIR
    And a download link to that file appears

  Scenario: Download audio-only as MP3
    Given a valid URL
    And I select mode "audio-only" and quality "audio-192k"
    When I click "Download"
    Then the resulting .mp3 is saved to DOWNLOAD_DIR
    And the file's audio bitrate is approximately 192 kbps

  Scenario: Reject non-YouTube URL
    Given the user pastes "https://example.com/foo"
    When the URL is validated
    Then the UI shows "Only YouTube URLs are supported"
    And no probe or download is started

  Scenario: Cancel mid-download
    Given a download is in progress at 30%
    When I click "Cancel"
    Then the yt-dlp process is killed
    And any partial file is removed
    And the UI returns to the idle state

  Scenario: yt-dlp not installed
    Given yt-dlp is missing from the system
    When the user submits a URL
    Then the API returns 500 with error "ytdlp_unavailable"
    And the UI suggests installing it

  Scenario: Age-restricted / unavailable video
    Given a URL that yt-dlp cannot fetch (age gate, region block, removed)
    When the user attempts to probe
    Then the UI surfaces the yt-dlp error reason verbatim (sanitized)
    And no download starts
```

## Out of scope (v1)
- Playlist batch downloads.
- Subtitle extraction / burn-in.
- Other sites (TikTok, Instagram, Twitter) — yt-dlp supports them but kept out for now.
- Format conversion beyond what yt-dlp + ffmpeg do natively.
- Auto-cookie injection for restricted content.

## Tech notes
- **Lib:** `yt-dlp` invoked as a subprocess via `asyncio.create_subprocess_exec` (more cancellable than the Python module). Alternative: `yt_dlp` Python module imported directly — easier, but harder to cancel mid-run.
- **ffmpeg:** required for merging best video+audio and for MP3 conversion. Installed in the backend Docker image.
- **Progress streaming:** parse yt-dlp's `--newline --progress-template` output; push to frontend via **SSE** (one-way, no need for full WebSocket). In Django: an async view returning `StreamingHttpResponse`, served via Daphne (ASGI). Worker reads progress from a Redis pub-sub channel keyed by `jobId`.
- **Backend (Django + DRF):** Django app at `backend/utilities/youtube_downloader/`.
  - `POST /api/youtube-downloader/probe` → `{ url }` returns metadata.
  - `POST /api/youtube-downloader/download` → starts a job, returns `{ jobId }`. Job state stored in Postgres (see `01-init.sql` template).
  - `GET  /api/youtube-downloader/progress/<jobId>` — SSE stream (async view).
  - `POST /api/youtube-downloader/cancel/<jobId>`.
- **Frontend (TanStack):** route at `src/routes/youtube-downloader/`. Use `useMutation` for probe/download/cancel. For SSE progress, use a small `useEventSource` hook that feeds into Query cache via `queryClient.setQueryData(['progress', jobId], ...)` so the progress bar reads from Query like any other state.

## Risks / open questions
- Filename sanitization (special chars, length). Use yt-dlp's `--restrict-filenames` flag.
- Disk space: large videos can fill the disk. Pre-flight check on `DOWNLOAD_DIR` free space vs. probed size.
- Single-job concurrency model — fine for now; revisit if you start queuing.
- ffmpeg presence varies per machine; either bundle a static binary or fail loudly on first run with install instructions.
