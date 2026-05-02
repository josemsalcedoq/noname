import { useMemo, useState } from "react";

import type { SendResponse } from "../api";

export function ResponseViewer({
  result,
  error,
  isPending,
}: {
  result: SendResponse | undefined;
  error: Error | null;
  isPending: boolean;
}) {
  const [tab, setTab] = useState<"body" | "headers">("body");

  const prettyBody = useMemo(() => {
    if (!result?.body) return "";
    const trimmed = result.body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(result.body), null, 2);
      } catch {
        return result.body;
      }
    }
    return result.body;
  }, [result?.body]);

  if (isPending) {
    return (
      <section className="border border-border rounded-sm bg-surface/30 p-3 font-mono text-xs text-subtle">
        sending…
      </section>
    );
  }

  if (error) {
    return (
      <section className="border border-error/40 bg-error/10 rounded-sm p-3 font-mono text-xs text-error" role="alert">
        {error.message}
      </section>
    );
  }

  if (!result) {
    return (
      <section className="border border-dashed border-border rounded-sm bg-surface/20 p-3 font-mono text-[11px] text-subtle">
        no response yet — send a request
      </section>
    );
  }

  const statusColor =
    result.status >= 200 && result.status < 300
      ? "text-success"
      : result.status >= 400
      ? "text-error"
      : "text-accent";

  return (
    <section className="border border-border rounded-sm bg-surface/30 p-3 space-y-3" data-testid="response-viewer">
      <div className="flex items-center gap-3 font-mono text-xs">
        <span className={`uppercase tracking-[0.18em] ${statusColor}`}>
          {result.status} {result.status_text}
        </span>
        <span className="text-subtle">·</span>
        <span className="text-muted">{result.duration_ms} ms</span>
        <span className="text-subtle">·</span>
        <span className="text-muted">{formatBytes(result.size_bytes)}</span>
        {result.truncated ? (
          <span className="text-error">· truncated to 10 MB</span>
        ) : null}
      </div>

      {result.unknown_vars.length ? (
        <p className="font-mono text-[11px] text-error">
          unknown variables: {result.unknown_vars.join(", ")}
        </p>
      ) : null}

      <nav className="flex gap-1 border-b border-border">
        {(["body", "headers"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] border-b",
              tab === id ? "text-accent border-accent" : "text-subtle border-transparent hover:text-fg",
            ].join(" ")}
            data-testid={`response-tab-${id}`}
          >
            {id}
            {id === "headers" ? ` (${Object.keys(result.headers).length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "body" ? (
        <pre className="bg-bg border border-border rounded-sm p-3 font-mono text-[11px] text-fg whitespace-pre-wrap break-words max-h-[24rem] overflow-auto" data-testid="response-body">
          {prettyBody || <span className="text-subtle italic">empty body</span>}
        </pre>
      ) : (
        <ul className="font-mono text-[11px] divide-y divide-border max-h-[24rem] overflow-auto">
          {Object.entries(result.headers).map(([key, value]) => (
            <li key={key} className="py-1 grid grid-cols-[14rem_1fr] gap-2">
              <span className="text-subtle truncate">{key}</span>
              <span className="text-fg break-all">{value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
