import { useMemo, useState } from "react";

type Mode = "base64" | "url" | "hex" | "jwt";
const MODES: Mode[] = ["base64", "url", "hex", "jwt"];

export function EncoderDecoderTab() {
  const [mode, setMode] = useState<Mode>("base64");
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("hello");

  const { output, note, error } = useMemo(
    () => apply(input, mode, direction),
    [input, mode, direction],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Direction</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "encode" | "decode")}
            disabled={mode === "jwt"}
            className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="encode">encode</option>
            <option value="decode">decode</option>
          </select>
        </label>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[8rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
        data-testid="encode-input"
      />
      <textarea
        value={error ? "" : output}
        readOnly
        spellCheck={false}
        className="w-full min-h-[8rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg"
        data-testid="encode-output"
      />

      {note ? <p className="font-mono text-xs text-muted">{note}</p> : null}
      {error ? (
        <p className="font-mono text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function apply(input: string, mode: Mode, direction: "encode" | "decode") {
  if (!input) return { output: "", note: null as string | null, error: null as string | null };
  try {
    if (mode === "jwt") return decodeJwt(input);
    if (direction === "encode") return { output: encode(input, mode), note: null, error: null };
    return { output: decode(input, mode), note: null, error: null };
  } catch (err) {
    return { output: "", note: null, error: (err as Error).message };
  }
}

function encode(input: string, mode: Exclude<Mode, "jwt">): string {
  switch (mode) {
    case "base64":
      return btoa(unescape(encodeURIComponent(input)));
    case "url":
      return encodeURIComponent(input);
    case "hex":
      return Array.from(new TextEncoder().encode(input))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
  }
}

function decode(input: string, mode: Exclude<Mode, "jwt">): string {
  switch (mode) {
    case "base64":
      return decodeURIComponent(escape(atob(input)));
    case "url":
      return decodeURIComponent(input);
    case "hex": {
      const cleaned = input.replace(/\s+/g, "");
      if (cleaned.length % 2 !== 0) throw new Error("Hex input must have an even length.");
      const bytes = new Uint8Array(cleaned.length / 2);
      for (let i = 0; i < bytes.length; i += 1) {
        const byte = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
        if (Number.isNaN(byte)) throw new Error(`Invalid hex byte at offset ${i}.`);
        bytes[i] = byte;
      }
      return new TextDecoder().decode(bytes);
    }
  }
}

function decodeJwt(input: string) {
  const parts = input.trim().split(".");
  if (parts.length !== 3) throw new Error("JWT must have three dot-separated segments.");
  const [headerB64, payloadB64, signature] = parts;
  const header = JSON.parse(atobUrl(headerB64));
  const payload = JSON.parse(atobUrl(payloadB64));
  return {
    output: JSON.stringify({ header, payload, signature }, null, 2),
    note: "Signature is shown as opaque base64; not verified.",
    error: null,
  };
}

function atobUrl(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return decodeURIComponent(escape(atob(padded + padding)));
}
