import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useTranscribe, type ModelSize } from "./api";

export const Route = createFileRoute("/audio-transcriber/")({
  component: AudioTranscriberPage,
});

const MODELS: ModelSize[] = ["tiny", "base", "small", "medium"];
const LANGUAGES = [
  { value: "auto", label: "auto-detect" },
  { value: "en", label: "english" },
  { value: "es", label: "spanish" },
];
const MAX_BYTES = 200 * 1024 * 1024;

function AudioTranscriberPage() {
  const [file, setFile] = useState<File | null>(null);
  const [modelSize, setModelSize] = useState<ModelSize>("base");
  const [language, setLanguage] = useState<string>("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcribe = useTranscribe();

  const acceptFile = (candidate: File | undefined | null) => {
    if (!candidate) return;
    if (candidate.size > MAX_BYTES) {
      setValidationError("File exceeds the 200 MB limit.");
      return;
    }
    setValidationError(null);
    setFile(candidate);
    transcribe.reset();
  };

  const onTranscribe = () => {
    if (!file) return;
    transcribe.mutate({ file, model_size: modelSize, language });
  };

  const result = transcribe.data;

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Media · 09
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">Audio transcriber</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Drop an audio or video file; get text + .srt subtitles via local Whisper
          (faster-whisper). First run downloads the model (~140 MB for base).
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Model</span>
          <select
            value={modelSize}
            onChange={(e) => setModelSize(e.target.value as ModelSize)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="model-select"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="language-select"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          "border border-dashed rounded-sm px-8 py-10 text-center cursor-pointer transition-colors",
          isDragging ? "border-accent bg-accent-soft" : "border-border hover:border-muted",
        ].join(" ")}
        data-testid="audio-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,.mp3,.m4a,.wav,.webm,.mp4,.mkv,.ogg,.opus,.flac,.aac,.mov"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0])}
          data-testid="audio-file-input"
        />
        {file ? (
          <p className="font-mono text-sm text-fg" data-testid="audio-selected-file">
            {file.name}
            <span className="text-subtle ml-2">{formatSize(file.size)}</span>
          </p>
        ) : (
          <p className="font-mono text-sm text-muted">
            drag an audio / video file here, or click to choose
          </p>
        )}
      </div>

      {validationError ? (
        <p className="font-mono text-xs text-error" role="alert">{validationError}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTranscribe}
          disabled={!file || transcribe.isPending}
          className="px-5 py-2 bg-accent text-bg font-mono text-sm tracking-tight rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="audio-transcribe-button"
        >
          {transcribe.isPending ? "transcribing…" : "transcribe"}
        </button>
        {transcribe.isError ? (
          <span className="font-mono text-xs text-error" role="alert">
            {(transcribe.error as Error).message}
          </span>
        ) : null}
      </div>

      {result ? (
        <section className="space-y-4 border border-border rounded-sm p-4 bg-surface/30" data-testid="transcription-result">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="uppercase tracking-[0.2em] text-accent">{result.language}</span>
            <span className="text-subtle">·</span>
            <span className="text-muted">{formatDuration(result.duration)}</span>
            <span className="text-subtle">·</span>
            <span className="text-muted">{result.segments.length} segments</span>
            <span className="ml-auto flex gap-2">
              <DownloadButton text={result.text} filename="transcription.txt" mime="text/plain" label=".txt" />
              <DownloadButton text={result.srt} filename="transcription.srt" mime="application/x-subrip" label=".srt" />
              <CopyButton text={result.text} />
            </span>
          </div>
          <pre className="bg-bg border border-border rounded-sm p-3 font-serif text-sm text-fg whitespace-pre-wrap max-h-[24rem] overflow-auto">
            {result.text}
          </pre>
        </section>
      ) : null}
    </article>
  );
}

function DownloadButton({ text, filename, mime, label }: { text: string; filename: string; mime: string; label: string }) {
  const onClick = () => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 border border-border hover:border-accent font-mono text-[11px] rounded-sm"
      data-testid={`audio-download-${label}`}
    >
      {label}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 border border-border hover:border-accent font-mono text-[11px] rounded-sm"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
