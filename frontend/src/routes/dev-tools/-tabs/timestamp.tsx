import { useState } from "react";

export function TimestampTab() {
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)));

  const date = parse(input);

  const fields: { label: string; value: string }[] = date
    ? [
        { label: "Unix (s)", value: String(Math.floor(date.getTime() / 1000)) },
        { label: "Unix (ms)", value: String(date.getTime()) },
        { label: "ISO 8601", value: date.toISOString() },
        { label: "RFC 2822", value: date.toUTCString() },
        { label: "Local", value: date.toLocaleString() },
        { label: "Relative", value: formatRelative(date) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        placeholder="unix epoch, ISO string, or any Date-parseable input"
        className="w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        data-testid="timestamp-input"
      />

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          className="px-2 py-0.5 font-mono text-[10px] text-subtle hover:text-accent border border-border hover:border-accent rounded-sm"
        >
          now (s)
        </button>
        <button
          type="button"
          onClick={() => setInput(String(Date.now()))}
          className="px-2 py-0.5 font-mono text-[10px] text-subtle hover:text-accent border border-border hover:border-accent rounded-sm"
        >
          now (ms)
        </button>
        <button
          type="button"
          onClick={() => setInput(new Date().toISOString())}
          className="px-2 py-0.5 font-mono text-[10px] text-subtle hover:text-accent border border-border hover:border-accent rounded-sm"
        >
          now (iso)
        </button>
      </div>

      {date ? (
        <ul className="font-mono text-xs divide-y divide-border" data-testid="timestamp-output">
          {fields.map((field) => (
            <li key={field.label} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5">
              <span className="text-subtle uppercase tracking-[0.15em] text-[10px] self-center">{field.label}</span>
              <span className="text-fg break-all">{field.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-xs text-error" role="alert">
          could not parse "{input}"
        </p>
      )}
    </div>
  );
}

function parse(input: string): Date | null {
  if (!input.trim()) return null;
  const numeric = Number(input);
  if (Number.isFinite(numeric)) {
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return formatter.format(months, "month");
  return formatter.format(Math.round(months / 12), "year");
}
