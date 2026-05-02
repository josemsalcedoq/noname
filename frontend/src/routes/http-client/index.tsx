import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  useEnvironments,
  useRequest,
  useRun,
  useSend,
  useUpdateRequest,
  type RunSummary,
  type SendResponse,
} from "./api";
import { HistoryPanel, workingFromRun } from "./-components/history-panel";
import { RequestEditor, workingFromRequest, type WorkingRequest } from "./-components/request-editor";
import { ResponseViewer } from "./-components/response-viewer";
import { TreeSidebar } from "./-components/tree";

export const Route = createFileRoute("/http-client/")({
  component: HttpClientPage,
});

const EMPTY_WORKING: WorkingRequest = {
  method: "GET",
  url: "https://example.com",
  headers: [],
  params: [],
  body: "",
  body_type: "none",
  pre_request_script: "",
  test_script: "",
};

export interface TestResult {
  pass: boolean;
  label: string;
  detail?: string;
}

export function runTestScript(script: string, response: SendResponse | undefined): TestResult[] {
  if (!script.trim() || !response) return [];
  const results: TestResult[] = [];
  const noname = {
    responseStatus: response.status,
    responseHeaders: response.headers,
    responseBody: response.body,
    responseJson() {
      return JSON.parse(response.body);
    },
    expect(condition: unknown, label: string) {
      results.push({ pass: !!condition, label });
    },
    expectStatus(code: number) {
      results.push({
        pass: response.status === code,
        label: `status === ${code}`,
        detail: `got ${response.status}`,
      });
    },
    expectStatusRange(min: number, max: number) {
      results.push({
        pass: response.status >= min && response.status <= max,
        label: `status in [${min}, ${max}]`,
        detail: `got ${response.status}`,
      });
    },
    expectHeader(name: string, value: string) {
      const found = Object.entries(response.headers).find(([k]) => k.toLowerCase() === name.toLowerCase());
      const actual = found?.[1];
      results.push({
        pass: actual === value,
        label: `header ${name} === "${value}"`,
        detail: actual ? `got "${actual}"` : "missing",
      });
    },
    expectBodyContains(text: string) {
      results.push({
        pass: response.body.includes(text),
        label: `body contains "${text}"`,
      });
    },
  };
  try {
    const fn = new Function("noname", "console", script);
    fn(noname, console);
  } catch (err) {
    results.push({ pass: false, label: "script error", detail: (err as Error).message });
  }
  return results;
}

interface ScriptContextEnv {
  vars: Record<string, string>;
}

function runPreRequestScript(working: WorkingRequest, env: ScriptContextEnv): WorkingRequest {
  if (!working.pre_request_script.trim()) return working;
  const next: WorkingRequest = {
    ...working,
    headers: [...working.headers],
    params: [...working.params],
  };
  const noname = {
    setHeader(key: string, value: string) {
      const cleaned = next.headers.filter((h) => h.key.toLowerCase() !== key.toLowerCase());
      cleaned.push({ key, value, enabled: true });
      next.headers = cleaned;
    },
    setVar(key: string, value: string) {
      env.vars[key] = value;
    },
    getVar(key: string): string | undefined {
      return env.vars[key];
    },
    setBody(text: string) {
      next.body = text;
    },
    setBodyType(type: WorkingRequest["body_type"]) {
      next.body_type = type;
    },
    now() {
      return new Date();
    },
  };
  const fn = new Function("noname", "console", working.pre_request_script);
  fn(noname, console);
  return next;
}

function HttpClientPage() {
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [working, setWorking] = useState<WorkingRequest>(EMPTY_WORKING);
  const [environmentId, setEnvironmentId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const requestQuery = useRequest(requestId);
  const runDetail = useRun(selectedRunId);
  const update = useUpdateRequest();
  const send = useSend();
  const environments = useEnvironments();

  useEffect(() => {
    if (requestQuery.data) {
      setWorking(workingFromRequest(requestQuery.data));
    }
  }, [requestQuery.data]);

  useEffect(() => {
    if (runDetail.data) {
      setWorking(workingFromRun(runDetail.data));
      if (runDetail.data.snapshot.environment_id !== undefined) {
        setEnvironmentId(runDetail.data.snapshot.environment_id);
      }
    }
  }, [runDetail.data]);

  const isDirty = useMemo(() => {
    if (!requestQuery.data) return false;
    const saved = workingFromRequest(requestQuery.data);
    return JSON.stringify(saved) !== JSON.stringify(working);
  }, [requestQuery.data, working]);

  const onSend = () => {
    let prepared: WorkingRequest;
    try {
      prepared = runPreRequestScript(working, { vars: {} });
    } catch (err) {
      console.error("pre-request script failed:", err);
      prepared = working;
    }
    send.mutate({
      ...prepared,
      environment_id: environmentId,
      request_node_id: requestId,
    });
  };

  const onSave = () => {
    if (requestId === null) return;
    update.mutate({ id: requestId, ...working });
  };

  const onSelectRun = (run: RunSummary) => {
    setSelectedRunId(run.id);
    setRequestId(null);
  };

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Developer · 07
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">HTTP client</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Local Postman-lite. Save requests in collections, import Postman v2.1
          JSON, send through the backend so CORS never bites.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
          environment
        </label>
        <select
          value={environmentId ?? ""}
          onChange={(e) => setEnvironmentId(e.target.value ? Number(e.target.value) : null)}
          className="bg-bg border border-border text-fg font-mono text-xs px-2 py-1.5 rounded-sm focus:border-accent focus:outline-none"
          data-testid="environment-select"
        >
          <option value="">— none —</option>
          {(environments.data ?? []).map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <TreeSidebar
          selectedCollection={collectionId}
          selectedRequest={requestId}
          onSelectCollection={(id) => {
            setCollectionId(id);
            setRequestId(null);
            setSelectedRunId(null);
            setWorking(EMPTY_WORKING);
          }}
          onSelectRequest={(id) => {
            setRequestId(id);
            setSelectedRunId(null);
          }}
        />

        <div className="flex-1 min-w-0 space-y-4">
          <RequestEditor
            value={working}
            onChange={setWorking}
            onSend={onSend}
            onSave={onSave}
            isSending={send.isPending}
            isSaving={update.isPending}
            isDirty={isDirty}
            canSave={requestId !== null}
          />
          <ResponseViewer
            result={send.data}
            error={(send.error as Error | null) ?? null}
            isPending={send.isPending}
            testResults={runTestScript(working.test_script, send.data)}
          />
        </div>

        <HistoryPanel selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
      </div>
    </article>
  );
}
