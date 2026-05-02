import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { consumeHandoff } from "../../lib/handoff";
import { downloadResult, useTranslateSrt, type Lang } from "./api";

export const Route = createFileRoute("/srt-translator/")({
  component: SrtTranslatorPage,
});

const LANGS: Lang[] = ["en", "es"];
const MAX_BYTES = 5 * 1024 * 1024;

function SrtTranslatorPage() {
  const [source, setSource] = useState<Lang>("en");
  const [target, setTarget] = useState<Lang>("es");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const translate = useTranslateSrt();
  const handoffConsumed = useRef(false);

  useEffect(() => {
    if (handoffConsumed.current) return;
    const handoff = consumeHandoff("srt");
    if (!handoff) return;
    handoffConsumed.current = true;
    if (handoff.source === "en" || handoff.source === "es") setSource(handoff.source);
    if (handoff.target === "en" || handoff.target === "es") setTarget(handoff.target);
    const blob = new Blob([handoff.content], { type: "application/x-subrip" });
    const incoming = new File([blob], handoff.filename ?? "transcription.srt", {
      type: "application/x-subrip",
    });
    setFile(incoming);
    setValidationError(null);
    translate.reset();
  }, [translate]);

  const acceptFile = (candidate: File | undefined | null) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".srt")) {
      setValidationError("Only .srt files are supported.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setValidationError("File exceeds the 5 MB limit.");
      return;
    }
    setValidationError(null);
    setFile(candidate);
    translate.reset();
  };

  const onSubmit = async () => {
    if (!file) return;
    if (source === target) {
      setValidationError("Source and target must differ.");
      return;
    }
    const result = await translate.mutateAsync({ file, source, target });
    downloadResult(result);
  };

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Translation · 08
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">SRT subtitles</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Drop a <span className="font-mono text-fg">.srt</span> file; download the
          translated copy with timestamps preserved. Same NMT engine as the text /
          DOCX translators — runs offline.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr]">
        <LangSelect label="From" value={source} onChange={setSource} />
        <div className="self-end pb-2 text-center text-accent font-mono text-lg select-none">→</div>
        <LangSelect label="To" value={target} onChange={setTarget} />
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
          "border border-dashed rounded-sm px-8 py-12 text-center cursor-pointer transition-colors",
          isDragging ? "border-accent bg-accent-soft" : "border-border hover:border-muted",
        ].join(" ")}
        data-testid="srt-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".srt"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0])}
          data-testid="srt-file-input"
        />
        {file ? (
          <p className="font-mono text-sm text-fg" data-testid="srt-selected-file">
            {file.name}
            <span className="text-subtle ml-2">{(file.size / 1024).toFixed(0)} kB</span>
          </p>
        ) : (
          <p className="font-mono text-sm text-muted">
            drag a <span className="text-accent">.srt</span> here, or click to choose
          </p>
        )}
      </div>

      {validationError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!file || translate.isPending}
          className="px-5 py-2 bg-accent text-bg font-mono text-sm tracking-tight rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="srt-translate-button"
        >
          {translate.isPending ? "translating…" : "translate & download"}
        </button>
        {translate.isError ? (
          <span className="font-mono text-xs text-error" role="alert">
            {(translate.error as Error).message}
          </span>
        ) : null}
        {translate.isSuccess ? (
          <span className="font-mono text-xs text-success">downloaded</span>
        ) : null}
      </div>
    </article>
  );
}

function LangSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Lang;
  onChange: (value: Lang) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Lang)}
        className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        data-testid={`srt-${label.toLowerCase()}-select`}
      >
        {LANGS.map((lang) => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>
    </label>
  );
}
