import { useMemo, useState } from "react";
import { diffChars, diffLines, diffWords } from "diff";

type Mode = "line" | "word" | "char";
const MODES: Mode[] = ["line", "word", "char"];

export function DiffTab() {
  const [a, setA] = useState("first version\nshared line\nold tail");
  const [b, setB] = useState("first version\nshared line\nnew tail");
  const [mode, setMode] = useState<Mode>("line");

  const parts = useMemo(() => {
    if (mode === "line") return diffLines(a, b);
    if (mode === "word") return diffWords(a, b);
    return diffChars(a, b);
  }, [a, b, mode]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const part of parts) {
      if (part.added) added += part.value.length;
      if (part.removed) removed += part.value.length;
    }
    return { added, removed };
  }, [parts]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <textarea
          value={a}
          onChange={(e) => setA(e.target.value)}
          spellCheck={false}
          className="min-h-[12rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
          data-testid="diff-a"
        />
        <textarea
          value={b}
          onChange={(e) => setB(e.target.value)}
          spellCheck={false}
          className="min-h-[12rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
          data-testid="diff-b"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 font-mono text-[11px]">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                "px-3 py-1 uppercase tracking-[0.18em] border-b",
                mode === m ? "text-accent border-accent" : "text-subtle border-transparent hover:text-fg",
              ].join(" ")}
              data-testid={`diff-mode-${m}`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-subtle">
          <span className="text-success">+{stats.added}</span>{" "}
          <span className="text-error">−{stats.removed}</span>
        </p>
      </div>

      <pre
        className="bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
        data-testid="diff-output"
      >
        {parts.map((part, idx) => (
          <span
            key={idx}
            className={
              part.added
                ? "bg-success/20 text-success"
                : part.removed
                  ? "bg-error/20 text-error line-through"
                  : "text-muted"
            }
          >
            {part.value}
          </span>
        ))}
      </pre>
    </div>
  );
}
