import { useMemo, useState } from "react";
import yaml from "js-yaml";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import Papa from "papaparse";

type Format = "json" | "yaml" | "toml" | "csv";
const FORMATS: Format[] = ["json", "yaml", "toml", "csv"];

const SAMPLE = `{
  "project": "noname",
  "tools": ["text", "docx", "yt", "dev"],
  "local_only": true
}`;

export function FormatConverterTab() {
  const [from, setFrom] = useState<Format>("json");
  const [to, setTo] = useState<Format>("yaml");
  const [input, setInput] = useState<string>(SAMPLE);

  const { output, error } = useMemo(() => convert(input, from, to), [input, from, to]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormatSelect label="From" value={from} onChange={setFrom} />
        <FormatSelect label="To" value={to} onChange={setTo} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-[20rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
          data-testid="format-input"
        />
        <textarea
          value={error ? "" : output}
          readOnly
          spellCheck={false}
          className="min-h-[20rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg"
          data-testid="format-output"
        />
      </div>
      {error ? (
        <p className="font-mono text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FormatSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Format;
  onChange: (value: Format) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Format)}
        className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </label>
  );
}

function convert(input: string, from: Format, to: Format): { output: string; error: string | null } {
  if (!input.trim()) return { output: "", error: null };
  try {
    const data = parse(input, from);
    return { output: serialize(data, to), error: null };
  } catch (err) {
    return { output: "", error: (err as Error).message };
  }
}

function parse(input: string, format: Format): unknown {
  switch (format) {
    case "json":
      return JSON.parse(input);
    case "yaml":
      return yaml.load(input);
    case "toml":
      return parseToml(input);
    case "csv": {
      const result = Papa.parse(input.trim(), { header: true, skipEmptyLines: true });
      if (result.errors.length) throw new Error(result.errors[0].message);
      return result.data;
    }
  }
}

function serialize(data: unknown, format: Format): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yaml.dump(data, { lineWidth: 100 });
    case "toml":
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("TOML output requires a top-level object.");
      }
      return stringifyToml(data as Record<string, unknown>);
    case "csv":
      if (!Array.isArray(data)) {
        throw new Error("CSV output requires an array of objects.");
      }
      return Papa.unparse(data as Record<string, unknown>[]);
  }
}
