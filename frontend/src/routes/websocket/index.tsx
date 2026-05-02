import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/websocket/")({
  component: WebsocketPage,
});

type Status = "idle" | "connecting" | "open" | "closing" | "closed";

interface LogEntry {
  id: string;
  direction: "out" | "in" | "system";
  text: string;
  at: Date;
}

function WebsocketPage() {
  const [url, setUrl] = useState("wss://echo.websocket.org");
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [draft, setDraft] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const append = (entry: Omit<LogEntry, "id" | "at">) => {
    setLog((prev) => [
      ...prev,
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date() },
    ]);
  };

  const connect = () => {
    if (wsRef.current) wsRef.current.close();
    setStatus("connecting");
    setLog([]);
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      setStatus("closed");
      append({ direction: "system", text: `connect failed: ${(err as Error).message}` });
      return;
    }
    wsRef.current = socket;
    socket.onopen = () => {
      setStatus("open");
      append({ direction: "system", text: `connected to ${url}` });
    };
    socket.onmessage = (event) => {
      append({ direction: "in", text: typeof event.data === "string" ? event.data : "[binary frame]" });
    };
    socket.onerror = () => {
      append({ direction: "system", text: "socket error" });
    };
    socket.onclose = (event) => {
      setStatus("closed");
      append({
        direction: "system",
        text: `closed (code=${event.code}${event.reason ? ` "${event.reason}"` : ""})`,
      });
      wsRef.current = null;
    };
  };

  const disconnect = () => {
    if (!wsRef.current) return;
    setStatus("closing");
    wsRef.current.close();
  };

  const send = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!draft) return;
    wsRef.current.send(draft);
    append({ direction: "out", text: draft });
    setDraft("");
  };

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Developer · 12
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">WebSocket</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Open a WebSocket from the browser, send / receive messages live. Pure native
          <span className="font-mono text-fg"> WebSocket</span> API — no backend involved.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="wss://example.com/socket"
          disabled={status === "open" || status === "connecting"}
          className="flex-1 bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none disabled:opacity-50"
          data-testid="ws-url"
        />
        {status === "open" || status === "connecting" || status === "closing" ? (
          <button
            type="button"
            onClick={disconnect}
            className="px-4 py-2 border border-error text-error font-mono text-sm rounded-sm hover:bg-error/10"
            data-testid="ws-disconnect"
          >
            disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={!url.trim()}
            className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
            data-testid="ws-connect"
          >
            connect
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span
          className={
            status === "open"
              ? "text-success"
              : status === "closed" || status === "idle"
                ? "text-subtle"
                : "text-accent"
          }
        >
          {status}
        </span>
        <span className="text-subtle">·</span>
        <span className="text-muted">{log.length} message{log.length === 1 ? "" : "s"}</span>
      </div>

      <div className="border border-border rounded-sm bg-surface/30 p-3 max-h-[24rem] overflow-auto space-y-1">
        {log.length === 0 ? (
          <p className="font-mono text-xs text-subtle">no messages yet</p>
        ) : (
          log.map((entry) => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder="message to send (⌘+Enter to send)"
          rows={3}
          disabled={status !== "open"}
          className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none disabled:opacity-50"
          data-testid="ws-draft"
        />
        <button
          type="button"
          onClick={send}
          disabled={status !== "open" || !draft}
          className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
          data-testid="ws-send"
        >
          send
        </button>
      </div>
    </article>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const dirColor =
    entry.direction === "out"
      ? "text-accent"
      : entry.direction === "in"
        ? "text-success"
        : "text-subtle italic";
  const dirLabel = entry.direction === "out" ? "→" : entry.direction === "in" ? "←" : "·";
  return (
    <div className="grid grid-cols-[3rem_4rem_1fr] gap-2 font-mono text-xs">
      <span className="text-subtle">{entry.at.toLocaleTimeString()}</span>
      <span className={dirColor}>{dirLabel}</span>
      <pre className={`whitespace-pre-wrap break-all ${dirColor}`}>{entry.text}</pre>
    </div>
  );
}
