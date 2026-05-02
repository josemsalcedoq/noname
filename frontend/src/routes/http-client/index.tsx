import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  useEnvironments,
  useRequest,
  useSend,
  useUpdateRequest,
} from "./api";
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
};

function HttpClientPage() {
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [working, setWorking] = useState<WorkingRequest>(EMPTY_WORKING);
  const [environmentId, setEnvironmentId] = useState<number | null>(null);

  const requestQuery = useRequest(requestId);
  const update = useUpdateRequest();
  const send = useSend();
  const environments = useEnvironments();

  useEffect(() => {
    if (requestQuery.data) {
      setWorking(workingFromRequest(requestQuery.data));
    }
  }, [requestQuery.data]);

  const isDirty = useMemo(() => {
    if (!requestQuery.data) return false;
    const saved = workingFromRequest(requestQuery.data);
    return JSON.stringify(saved) !== JSON.stringify(working);
  }, [requestQuery.data, working]);

  const onSend = () =>
    send.mutate({
      ...working,
      environment_id: environmentId,
    });

  const onSave = () => {
    if (requestId === null) return;
    update.mutate({ id: requestId, ...working });
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
            setWorking(EMPTY_WORKING);
          }}
          onSelectRequest={setRequestId}
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
          />
        </div>
      </div>
    </article>
  );
}
