import { useMemo, useState } from "react";

import type { SendResponse } from "../api";

export interface TestResult {
  pass: boolean;
  label: string;
  detail?: string;
}

export function ResponseViewer({
  result,
  error,
  isPending,
  testResults = [],
}: {
  result: SendResponse | undefined;
  error: Error | null;
  isPending: boolean;
  testResults?: TestResult[];
}) {
  const [tab, setTab] = useState<"body" | "headers" | "tests">("body");

  const rawBody = result?.body ?? "";
  const prettyBody = useMemo(() => {
    if (!rawBody) return "";
    const trimmed = rawBody.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(rawBody), null, 2);
      } catch {
        return rawBody;
      }
    }
    return rawBody;
  }, [rawBody]);

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
        {(["body", "headers", "tests"] as const).map((id) => (
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
            {id === "tests" && testResults.length ? ` (${testResults.filter((r) => r.pass).length}/${testResults.length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "body" ? (
        <pre className="bg-bg border border-border rounded-sm p-3 font-mono text-[11px] text-fg whitespace-pre-wrap break-words max-h-[24rem] overflow-auto" data-testid="response-body">
          {prettyBody || <span className="text-subtle italic">empty body</span>}
        </pre>
      ) : tab === "headers" ? (
        <ul className="font-mono text-[11px] divide-y divide-border max-h-[24rem] overflow-auto">
          {Object.entries(result.headers).map(([key, value]) => (
            <li key={key} className="py-1 grid grid-cols-[14rem_1fr] gap-2">
              <span className="text-subtle truncate">{key}</span>
              <span className="text-fg break-all">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        testResults.length === 0 ? (
          <p className="font-mono text-xs text-subtle">no test script — add assertions in the request "Tests" tab</p>
        ) : (
          <ul className="font-mono text-[11px] space-y-1" data-testid="response-tests">
            {testResults.map((r, idx) => (
              <li
                key={idx}
                className={r.pass ? "text-success" : "text-error"}
              >
                <span className="mr-2">{r.pass ? "✓" : "✗"}</span>
                <span>{r.label}</span>
                {r.detail ? <span className="text-subtle ml-2">{r.detail}</span> : null}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
