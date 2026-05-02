import { useMemo, useState } from "react";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";

const PRESETS = [
  { label: "every minute", expr: "* * * * *" },
  { label: "every hour", expr: "0 * * * *" },
  { label: "daily 9am", expr: "0 9 * * *" },
  { label: "weekdays 8am", expr: "0 8 * * 1-5" },
  { label: "every 15 min", expr: "*/15 * * * *" },
  { label: "1st of month", expr: "0 0 1 * *" },
];

export function CronTab() {
  const [expr, setExpr] = useState("0 9 * * 1-5");

  const result = useMemo(() => {
    const trimmed = expr.trim();
    if (!trimmed) return { description: "", nextRuns: [] as string[], error: null as string | null };
    try {
      const description = cronstrue.toString(trimmed);
      const interval = CronExpressionParser.parse(trimmed);
      const nextRuns: string[] = [];
      for (let i = 0; i < 10; i++) {
        nextRuns.push(interval.next().toDate().toLocaleString());
      }
      return { description, nextRuns, error: null };
    } catch (err) {
      return { description: "", nextRuns: [], error: (err as Error).message };
    }
  }, [expr]);

  return (
    <div className="space-y-4">
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="* * * * *"
        spellCheck={false}
        className="w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        data-testid="cron-input"
      />

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.expr}
            type="button"
            onClick={() => setExpr(preset.expr)}
            className="px-2 py-0.5 font-mono text-[10px] text-subtle hover:text-accent border border-border hover:border-accent rounded-sm"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {result.error ? (
        <p className="font-mono text-xs text-error" role="alert">{result.error}</p>
      ) : (
        <>
          <p className="font-serif text-base text-fg italic" data-testid="cron-description">
            {result.description}
          </p>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle mb-2">
              next 10 fires (local time)
            </h3>
            <ol className="font-mono text-xs space-y-1 text-muted">
              {result.nextRuns.map((run, idx) => (
                <li key={idx}>
                  <span className="text-subtle mr-2">{idx + 1}.</span>
                  {run}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
