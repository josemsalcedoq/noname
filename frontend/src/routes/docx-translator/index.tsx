import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { downloadResult, useTranslateDocx, type Lang } from "./api";

export const Route = createFileRoute("/docx-translator/")({
  component: DocxTranslatorPage,
});

const LANGS: Lang[] = ["en", "es"];
const MAX_BYTES = 25 * 1024 * 1024;

function DocxTranslatorPage() {
  const [source, setSource] = useState<Lang>("en");
  const [target, setTarget] = useState<Lang>("es");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const translate = useTranslateDocx();

  const acceptFile = (candidate: File | undefined | null) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".docx")) {
      setValidationError("Only .docx files are supported.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setValidationError("File exceeds the 25 MB limit.");
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
          Translation · 01
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">DOCX translator</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Upload a Word document; download the translated version with original
          paragraph order preserved. Heavy formatting like inline bold/italic
          collapses to paragraph-level styling in this version.
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
        data-testid="dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0])}
          data-testid="file-input"
        />
        {file ? (
          <p className="font-mono text-sm text-fg" data-testid="selected-file">
            {file.name}
            <span className="text-subtle ml-2">
              {(file.size / 1024).toFixed(0)} kB
            </span>
          </p>
        ) : (
          <p className="font-mono text-sm text-muted">
            drag a <span className="text-accent">.docx</span> here, or click to choose
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
          data-testid="translate-button"
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
        data-testid={`${label.toLowerCase()}-select`}
      >
        {LANGS.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </label>
  );
}
