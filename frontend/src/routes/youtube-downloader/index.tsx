import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { setHandoff } from "../../lib/handoff";
import {
  useCancel,
  useJob,
  useProbe,
  useStartDownload,
  type Mode,
  type ProbeResult,
} from "./api";

export const Route = createFileRoute("/youtube-downloader/")({
  component: YoutubeDownloaderPage,
});

const VIDEO_QUALITIES = ["best", "1080p", "720p", "480p"];
const AUDIO_QUALITIES = ["audio-128k", "audio-192k"];

function YoutubeDownloaderPage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [quality, setQuality] = useState<string>("720p");
  const [jobId, setJobId] = useState<string | null>(null);
  const [probed, setProbed] = useState<ProbeResult | null>(null);

  const probe = useProbe();
  const startDownload = useStartDownload();
  const cancel = useCancel();
  const job = useJob(jobId);
  const navigate = useNavigate();

  const onSendToTranscriber = () => {
    if (!jobId) return;
    const filename = job.data?.file_path?.split("/").pop();
    setHandoff({ kind: "yt-to-transcriber", jobId, filename });
    navigate({ to: "/audio-transcriber" });
  };

  const triggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!jobId) return;
    if (job.data?.status !== "done") return;
    if (!job.data.file_path) return;
    if (triggeredRef.current === jobId) return;
    triggeredRef.current = jobId;
    const link = document.createElement("a");
    link.href = `/api/youtube-downloader/file/${jobId}`;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [jobId, job.data?.status, job.data?.file_path]);

  const onProbe = async () => {
    setJobId(null);
    setProbed(null);
    try {
      const result = await probe.mutateAsync(url);
      setProbed(result);
    } catch {
      // surfaced via probe.error
    }
  };

  const onDownload = async () => {
    try {
      const created = await startDownload.mutateAsync({ url, mode, quality });
      setJobId(created.id);
    } catch {
      // surfaced via startDownload.error
    }
  };

  const onCancel = async () => {
    if (!jobId) return;
    await cancel.mutateAsync(jobId);
  };

  const qualityOptions = mode === "audio-only" ? AUDIO_QUALITIES : VIDEO_QUALITIES;
  const isFinal = useMemo(
    () => job.data && ["done", "error", "cancelled"].includes(job.data.status),
    [job.data],
  );

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Media · 03
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">YouTube downloader</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Personal use only. Wraps yt-dlp + ffmpeg locally.
        </p>
      </header>

      <div className="space-y-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="url-input"
          />
        </label>
        <button
          type="button"
          onClick={onProbe}
          disabled={!url || probe.isPending}
          className="px-4 py-2 border border-border hover:border-accent font-mono text-sm rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="probe-button"
        >
          {probe.isPending ? "probing…" : "probe"}
        </button>
        {probe.isError ? (
          <p className="font-mono text-xs text-error" role="alert">{(probe.error as Error).message}</p>
        ) : null}
      </div>

      {probed ? (
        <section className="border border-border rounded-sm p-4 flex gap-4 items-start" data-testid="probe-result">
          {probed.thumbnail ? (
            <img src={probed.thumbnail} alt="thumbnail" className="w-32 h-auto rounded-sm" />
          ) : null}
          <div className="space-y-1 flex-1">
            <p className="font-mono text-sm text-fg" data-testid="probe-title">{probed.title}</p>
            <p className="font-mono text-xs text-muted">
              {probed.uploader} {probed.duration ? `· ${formatDuration(probed.duration)}` : ""}
            </p>
            {probed.available_qualities.length ? (
              <p className="font-mono text-[11px] text-subtle">
                available: {probed.available_qualities.join(", ")}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Mode</span>
          <select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as Mode;
              setMode(next);
              setQuality(next === "audio-only" ? "audio-192k" : "720p");
            }}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="mode-select"
          >
            <option value="video">video</option>
            <option value="audio-only">audio only</option>
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Quality</span>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="quality-select"
          >
            {qualityOptions.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={!url || startDownload.isPending || (job.data?.status === "running")}
          className="px-5 py-2 bg-accent text-bg font-mono text-sm tracking-tight rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="download-button"
        >
          {startDownload.isPending ? "starting…" : "download"}
        </button>
        {job.data?.status === "running" ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-error text-error font-mono text-sm rounded-sm hover:bg-error/10"
            data-testid="cancel-button"
          >
            cancel
          </button>
        ) : null}
      </div>

      {startDownload.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(startDownload.error as Error).message}
        </p>
      ) : null}

      {job.data ? (
        <section className="space-y-2" data-testid="job-status">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="uppercase tracking-[0.2em] text-subtle">
              {job.data.status === "running" && job.data.progress >= 99.9
                ? "finalizing"
                : job.data.status}
            </span>
            <span className="text-muted">{job.data.progress.toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full bg-border rounded-sm overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, job.data.progress)}%` }}
            />
          </div>
          {job.data.status === "done" && job.data.file_path ? (
            <div className="space-y-2">
              <p className="font-mono text-xs text-success" data-testid="job-file">
                ✓ saved to your browser's Downloads folder
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/api/youtube-downloader/file/${jobId}`}
                  download
                  className="font-mono text-[11px] text-subtle hover:text-accent underline-offset-2 hover:underline"
                >
                  download again ↓
                </a>
                <button
                  type="button"
                  onClick={onSendToTranscriber}
                  className="font-mono text-[11px] text-accent hover:underline underline-offset-2"
                  data-testid="send-to-transcriber"
                >
                  send to transcriber →
                </button>
              </div>
            </div>
          ) : null}
          {job.data.status === "error" ? (
            <p className="font-mono text-xs text-error" role="alert">
              {job.data.error}
            </p>
          ) : null}
          {isFinal ? (
            <button
              type="button"
              onClick={() => setJobId(null)}
              className="font-mono text-[11px] text-subtle hover:text-fg"
            >
              clear
            </button>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
