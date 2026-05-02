import { useMemo, useState } from "react";

const EXAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const TIMESTAMP_CLAIMS = new Set(["exp", "iat", "nbf", "auth_time", "updated_at"]);

interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export function JwtTab() {
  const [token, setToken] = useState(EXAMPLE);
  const [copied, setCopied] = useState<string | null>(null);

  const result = useMemo(() => decode(token.trim()), [token]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        spellCheck={false}
        rows={5}
        placeholder="paste a JWT (header.payload.signature)"
        className="w-full bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg break-all focus:border-accent focus:outline-none"
        data-testid="jwt-input"
      />

      {result.error ? (
        <p className="font-mono text-xs text-error" role="alert">{result.error}</p>
      ) : result.decoded ? (
        <div className="space-y-4">
          <Section
            title="Header"
            json={result.decoded.header}
            onCopy={() => copy("header", JSON.stringify(result.decoded!.header, null, 2))}
            copied={copied === "header"}
            testid="jwt-header"
          />
          <Section
            title="Payload"
            json={result.decoded.payload}
            onCopy={() => copy("payload", JSON.stringify(result.decoded!.payload, null, 2))}
            copied={copied === "payload"}
            testid="jwt-payload"
            highlights={renderClaimHighlights(result.decoded.payload)}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
                Signature (opaque, not verified)
              </h3>
              <button
                type="button"
                onClick={() => copy("sig", result.decoded!.signature)}
                className="px-2 py-1 font-mono text-[10px] border border-border hover:border-accent rounded-sm"
              >
                {copied === "sig" ? "copied" : "copy"}
              </button>
            </div>
            <pre className="bg-surface/40 border border-border rounded-sm p-3 font-mono text-[11px] text-subtle break-all whitespace-pre-wrap">
              {result.decoded.signature}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  json,
  onCopy,
  copied,
  testid,
  highlights,
}: {
  title: string;
  json: Record<string, unknown>;
  onCopy: () => void;
  copied: boolean;
  testid: string;
  highlights?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">{title}</h3>
        <button
          type="button"
          onClick={onCopy}
          className="px-2 py-1 font-mono text-[10px] border border-border hover:border-accent rounded-sm"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {highlights}
      <pre
        className="bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs text-fg whitespace-pre-wrap break-words"
        data-testid={testid}
      >
        {JSON.stringify(json, null, 2)}
      </pre>
    </div>
  );
}

function renderClaimHighlights(payload: Record<string, unknown>): React.ReactNode | null {
  const items: { label: string; value: string; tone: "ok" | "error" | "muted" }[] = [];
  for (const [key, raw] of Object.entries(payload)) {
    if (TIMESTAMP_CLAIMS.has(key) && typeof raw === "number") {
      const date = new Date(raw * 1000);
      const relative = formatRelative(date);
      const tone =
        key === "exp" ? (date.getTime() < Date.now() ? "error" : "ok") :
        key === "nbf" && date.getTime() > Date.now() ? "error" : "muted";
      items.push({ label: key, value: `${date.toISOString()} (${relative})`, tone });
    }
  }
  if (!items.length) return null;
  return (
    <ul className="font-mono text-[11px] space-y-0.5">
      {items.map((item) => (
        <li
          key={item.label}
          className={
            item.tone === "ok"
              ? "text-success"
              : item.tone === "error"
                ? "text-error"
                : "text-muted"
          }
        >
          <span className="text-subtle uppercase tracking-[0.15em] mr-2">{item.label}</span>
          {item.value}
        </li>
      ))}
    </ul>
  );
}

function decode(token: string): { decoded: DecodedJwt | null; error: string | null } {
  if (!token) return { decoded: null, error: null };
  const parts = token.split(".");
  if (parts.length !== 3) return { decoded: null, error: "JWT must have three dot-separated segments." };
  try {
    const header = JSON.parse(decodeBase64Url(parts[0])) as Record<string, unknown>;
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
    return { decoded: { header, payload, signature: parts[2] }, error: null };
  } catch (err) {
    return { decoded: null, error: (err as Error).message };
  }
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return decodeURIComponent(escape(atob(padded + padding)));
}

function formatRelative(date: Date): string {
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(diffSec) < 60) return formatter.format(diffSec, "second");
  const minutes = Math.round(diffSec / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}
