import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useCatalog, useRefreshCatalog } from "./api";
import { SkillCard } from "./-components/skill-card";

export const Route = createFileRoute("/skills/")({
  component: SkillsPage,
});

function SkillsPage() {
  const [filter, setFilter] = useState("");
  const catalog = useCatalog();
  const refresh = useRefreshCatalog();

  const skills = useMemo(() => {
    const list = catalog.data?.skills ?? [];
    if (!filter.trim()) return list;
    const needle = filter.toLowerCase();
    return list.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [catalog.data, filter]);

  const installedCount = (catalog.data?.skills ?? []).filter((s) => s.installed).length;

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Claude · 06
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">Skills</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Browse and install skills from{" "}
          <a
            href="https://github.com/anthropics/skills"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline underline-offset-2"
          >
            anthropics/skills
          </a>
          . Installs land in <span className="font-mono text-fg">~/.claude/skills/</span>.
          Each card has a "manual steps" button if you'd rather copy-paste the install snippet.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter by name or description"
          className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="skill-filter"
        />
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="px-3 py-2 border border-border hover:border-accent font-mono text-xs rounded-sm disabled:opacity-40"
          data-testid="refresh-catalog"
        >
          {refresh.isPending ? "refreshing…" : "refresh"}
        </button>
        <span className="font-mono text-[11px] text-subtle whitespace-nowrap">
          {catalog.data ? `${installedCount} / ${catalog.data.skills.length}` : "—"}
        </span>
      </div>

      {catalog.isLoading ? (
        <p className="font-mono text-xs text-subtle">loading catalog…</p>
      ) : catalog.isError ? (
        <p className="font-mono text-xs text-error" role="alert">
          {(catalog.error as Error).message}
        </p>
      ) : skills.length === 0 ? (
        <p className="font-mono text-xs text-subtle">no skills match the filter</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((skill) => (
            <SkillCard key={skill.name} skill={skill} />
          ))}
        </div>
      )}
    </article>
  );
}
