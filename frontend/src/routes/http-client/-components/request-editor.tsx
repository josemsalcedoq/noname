import { useState } from "react";

import type { BodyType, KeyValue, Method, RequestNode } from "../api";
import { buildCurl, CurlParseError, parseCurl } from "./curl";
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
  pre_request_script: string;
  test_script: string;
}

export function workingFromRequest(r: RequestNode): WorkingRequest {
  return {
    method: r.method,
    url: r.url,
    headers: r.headers ?? [],
    params: r.params ?? [],
    body: r.body ?? "",
    body_type: r.body_type ?? "none",
    pre_request_script: r.pre_request_script ?? "",
    test_script: r.test_script ?? "",
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
  const [tab, setTab] = useState<"params" | "headers" | "auth" | "body" | "script" | "tests">("params");
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlInput, setCurlInput] = useState("");
  const [curlError, setCurlError] = useState<string | null>(null);
  const [curlCopied, setCurlCopied] = useState(false);

  const onCopyAsCurl = async () => {
    const command = buildCurl(value);
    await navigator.clipboard.writeText(command);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 1500);
  };

  const onImportCurl = () => {
    setCurlError(null);
    try {
      const parsed = parseCurl(curlInput);
      onChange({
        ...value,
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        body: parsed.body,
        body_type: parsed.body_type,
      });
      setCurlInput("");
      setCurlOpen(false);
    } catch (err) {
      setCurlError(err instanceof CurlParseError ? err.message : (err as Error).message);
    }
  };

  const update = <K extends keyof WorkingRequest>(key: K, patch: WorkingRequest[K]) =>
    onChange({ ...value, [key]: patch });

  return (
    <section className="border border-border rounded-sm bg-surface/30 p-3 space-y-3">
      <div className="flex items-center justify-end gap-2 -mt-1 -mb-1">
        <button
          type="button"
          onClick={() => setCurlOpen((prev) => !prev)}
          className="px-2 py-1 font-mono text-[10px] text-subtle hover:text-accent border border-border hover:border-accent rounded-sm"
          data-testid="curl-import-toggle"
        >
          {curlOpen ? "close" : "import cURL"}
        </button>
        <button
          type="button"
          onClick={onCopyAsCurl}
          disabled={!value.url.trim()}
          className="px-2 py-1 font-mono text-[10px] text-subtle hover:text-accent border border-border hover:border-accent rounded-sm disabled:opacity-40"
          data-testid="curl-copy"
        >
          {curlCopied ? "copied" : "copy as cURL"}
        </button>
      </div>

      {curlOpen ? (
        <div className="space-y-2 border border-border rounded-sm p-3 bg-bg/40">
          <textarea
            value={curlInput}
            onChange={(e) => setCurlInput(e.target.value)}
            spellCheck={false}
            placeholder='curl -X POST https://api.example.com/v1/users -H "Authorization: Bearer ..." -d ...'
            className="w-full min-h-[6rem] bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="curl-input"
          />
          <div className="flex items-center justify-between">
            {curlError ? (
              <p className="font-mono text-[10px] text-error" role="alert">{curlError}</p>
            ) : (
              <p className="font-mono text-[10px] text-subtle">
                supports -X, -H, -d / --data*, -u, --location, line continuations
              </p>
            )}
            <button
              type="button"
              onClick={onImportCurl}
              disabled={!curlInput.trim()}
              className="px-3 py-1 bg-accent text-bg font-mono text-[11px] rounded-sm hover:opacity-90 disabled:opacity-40"
              data-testid="curl-parse"
            >
              parse & fill
            </button>
          </div>
        </div>
      ) : null}

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
        {(["params", "headers", "auth", "body", "script", "tests"] as const).map((id) => (
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
      ) : tab === "auth" ? (
        <AuthEditor headers={value.headers} onChange={(next) => update("headers", next)} />
      ) : tab === "script" ? (
        <ScriptEditor
          value={value.pre_request_script}
          onChange={(next) => update("pre_request_script", next)}
        />
      ) : tab === "tests" ? (
        <TestScriptEditor
          value={value.test_script}
          onChange={(next) => update("test_script", next)}
        />
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

type AuthMode = "none" | "basic" | "bearer";

function detectAuthMode(headers: KeyValue[]): { mode: AuthMode; user?: string; password?: string; token?: string } {
  const auth = headers.find((h) => h.key.toLowerCase() === "authorization" && h.enabled !== false);
  if (!auth) return { mode: "none" };
  const value = auth.value.trim();
  if (value.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(value.slice(6).trim());
      const [user, password = ""] = decoded.split(":", 2);
      return { mode: "basic", user, password };
    } catch {
      return { mode: "basic" };
    }
  }
  if (value.toLowerCase().startsWith("bearer ")) {
    return { mode: "bearer", token: value.slice(7).trim() };
  }
  return { mode: "none" };
}

function withoutAuth(headers: KeyValue[]): KeyValue[] {
  return headers.filter((h) => h.key.toLowerCase() !== "authorization");
}

function AuthEditor({
  headers,
  onChange,
}: {
  headers: KeyValue[];
  onChange: (next: KeyValue[]) => void;
}) {
  const detected = detectAuthMode(headers);
  const [mode, setMode] = useState<AuthMode>(detected.mode);
  const [user, setUser] = useState(detected.user ?? "");
  const [password, setPassword] = useState(detected.password ?? "");
  const [token, setToken] = useState(detected.token ?? "");

  const apply = (nextMode: AuthMode, nextUser: string, nextPassword: string, nextToken: string) => {
    const cleaned = withoutAuth(headers);
    if (nextMode === "none") {
      onChange(cleaned);
      return;
    }
    if (nextMode === "basic") {
      const value = `Basic ${btoa(`${nextUser}:${nextPassword}`)}`;
      onChange([...cleaned, { key: "Authorization", value, enabled: true }]);
      return;
    }
    if (nextMode === "bearer") {
      onChange([...cleaned, { key: "Authorization", value: `Bearer ${nextToken}`, enabled: true }]);
    }
  };

  const onModeChange = (next: AuthMode) => {
    setMode(next);
    apply(next, user, password, token);
  };

  return (
    <div className="space-y-3">
      <label className="block max-w-xs">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Auth scheme</span>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as AuthMode)}
          className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="auth-mode"
        >
          <option value="none">none</option>
          <option value="basic">Basic</option>
          <option value="bearer">Bearer token</option>
        </select>
      </label>

      {mode === "basic" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              apply("basic", e.target.value, password, token);
            }}
            placeholder="username"
            className="bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="auth-basic-user"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              apply("basic", user, e.target.value, token);
            }}
            placeholder="password"
            className="bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="auth-basic-password"
          />
        </div>
      ) : null}

      {mode === "bearer" ? (
        <textarea
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            apply("bearer", user, password, e.target.value);
          }}
          placeholder="paste a bearer token (without the 'Bearer ' prefix)"
          spellCheck={false}
          rows={3}
          className="w-full bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none break-all"
          data-testid="auth-bearer-token"
        />
      ) : null}

      {mode !== "none" ? (
        <p className="font-mono text-[10px] text-subtle">
          credentials are written into the <span className="text-fg">Authorization</span> header — visible in the Headers tab and in copy-as-cURL output.
        </p>
      ) : null}
    </div>
  );
}

const SCRIPT_PLACEHOLDER = `// Pre-request script. Runs before each Send.
// Available helpers via the 'noname' object:
//   noname.setHeader(key, value)
//   noname.setVar(key, value)        // session env var (resolved at send time)
//   noname.getVar(key)
//   noname.setBody(text)
//   noname.setBodyType("json" | "raw" | "urlencoded" | "none")
//   noname.now()                     // current Date

// Example:
// noname.setHeader("X-Request-Id", crypto.randomUUID());
// noname.setVar("nonce", String(Date.now()));`;

function ScriptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] text-subtle">
        Pre-request script. Single-user local — runs in the browser via{" "}
        <code className="text-fg">new Function()</code>, NOT a security sandbox. Don&apos;t paste
        scripts you didn&apos;t write yourself.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={SCRIPT_PLACEHOLDER}
        rows={14}
        className="w-full bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        data-testid="script-editor"
      />
    </div>
  );
}

const TEST_PLACEHOLDER = `// Test script. Runs after each Send.
// Available helpers via the 'noname' object:
//   noname.expect(condition, label)
//   noname.expectStatus(code)
//   noname.expectStatusRange(min, max)
//   noname.expectHeader(name, value)
//   noname.expectBodyContains(text)
//   noname.responseStatus     // number
//   noname.responseHeaders    // Record<string, string>
//   noname.responseBody       // string
//   noname.responseJson()     // throws if not JSON

// Example:
// noname.expectStatus(200);
// const data = noname.responseJson();
// noname.expect(Array.isArray(data.items), "items is an array");`;

function TestScriptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] text-subtle">
        Test script. Runs after each response. Results show under the response
        viewer. Same security caveat as pre-request scripts.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={TEST_PLACEHOLDER}
        rows={14}
        className="w-full bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        data-testid="test-script-editor"
      />
    </div>
  );
}
