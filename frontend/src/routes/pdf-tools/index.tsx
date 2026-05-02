import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  downloadBlob,
  useAnnotate,
  useDiscoverFields,
  useExtractText,
  useFillForm,
  useMakeSearchable,
  useManipulate,
  useMergePdfs,
  useOcrPdf,
  useSplitPdf,
  useThumbnails,
  type ExtractTextResult,
  type FormField,
  type PageOperation,
  type PdfAnnotation,
} from "./api";

type PdfTab =
  | "merge"
  | "split"
  | "pages"
  | "view"
  | "annotate"
  | "extract"
  | "ocr"
  | "searchable"
  | "form";

const TABS: { id: PdfTab; label: string }[] = [
  { id: "view", label: "View" },
  { id: "annotate", label: "Annotate" },
  { id: "merge", label: "Merge" },
  { id: "split", label: "Split" },
  { id: "pages", label: "Pages" },
  { id: "form", label: "Form fill" },
  { id: "extract", label: "Extract text" },
  { id: "ocr", label: "OCR" },
  { id: "searchable", label: "Searchable" },
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
        {tab === "view" ? <ViewTab /> : null}
        {tab === "annotate" ? <AnnotateTab /> : null}
        {tab === "merge" ? <MergeTab /> : null}
        {tab === "split" ? <SplitTab /> : null}
        {tab === "pages" ? <PagesTab /> : null}
        {tab === "form" ? <FormTab /> : null}
        {tab === "extract" ? <ExtractTab /> : null}
        {tab === "ocr" ? <OcrTab /> : null}
        {tab === "searchable" ? <SearchableTab /> : null}
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

type PageState =
  | { kind: "source"; source: number; rotation: 0 | 90 | 180 | 270; thumbnail: string; id: string }
  | { kind: "blank"; id: string };

function PagesTab() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const thumbnails = useThumbnails();
  const manipulate = useManipulate();

  useEffect(() => {
    if (!file) return;
    setPages([]);
    thumbnails.mutate(file, {
      onSuccess: (data) => {
        setPages(
          data.thumbnails.map((thumb, index) => ({
            kind: "source" as const,
            source: index + 1,
            rotation: 0 as const,
            thumbnail: thumb,
            id: `p${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
          })),
        );
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const move = (index: number, delta: number) => {
    setPages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const rotate = (index: number, delta: 90 | -90) => {
    setPages((prev) =>
      prev.map((p, i) => {
        if (i !== index || p.kind !== "source") return p;
        const next = ((((p.rotation + delta) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
        return { ...p, rotation: next };
      }),
    );
  };

  const remove = (index: number) =>
    setPages((prev) => prev.filter((_, i) => i !== index));

  const insertBlank = (after: number) => {
    const newPage: PageState = { kind: "blank", id: `b-${Math.random().toString(36).slice(2, 8)}` };
    setPages((prev) => {
      const next = [...prev];
      next.splice(after + 1, 0, newPage);
      return next;
    });
  };

  const apply = async () => {
    if (!file || !pages.length) return;
    const operations: PageOperation[] = pages.map((p) =>
      p.kind === "blank" ? { blank: true } : { source: p.source, rotation: p.rotation },
    );
    const result = await manipulate.mutateAsync({ file, operations });
    downloadBlob(result.blob, result.filename);
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="pages-input"
      />

      {thumbnails.isPending ? (
        <p className="font-mono text-xs text-subtle">rendering thumbnails…</p>
      ) : null}
      {thumbnails.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(thumbnails.error as Error).message}
        </p>
      ) : null}

      {pages.length ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="border border-border rounded-sm bg-surface/30 p-2 space-y-2"
                data-testid={`page-card-${index}`}
              >
                <div className="bg-bg flex items-center justify-center min-h-[10rem] overflow-hidden">
                  {page.kind === "source" ? (
                    <img
                      src={page.thumbnail}
                      alt={`page ${page.source}`}
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                      className="max-w-full max-h-[14rem] transition-transform"
                    />
                  ) : (
                    <div className="w-32 h-44 bg-fg/5 border border-dashed border-subtle flex items-center justify-center">
                      <span className="font-mono text-[10px] text-subtle">blank</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-subtle">
                  <span>
                    pos {index + 1}{" "}
                    {page.kind === "source" ? `· src ${page.source}` : "· (blank)"}
                  </span>
                  {page.kind === "source" && page.rotation ? (
                    <span className="text-accent">{page.rotation}°</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="px-1.5 py-1 border border-border hover:border-accent rounded-sm disabled:opacity-30"
                  >
                    ↑ up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === pages.length - 1}
                    className="px-1.5 py-1 border border-border hover:border-accent rounded-sm disabled:opacity-30"
                  >
                    ↓ down
                  </button>
                  {page.kind === "source" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => rotate(index, -90)}
                        className="px-1.5 py-1 border border-border hover:border-accent rounded-sm"
                      >
                        ↺ rot
                      </button>
                      <button
                        type="button"
                        onClick={() => rotate(index, 90)}
                        className="px-1.5 py-1 border border-border hover:border-accent rounded-sm"
                      >
                        ↻ rot
                      </button>
                    </>
                  ) : (
                    <span className="col-span-2 px-1.5 py-1 text-subtle text-center">—</span>
                  )}
                  <button
                    type="button"
                    onClick={() => insertBlank(index)}
                    className="px-1.5 py-1 border border-border hover:border-accent rounded-sm"
                    title="insert blank page after"
                  >
                    + blank
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="px-1.5 py-1 border border-error text-error hover:bg-error/10 rounded-sm"
                  >
                    × delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={apply}
              disabled={!pages.length || manipulate.isPending}
              className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
              data-testid="pages-apply"
            >
              {manipulate.isPending ? "applying…" : "apply & download"}
            </button>
            <span className="font-mono text-[11px] text-subtle">
              {pages.length} page{pages.length === 1 ? "" : "s"} in output
            </span>
            {manipulate.isError ? (
              <span className="font-mono text-[11px] text-error" role="alert">
                {(manipulate.error as Error).message}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SearchableTab() {
  const [file, setFile] = useState<File | null>(null);
  const [languages, setLanguages] = useState("eng+spa");
  const searchable = useMakeSearchable();

  const onRun = async () => {
    if (!file) return;
    const result = await searchable.mutateAsync({ file, languages });
    downloadBlob(result.blob, result.filename);
  };

  return (
    <div className="space-y-4">
      <p className="font-serif italic text-muted text-sm max-w-prose">
        Adds a real text layer to a scanned PDF using <span className="font-mono text-fg">ocrmypdf</span>{" "}
        (skips pages that already have text). Output stays a PDF — searchable in any reader.
      </p>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="searchable-input"
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
        onClick={onRun}
        disabled={!file || searchable.isPending}
        className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
        data-testid="searchable-button"
      >
        {searchable.isPending ? "running ocrmypdf…" : "make searchable & download"}
      </button>
      {searchable.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(searchable.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}

function ViewTab() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<unknown>(null);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setError(null);
    setPageCount(0);
    setCurrentPage(1);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (
          await import("pdfjs-dist/build/pdf.worker.mjs?url")
        ).default;
        const buffer = await file.arrayBuffer();
        const document = await pdfjs.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        pdfRef.current = document;
        setPageCount(document.numPages);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const document = pdfRef.current as
      | { getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> } }> }
      | null;
    if (!document || !canvasRef.current || pageCount === 0) return;
    let cancelled = false;
    (async () => {
      const page = await document.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageCount, scale]);

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="view-input"
      />
      {error ? <p className="font-mono text-xs text-error" role="alert">{error}</p> : null}
      {pageCount > 0 ? (
        <>
          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-border hover:border-accent rounded-sm disabled:opacity-30"
            >
              ← prev
            </button>
            <span className="text-subtle">page</span>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={currentPage}
              onChange={(e) =>
                setCurrentPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))
              }
              className="w-16 bg-bg border border-border text-fg px-2 py-1 rounded-sm focus:border-accent focus:outline-none text-center"
            />
            <span className="text-subtle">of {pageCount}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="px-3 py-1 border border-border hover:border-accent rounded-sm disabled:opacity-30"
            >
              next →
            </button>
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                className="px-2 py-1 border border-border hover:border-accent rounded-sm"
              >
                −
              </button>
              <span className="text-subtle">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3, s + 0.2))}
                className="px-2 py-1 border border-border hover:border-accent rounded-sm"
              >
                +
              </button>
            </span>
          </div>
          <div className="bg-fg/5 border border-border rounded-sm p-3 overflow-auto max-h-[70vh]">
            <canvas ref={canvasRef} className="mx-auto bg-white" />
          </div>
        </>
      ) : null}
    </div>
  );
}

function FormTab() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const discover = useDiscoverFields();
  const fill = useFillForm();

  useEffect(() => {
    if (!file) return;
    setFields([]);
    setValues({});
    discover.mutate(file, {
      onSuccess: (data) => {
        setFields(data.fields);
        setValues(Object.fromEntries(data.fields.map((f) => [f.name, f.value])));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const onSubmit = async () => {
    if (!file) return;
    const result = await fill.mutateAsync({ file, values });
    downloadBlob(result.blob, result.filename);
  };

  return (
    <div className="space-y-4">
      <p className="font-serif italic text-muted text-sm max-w-prose">
        Fills AcroForm text/checkbox fields. XFA forms (Adobe-only) are not supported.
      </p>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="form-input"
      />
      {discover.isPending ? (
        <p className="font-mono text-xs text-subtle">discovering fields…</p>
      ) : null}
      {discover.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(discover.error as Error).message}
        </p>
      ) : null}
      {fields.length === 0 && file && discover.isSuccess ? (
        <p className="font-mono text-xs text-subtle">no AcroForm fields found</p>
      ) : null}
      {fields.length ? (
        <>
          <ul className="space-y-2">
            {fields.map((field) => (
              <li key={field.name} className="border border-border rounded-sm p-3 bg-surface/30">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                    {field.name} <span className="text-accent">· {field.kind}</span>
                  </span>
                  <input
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
                    data-testid={`form-field-${field.name}`}
                  />
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onSubmit}
            disabled={fill.isPending}
            className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
            data-testid="form-fill-button"
          >
            {fill.isPending ? "filling…" : "fill & download"}
          </button>
          {fill.isError ? (
            <p className="font-mono text-xs text-error" role="alert">
              {(fill.error as Error).message}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface AnnotationDraft extends PdfAnnotation {
  id: string;
}

function AnnotateTab() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [annotations, setAnnotations] = useState<AnnotationDraft[]>([]);
  const [pdfHeight, setPdfHeight] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<unknown>(null);
  const annotate = useAnnotate();

  useEffect(() => {
    if (!file) return;
    setAnnotations([]);
    setCurrentPage(1);
    let cancelled = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.mjs?url")
      ).default;
      const buffer = await file.arrayBuffer();
      const document = await pdfjs.getDocument({ data: buffer }).promise;
      if (cancelled) return;
      pdfRef.current = document;
      setPageCount(document.numPages);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const document = pdfRef.current as
      | {
          getPage: (n: number) => Promise<{
            getViewport: (o: { scale: number }) => { width: number; height: number };
            render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
          }>;
        }
      | null;
    if (!document || !canvasRef.current || pageCount === 0) return;
    let cancelled = false;
    (async () => {
      const page = await document.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPdfHeight(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageCount]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPendingPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDraftText("");
  };

  const commitAnnotation = () => {
    if (!pendingPos || !draftText.trim()) return;
    // Convert canvas coords (top-left origin) to PDF coords (bottom-left origin)
    const pdfX = pendingPos.x / 1.5;
    const pdfY = (pdfHeight - pendingPos.y) / 1.5;
    setAnnotations((prev) => [
      ...prev,
      {
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        page: currentPage,
        x: pdfX,
        y: pdfY,
        text: draftText.trim(),
        color: "yellow",
      },
    ]);
    setPendingPos(null);
    setDraftText("");
  };

  const removeAnn = (id: string) =>
    setAnnotations((prev) => prev.filter((a) => a.id !== id));

  const onApply = async () => {
    if (!file || annotations.length === 0) return;
    const result = await annotate.mutateAsync({
      file,
      annotations: annotations.map(({ page, x, y, text, color }) => ({ page, x, y, text, color })),
    });
    downloadBlob(result.blob, result.filename);
  };

  const annotationsOnThisPage = annotations.filter((a) => a.page === currentPage);

  return (
    <div className="space-y-4">
      <p className="font-serif italic text-muted text-sm max-w-prose">
        Click anywhere on a page to add a sticky-note annotation. Annotations
        persist as PDF text annotations (visible in any reader). Highlights /
        drawings / freeform text overlays are <em>not</em> in scope here.
      </p>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full font-mono text-xs file:mr-3 file:px-3 file:py-1.5 file:bg-accent file:text-bg file:border-0 file:rounded-sm file:font-mono file:text-xs file:cursor-pointer text-muted"
        data-testid="annotate-input"
      />
      {pageCount > 0 ? (
        <>
          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-border hover:border-accent rounded-sm disabled:opacity-30"
            >
              ← prev
            </button>
            <span className="text-subtle">page</span>
            <span className="text-fg">{currentPage}</span>
            <span className="text-subtle">of {pageCount}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="px-3 py-1 border border-border hover:border-accent rounded-sm disabled:opacity-30"
            >
              next →
            </button>
            <span className="ml-auto text-subtle">
              {annotations.length} note{annotations.length === 1 ? "" : "s"} total
            </span>
          </div>
          <div className="bg-fg/5 border border-border rounded-sm p-3 overflow-auto max-h-[70vh] relative">
            <div className="relative inline-block mx-auto">
              <canvas
                ref={canvasRef}
                onClick={onCanvasClick}
                className="bg-white cursor-crosshair"
                data-testid="annotate-canvas"
              />
              {annotationsOnThisPage.map((ann) => {
                const screenX = ann.x * 1.5;
                const screenY = pdfHeight - ann.y * 1.5;
                return (
                  <div
                    key={ann.id}
                    style={{ left: screenX - 8, top: screenY - 8 }}
                    className="absolute w-4 h-4 bg-accent border-2 border-bg rounded-full pointer-events-none"
                    title={ann.text}
                  />
                );
              })}
              {pendingPos ? (
                <div
                  style={{ left: pendingPos.x - 8, top: pendingPos.y - 8 }}
                  className="absolute w-4 h-4 bg-error border-2 border-bg rounded-full animate-pulse pointer-events-none"
                />
              ) : null}
            </div>
          </div>

          {pendingPos ? (
            <div className="flex items-center gap-2">
              <input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="note text…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAnnotation();
                  if (e.key === "Escape") setPendingPos(null);
                }}
                className="flex-1 bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
                data-testid="annotate-draft-text"
              />
              <button
                type="button"
                onClick={commitAnnotation}
                disabled={!draftText.trim()}
                className="px-3 py-2 bg-accent text-bg font-mono text-xs rounded-sm hover:opacity-90 disabled:opacity-40"
                data-testid="annotate-add"
              >
                add
              </button>
              <button
                type="button"
                onClick={() => setPendingPos(null)}
                className="px-3 py-2 border border-border font-mono text-xs rounded-sm"
              >
                cancel
              </button>
            </div>
          ) : null}

          {annotations.length > 0 ? (
            <ul className="space-y-1 font-mono text-xs">
              {annotations.map((ann) => (
                <li
                  key={ann.id}
                  className="flex items-center gap-2 border border-border rounded-sm px-2 py-1"
                >
                  <span className="text-subtle w-12">p{ann.page}</span>
                  <span className="text-fg flex-1 truncate">{ann.text}</span>
                  <button
                    type="button"
                    onClick={() => removeAnn(ann.id)}
                    className="text-subtle hover:text-error"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <button
            type="button"
            onClick={onApply}
            disabled={!annotations.length || annotate.isPending}
            className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
            data-testid="annotate-apply"
          >
            {annotate.isPending ? "saving…" : "apply & download"}
          </button>
          {annotate.isError ? (
            <p className="font-mono text-xs text-error" role="alert">
              {(annotate.error as Error).message}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
