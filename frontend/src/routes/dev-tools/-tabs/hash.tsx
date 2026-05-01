import { useEffect, useState } from "react";
import { md5 } from "js-md5";

type Algorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-512";
const ALGORITHMS: Algorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-512"];

export function HashTab() {
  const [algorithm, setAlgorithm] = useState<Algorithm>("SHA-256");
  const [input, setInput] = useState("hello world");
  const [digest, setDigest] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!input) {
      setDigest("");
      return;
    }
    digestText(input, algorithm)
      .then((value) => {
        if (!cancelled) setDigest(value);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setDigest("");
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [input, algorithm]);

  return (
    <div className="space-y-4">
      <label className="block max-w-xs">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Algorithm</span>
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
          className="mt-2 w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        >
          {ALGORITHMS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[8rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
        data-testid="hash-input"
      />

      <pre className="bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs text-accent break-all whitespace-pre-wrap" data-testid="hash-output">
        {digest}
      </pre>

      {error ? <p className="font-mono text-xs text-error" role="alert">{error}</p> : null}
    </div>
  );
}

async function digestText(input: string, algorithm: Algorithm): Promise<string> {
  if (algorithm === "MD5") return md5(input);
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
