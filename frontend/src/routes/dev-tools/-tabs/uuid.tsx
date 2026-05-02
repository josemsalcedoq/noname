import { useState } from "react";
import { nanoid } from "nanoid";

type Kind = "uuid-v4" | "nanoid";

const KINDS: { id: Kind; label: string }[] = [
  { id: "uuid-v4", label: "UUID v4" },
  { id: "nanoid", label: "nanoid" },
];

function generate(kind: Kind, length: number): string {
  if (kind === "uuid-v4") return crypto.randomUUID();
  return nanoid(length);
}

export function UuidTab() {
  const [kind, setKind] = useState<Kind>("uuid-v4");
  const [count, setCount] = useState(10);
  const [length, setLength] = useState(21);
  const [values, setValues] = useState<string[]>([]);

  const onGenerate = () => {
    setValues(Array.from({ length: count }, () => generate(kind, length)));
  };

  const onCopyAll = async () => {
    if (!values.length) return;
    await navigator.clipboard.writeText(values.join("\n"));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="uuid-kind"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Count</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="uuid-count"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
            Length {kind === "uuid-v4" ? "(fixed)" : ""}
          </span>
          <input
            type="number"
            min={6}
            max={64}
            value={length}
            disabled={kind === "uuid-v4"}
            onChange={(e) => setLength(Math.max(6, Math.min(64, Number(e.target.value) || 21)))}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none disabled:opacity-50"
            data-testid="uuid-length"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="px-4 py-2 bg-accent text-bg font-mono text-xs rounded-sm hover:opacity-90"
          data-testid="uuid-generate"
        >
          generate
        </button>
        <button
          type="button"
          onClick={onCopyAll}
          disabled={!values.length}
          className="px-4 py-2 border border-border hover:border-accent font-mono text-xs rounded-sm disabled:opacity-40"
        >
          copy all
        </button>
      </div>

      {values.length ? (
        <pre
          className="bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs text-fg overflow-auto max-h-[24rem]"
          data-testid="uuid-output"
        >
          {values.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}
