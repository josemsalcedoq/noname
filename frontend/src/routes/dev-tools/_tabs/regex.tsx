import { useMemo, useState } from "react";

interface Match {
  start: number;
  end: number;
  text: string;
  groups: Record<string, string | undefined>;
}

export function RegexTab() {
  const [pattern, setPattern] = useState<string>("(?<word>\\w+)");
  const [flags, setFlags] = useState<string>("g");
  const [text, setText] = useState<string>("the quick brown fox");

  const result = useMemo(() => {
    if (!pattern) return { matches: [] as Match[], error: null as string | null };
    try {
      const regex = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const matches: Match[] = [];
      for (const match of text.matchAll(regex)) {
        matches.push({
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          text: match[0],
          groups: match.groups ?? {},
        });
      }
      return { matches, error: null };
    } catch (err) {
      return { matches: [] as Match[], error: (err as Error).message };
    }
  }, [pattern, flags, text]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_8rem]">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Pattern</span>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="regex-pattern"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Flags</span>
          <input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            placeholder="g, gi, gim…"
            data-testid="regex-flags"
          />
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[10rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
        data-testid="regex-text"
      />

      <div className="bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg whitespace-pre-wrap" data-testid="regex-highlight">
        {result.error ? "" : highlight(text, result.matches)}
      </div>

      {result.error ? (
        <p className="font-mono text-xs text-error" role="alert">{result.error}</p>
      ) : (
        <ul className="font-mono text-xs space-y-1 text-muted">
          {result.matches.map((match, idx) => (
            <li key={idx}>
              <span className="text-accent">{match.text}</span>{" "}
              <span className="text-subtle">@{match.start}-{match.end}</span>
              {Object.entries(match.groups).map(([name, value]) => (
                <span key={name} className="ml-2 text-muted">
                  <span className="text-subtle">{name}=</span>
                  {value ?? ""}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function highlight(text: string, matches: Match[]): React.ReactNode {
  if (!matches.length) return text;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, idx) => {
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      <mark key={idx} className="bg-accent-soft text-accent px-0.5 rounded-sm">
        {match.text}
      </mark>,
    );
    cursor = match.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
