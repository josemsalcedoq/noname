import { useState } from "react";

import type { BodyType, KeyValue, Method, RequestNode } from "../api";
import { KeyValueEditor } from "./kv-editor";

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const BODY_TYPES: BodyType[] = ["none", "raw", "json", "urlencoded"];

export interface WorkingRequest {
  method: Method;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  body_type: BodyType;
}

export function workingFromRequest(r: RequestNode): WorkingRequest {
  return {
    method: r.method,
    url: r.url,
    headers: r.headers ?? [],
    params: r.params ?? [],
    body: r.body ?? "",
    body_type: r.body_type ?? "none",
  };
}

export function RequestEditor({
  value,
  onChange,
  onSend,
  onSave,
  isSending,
  isSaving,
  isDirty,
  canSave,
}: {
  value: WorkingRequest;
  onChange: (next: WorkingRequest) => void;
  onSend: () => void;
  onSave: () => void;
  isSending: boolean;
  isSaving: boolean;
  isDirty: boolean;
  canSave: boolean;
}) {
  const [tab, setTab] = useState<"params" | "headers" | "body">("params");

  const update = <K extends keyof WorkingRequest>(key: K, patch: WorkingRequest[K]) =>
    onChange({ ...value, [key]: patch });

  return (
    <section className="border border-border rounded-sm bg-surface/30 p-3 space-y-3">
      <div className="flex gap-2">
        <select
          value={value.method}
          onChange={(e) => update("method", e.target.value as Method)}
          className="bg-bg border border-border text-fg font-mono text-xs px-2 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="method-select"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={value.url}
          onChange={(e) => update("url", e.target.value)}
          placeholder="https://example.com/{{var}}"
          className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-2 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="url-input"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={isSending || !value.url.trim()}
          className="px-4 py-2 bg-accent text-bg font-mono text-xs rounded-sm hover:opacity-90 disabled:opacity-40"
          data-testid="send-button"
        >
          {isSending ? "sending…" : "send"}
        </button>
        {canSave ? (
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="px-3 py-2 border border-border hover:border-accent font-mono text-xs rounded-sm disabled:opacity-40"
            data-testid="save-button"
          >
            {isSaving ? "saving…" : isDirty ? "save" : "saved"}
          </button>
        ) : null}
      </div>

      <nav className="flex gap-1 border-b border-border" aria-label="request tabs">
        {(["params", "headers", "body"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] border-b",
              tab === id ? "text-accent border-accent" : "text-subtle border-transparent hover:text-fg",
            ].join(" ")}
            data-testid={`request-tab-${id}`}
          >
            {id}
            {id === "headers" && value.headers.length ? ` (${value.headers.length})` : ""}
            {id === "params" && value.params.length ? ` (${value.params.length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "params" ? (
        <KeyValueEditor rows={value.params} onChange={(next) => update("params", next)} testidPrefix="params" />
      ) : tab === "headers" ? (
        <KeyValueEditor rows={value.headers} onChange={(next) => update("headers", next)} testidPrefix="headers" />
      ) : (
        <div className="space-y-2">
          <select
            value={value.body_type}
            onChange={(e) => update("body_type", e.target.value as BodyType)}
            className="bg-bg border border-border text-fg font-mono text-xs px-2 py-1 rounded-sm focus:border-accent focus:outline-none"
            data-testid="body-type-select"
          >
            {BODY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <textarea
            value={value.body}
            onChange={(e) => update("body", e.target.value)}
            disabled={value.body_type === "none"}
            spellCheck={false}
            placeholder={value.body_type === "none" ? "no body" : "request body"}
            className="w-full min-h-[10rem] bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none disabled:opacity-50"
            data-testid="body-textarea"
          />
        </div>
      )}
    </section>
  );
}
