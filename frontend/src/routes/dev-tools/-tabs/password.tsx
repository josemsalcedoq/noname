import { useState } from "react";

const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/",
};

function randomFrom(charset: string, length: number): string {
  if (!charset) return "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const max = Math.floor(256 / charset.length) * charset.length;
  const out: string[] = [];
  let i = 0;
  while (out.length < length) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes);
      i = 0;
    }
    const byte = bytes[i++];
    if (byte < max) out.push(charset[byte % charset.length]);
  }
  return out.join("");
}

function entropyBits(charsetLength: number, passwordLength: number): number {
  if (charsetLength <= 1) return 0;
  return Math.round(passwordLength * Math.log2(charsetLength));
}

export function PasswordTab() {
  const [length, setLength] = useState(20);
  const [count, setCount] = useState(5);
  const [useUpper, setUseUpper] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [results, setResults] = useState<string[]>([]);

  const charset =
    CHARSETS.lower +
    (useUpper ? CHARSETS.upper : "") +
    (useDigits ? CHARSETS.digits : "") +
    (useSymbols ? CHARSETS.symbols : "");

  const onGenerate = () => {
    setResults(Array.from({ length: count }, () => randomFrom(charset, length)));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
            Length: {length}
          </span>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
            data-testid="password-length"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Count</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="password-count"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 font-mono text-xs">
        <Toggle label="A-Z" checked={useUpper} onChange={setUseUpper} />
        <Toggle label="0-9" checked={useDigits} onChange={setUseDigits} />
        <Toggle label="!@#" checked={useSymbols} onChange={setUseSymbols} />
        <span className="ml-auto text-subtle self-center">
          ≈ {entropyBits(charset.length, length)} bits entropy
        </span>
      </div>

      <button
        type="button"
        onClick={onGenerate}
        className="px-4 py-2 bg-accent text-bg font-mono text-xs rounded-sm hover:opacity-90"
        data-testid="password-generate"
      >
        generate
      </button>

      {results.length ? (
        <ul className="space-y-1" data-testid="password-output">
          {results.map((value, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <code className="flex-1 bg-surface/40 border border-border rounded-sm px-3 py-2 font-mono text-xs text-fg break-all">
                {value}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(value)}
                className="px-2 py-1 font-mono text-[10px] border border-border hover:border-accent rounded-sm"
                title="copy"
              >
                copy
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      <span className={checked ? "text-fg" : "text-subtle"}>{label}</span>
    </label>
  );
}
