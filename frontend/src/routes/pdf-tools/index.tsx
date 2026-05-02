import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import {
  downloadBlob,
  useExtractText,
  useMergePdfs,
  useOcrPdf,
  useSplitPdf,
  type ExtractTextResult,
} from "./api";

type PdfTab = "merge" | "split" | "extract" | "ocr";

const TABS: { id: PdfTab; label: string }[] = [
  { id: "merge", label: "Merge" },
  { id: "split", label: "Split" },
  { id: "extract", label: "Extract text" },
  { id: "ocr", label: "OCR" },
];

export const Route = createFileRoute("/pdf-tools/")({
  validateSearch: (search): { tab: PdfTab } => {
    const candidate = (search as Record<string, unknown>).tab;
    const tab = TABS.find((t) => t.id === candidate)?.id ?? "merge";
    return { tab };
  },
  component: PdfToolsPage,
});

function PdfToolsPage() {
  const { tab } = Route.useSearch();

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Documents · 10
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">PDF tools</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Local-only PDF operations: merge files, split by page ranges, extract
          embedded text, and OCR scanned pages with Tesseract.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border" aria-label="PDF tabs">
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            to="/pdf-tools"
            search={{ tab: entry.id }}
            className="px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-subtle hover:text-fg border-b border-transparent"
            activeProps={{
              className:
                "px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-accent border-b border-accent",
            }}
            activeOptions={{ includeSearch: true }}
            data-testid={`pdf-tab-${entry.id}`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <section className="pt-2">
        {tab === "merge" ? <MergeTab /> : null}
        {tab === "split" ? <SplitTab /> : null}
        {tab === "extract" ? <ExtractTab /> : null}
        {tab === "ocr" ? <OcrTab /> : null}
      </section>
    </article>
  );
}

function MergeTab() {
  const [files, setFiles] = useState<File[]>([]);
  const merge = useMergePdfs();
  const inputRef = useRef<HTMLInputElement>(null);

  const onAdd = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".pdf"))]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onRemove = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const onMerge = async () => {
    if (files.length < 2) return;
    const result = await merge.mutateAsync(files);
    downloadBlob(result.blob, result.filename);
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf"
        onChange={(e) => onAdd(e.target.files)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="merge-input"
      />
      {files.length === 0 ? (
        <p className="font-mono text-xs text-subtle">add at least two PDFs</p>
      ) : (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li key={index} className="flex items-center gap-2 font-mono text-xs">
              <span className="text-subtle w-6">{index + 1}.</span>
              <span className="text-fg flex-1 truncate">{file.name}</span>
              <span className="text-subtle">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-subtle hover:text-error"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onMerge}
        disabled={files.length < 2 || merge.isPending}
        className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
        data-testid="merge-button"
      >
        {merge.isPending ? "merging…" : "merge & download"}
      </button>
      {merge.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(merge.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}

function SplitTab() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("1-3,5,7-10");
  const split = useSplitPdf();

  const onSplit = async () => {
    if (!file || !ranges.trim()) return;
    const result = await split.mutateAsync({ file, ranges });
    downloadBlob(result.blob, result.filename);
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="split-input"
      />
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
          Page ranges
        </span>
        <input
          value={ranges}
          onChange={(e) => setRanges(e.target.value)}
          placeholder="e.g. 1-3,5,7-10"
          className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="split-ranges"
        />
      </label>
      <button
        type="button"
        onClick={onSplit}
        disabled={!file || split.isPending}
        className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
        data-testid="split-button"
      >
        {split.isPending ? "splitting…" : "split & download .zip"}
      </button>
      {split.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(split.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}

function ExtractTab() {
  const [file, setFile] = useState<File | null>(null);
  const extract = useExtractText();

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="extract-input"
      />
      <button
        type="button"
        onClick={() => file && extract.mutate(file)}
        disabled={!file || extract.isPending}
        className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
        data-testid="extract-button"
      >
        {extract.isPending ? "extracting…" : "extract text"}
      </button>
      <ResultPanel data={extract.data} error={extract.error as Error | null} />
    </div>
  );
}

function OcrTab() {
  const [file, setFile] = useState<File | null>(null);
  const [languages, setLanguages] = useState("eng+spa");
  const ocr = useOcrPdf();

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="ocr-input"
      />
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
          Languages (Tesseract codes, joined with +)
        </span>
        <input
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          placeholder="eng+spa"
          className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={() => file && ocr.mutate({ file, languages })}
        disabled={!file || ocr.isPending}
        className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
        data-testid="ocr-button"
      >
        {ocr.isPending ? "running OCR…" : "OCR"}
      </button>
      <ResultPanel data={ocr.data} error={ocr.error as Error | null} />
    </div>
  );
}

function ResultPanel({ data, error }: { data: ExtractTextResult | undefined; error: Error | null }) {
  if (error) {
    return (
      <p className="font-mono text-xs text-error" role="alert">
        {error.message}
      </p>
    );
  }
  if (!data) return null;
  return (
    <section className="space-y-2 border border-border rounded-sm p-3 bg-surface/30">
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="text-subtle uppercase tracking-[0.2em]">{data.page_count} pages</span>
        <button
          type="button"
          onClick={() => downloadBlob(new Blob([data.text], { type: "text/plain" }), "extracted.txt")}
          className="px-2 py-1 border border-border hover:border-accent rounded-sm"
        >
          download .txt
        </button>
      </div>
      <pre className="bg-bg border border-border rounded-sm p-3 font-serif text-sm text-fg whitespace-pre-wrap max-h-[24rem] overflow-auto">
        {data.text || <span className="italic text-subtle">no text extracted</span>}
      </pre>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
