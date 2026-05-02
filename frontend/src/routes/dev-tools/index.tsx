import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { CronTab } from "./-tabs/cron";
import { DiffTab } from "./-tabs/diff";
import { EncoderDecoderTab } from "./-tabs/encoder-decoder";
import { FormatConverterTab } from "./-tabs/format-converter";
import { HashTab } from "./-tabs/hash";
import { JwtTab } from "./-tabs/jwt";
import { MarkdownTab } from "./-tabs/markdown";
import { PasswordTab } from "./-tabs/password";
import { QrTab } from "./-tabs/qr";
import { RegexTab } from "./-tabs/regex";
import { TimestampTab } from "./-tabs/timestamp";
import { UuidTab } from "./-tabs/uuid";

export type DevToolsTab =
  | "format"
  | "encode"
  | "jwt"
  | "hash"
  | "qr"
  | "regex"
  | "markdown"
  | "cron"
  | "diff"
  | "uuid"
  | "timestamp"
  | "password";

const TABS: { id: DevToolsTab; label: string }[] = [
  { id: "format", label: "Format" },
  { id: "encode", label: "Encode" },
  { id: "jwt", label: "JWT" },
  { id: "hash", label: "Hash" },
  { id: "qr", label: "QR" },
  { id: "regex", label: "Regex" },
  { id: "markdown", label: "Markdown" },
  { id: "cron", label: "Cron" },
  { id: "diff", label: "Diff" },
  { id: "uuid", label: "UUID" },
  { id: "timestamp", label: "Time" },
  { id: "password", label: "Password" },
];

const COMPONENTS: Record<DevToolsTab, ComponentType> = {
  format: FormatConverterTab,
  encode: EncoderDecoderTab,
  jwt: JwtTab,
  hash: HashTab,
  qr: QrTab,
  regex: RegexTab,
  markdown: MarkdownTab,
  cron: CronTab,
  diff: DiffTab,
  uuid: UuidTab,
  timestamp: TimestampTab,
  password: PasswordTab,
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
          Twelve small helpers, each running entirely in the browser. Nothing
          leaves this tab.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Dev tool tabs">
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
