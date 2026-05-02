import { useRuns, type RunDetail, type RunSummary } from "../api";
import type { WorkingRequest } from "./request-editor";

export function HistoryPanel({
  selectedRunId,
  onSelectRun,
}: {
  selectedRunId: number | null;
  onSelectRun: (run: RunSummary) => void;
}) {
  const runs = useRuns(30);

  return (
    <aside className="border border-border rounded-sm bg-surface/30 p-3 w-72 shrink-0 max-h-[calc(100vh-12rem)] overflow-auto">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-subtle mb-3">
        Recent runs
      </h3>
      {runs.isLoading ? (
        <p className="font-mono text-[11px] text-subtle">loading…</p>
      ) : (runs.data ?? []).length === 0 ? (
        <p className="font-mono text-[11px] text-subtle">no runs yet — send a request</p>
      ) : (
        <ul className="space-y-1">
          {(runs.data ?? []).map((run) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onSelectRun(run)}
                className={[
                  "w-full text-left rounded-sm px-2 py-1 font-mono text-[11px] transition-colors",
                  run.id === selectedRunId
                    ? "bg-accent-soft text-accent"
                    : "hover:bg-accent-soft/50 text-muted hover:text-fg",
                ].join(" ")}
                data-testid={`history-row-${run.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`uppercase tracking-tight w-10 shrink-0 ${methodColor(run.method)}`}>
                    {run.method}
                  </span>
                  {run.error ? (
                    <span className="text-error">×</span>
                  ) : (
                    <span className={statusColor(run.status)}>{run.status ?? "—"}</span>
                  )}
                  <span className="text-subtle text-[10px] ml-auto">{relativeTime(run.sent_at)}</span>
                </div>
                <div className="truncate text-fg/80 mt-0.5">{run.url}</div>
                {run.error ? (
                  <div className="text-error text-[10px] truncate mt-0.5">{run.error}</div>
                ) : (
                  <div className="text-subtle text-[10px] mt-0.5">
                    {run.duration_ms ?? "—"}ms · {formatBytes(run.size_bytes)}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function workingFromRun(run: RunDetail): WorkingRequest {
  return {
    method: run.method,
    url: run.url,
    headers: run.snapshot.headers,
    params: run.snapshot.params,
    body: run.snapshot.body,
    body_type: run.snapshot.body_type,
    pre_request_script: "",
    test_script: "",
  };
}

function methodColor(method: string): string {
  if (method === "GET") return "text-success";
  if (method === "DELETE") return "text-error";
  if (method === "HEAD" || method === "OPTIONS") return "text-muted";
  return "text-accent";
}

function statusColor(status: number | null): string {
  if (status === null) return "text-subtle";
  if (status >= 200 && status < 300) return "text-success";
  if (status >= 400) return "text-error";
  return "text-accent";
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
