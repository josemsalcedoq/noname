import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { consumeHandoff } from "../../lib/handoff";
import {
  useTranslateText,
  type SourceLang,
  type TargetLang,
} from "./api";

export const Route = createFileRoute("/text-translator/")({
  component: TextTranslatorPage,
});

const TARGETS: TargetLang[] = ["en", "es"];
const SOURCES: SourceLang[] = ["auto", "en", "es"];

function TextTranslatorPage() {
  const [source, setSource] = useState<SourceLang>("en");
  const [target, setTarget] = useState<TargetLang>("es");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [detected, setDetected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const translate = useTranslateText();
  const handoffConsumed = useRef(false);

  useEffect(() => {
    if (handoffConsumed.current) return;
    const handoff = consumeHandoff("text");
    if (!handoff) return;
    handoffConsumed.current = true;
    setInput(handoff.text);
    if (handoff.source === "auto" || handoff.source === "en" || handoff.source === "es") {
      setSource(handoff.source);
    }
    if (handoff.target === "en" || handoff.target === "es") {
      setTarget(handoff.target);
    }
  }, []);

  const swap = () => {
    if (source === "auto") return;
    setSource(target);
    setTarget(source);
    setInput(output);
    setOutput(input);
    setDetected(null);
  };

  const onTranslate = async () => {
    if (!input.trim()) {
      setOutput("");
      setDetected(null);
      return;
    }
    try {
      const result = await translate.mutateAsync({ source, target, text: input });
      setOutput(result.text);
      setDetected(result.detected_source ?? null);
    } catch {
      // mutation error surfaces via translate.error
    }
  };

  const onCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Translation · 02
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">Text translator</h1>
        <p className="font-serif italic text-muted max-w-prose">
          English ↔ Spanish, runs offline on the local NMT model.
        </p>
      </header>

      <div className="grid gap-px bg-border md:grid-cols-[1fr_auto_1fr] rounded-sm overflow-hidden border border-border">
        <Pane
          label="Source"
          lang={source}
          languageOptions={SOURCES}
          onLangChange={(value) => setSource(value as SourceLang)}
          value={input}
          onChange={setInput}
          editable
          hint={
            source === "auto" && detected
              ? `detected · ${detected}`
              : `${input.length.toLocaleString()} / 50,000`
          }
        />
        <button
          type="button"
          onClick={swap}
          disabled={source === "auto"}
          className="px-4 self-stretch bg-bg hover:bg-accent-soft disabled:opacity-30 disabled:cursor-not-allowed text-fg transition-colors"
          title="Swap languages"
          data-testid="swap-button"
        >
          ⇄
        </button>
        <Pane
          label="Target"
          lang={target}
          languageOptions={TARGETS}
          onLangChange={(value) => setTarget(value as TargetLang)}
          value={output}
          editable={false}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onTranslate}
          disabled={translate.isPending || !input.trim()}
          className="px-5 py-2 bg-accent text-bg font-mono text-sm tracking-tight rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="translate-button"
        >
          {translate.isPending ? "translating…" : "translate"}
        </button>
        <div className="flex items-center gap-3">
          {translate.isError ? (
            <span className="font-mono text-xs text-error" role="alert">
              {(translate.error as Error).message}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onCopy}
            disabled={!output}
            className="px-3 py-2 font-mono text-sm border border-border hover:border-accent disabled:opacity-30 rounded-sm"
            data-testid="copy-button"
          >
            {copied ? "copied" : "copy output"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Pane({
  label,
  lang,
  languageOptions,
  onLangChange,
  value,
  onChange,
  editable,
  hint,
}: {
  label: string;
  lang: string;
  languageOptions: readonly string[];
  onLangChange?: (value: string) => void;
  value: string;
  onChange?: (value: string) => void;
  editable: boolean;
  hint?: string;
}) {
  return (
    <div className="bg-bg p-5 flex flex-col min-h-[18rem]">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
          {label}
        </span>
        {onLangChange ? (
          <select
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            className="bg-bg border border-border text-fg font-mono text-xs px-2 py-1 rounded-sm focus:border-accent focus:outline-none"
            data-testid={`${label.toLowerCase()}-lang`}
          >
            {languageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-xs text-muted">{lang}</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={editable ? (e) => onChange?.(e.target.value) : undefined}
        readOnly={!editable}
        placeholder={editable ? "Type or paste text…" : ""}
        maxLength={50_000}
        className="flex-1 resize-none bg-transparent text-fg font-serif text-base leading-relaxed focus:outline-none placeholder:text-subtle"
        data-testid={`${label.toLowerCase()}-textarea`}
      />
      {hint ? (
        <p className="mt-3 font-mono text-[10px] text-subtle text-right">{hint}</p>
      ) : null}
    </div>
  );
}
