import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EncoderDecoderTab } from "./_tabs/encoder-decoder";
import { FormatConverterTab } from "./_tabs/format-converter";
import { HashTab } from "./_tabs/hash";
import { MarkdownTab } from "./_tabs/markdown";
import { QrTab } from "./_tabs/qr";
import { RegexTab } from "./_tabs/regex";

export type DevToolsTab =
  | "format"
  | "encode"
  | "hash"
  | "qr"
  | "regex"
  | "markdown";

const TABS: { id: DevToolsTab; label: string }[] = [
  { id: "format", label: "Format" },
  { id: "encode", label: "Encode" },
  { id: "hash", label: "Hash" },
  { id: "qr", label: "QR" },
  { id: "regex", label: "Regex" },
  { id: "markdown", label: "Markdown" },
];

const COMPONENTS: Record<DevToolsTab, ComponentType> = {
  format: FormatConverterTab,
  encode: EncoderDecoderTab,
  hash: HashTab,
  qr: QrTab,
  regex: RegexTab,
  markdown: MarkdownTab,
};

export const Route = createFileRoute("/dev-tools/")({
  validateSearch: (search): { tab: DevToolsTab } => {
    const candidate = (search as Record<string, unknown>).tab;
    const tab = TABS.find((t) => t.id === candidate)?.id ?? "format";
    return { tab };
  },
  component: DevToolsPage,
});

function DevToolsPage() {
  const { tab } = Route.useSearch();
  const Active = COMPONENTS[tab];

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Developer · 04
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">Dev tools</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Six small helpers, each running entirely in the browser. Nothing leaves
          this tab.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border" aria-label="Dev tool tabs">
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            to="/dev-tools"
            search={{ tab: entry.id }}
            className="px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-subtle hover:text-fg border-b border-transparent"
            activeProps={{
              className:
                "px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-accent border-b border-accent",
            }}
            activeOptions={{ includeSearch: true }}
            data-testid={`tab-${entry.id}`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <section className="pt-2">
        <Active />
      </section>
    </article>
  );
}
