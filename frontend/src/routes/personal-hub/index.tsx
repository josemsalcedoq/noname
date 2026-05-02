import { createFileRoute, Link } from "@tanstack/react-router";

import { BookmarksTab } from "./-components/bookmarks-tab";
import { NotesTab } from "./-components/notes-tab";
import { RemindersPanel } from "./-components/reminders-panel";
import { TodosTab } from "./-components/todos-tab";

type PersonalTab = "notes" | "todos" | "bookmarks";

const TABS: { id: PersonalTab; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "todos", label: "Todos" },
  { id: "bookmarks", label: "Bookmarks" },
];

export const Route = createFileRoute("/personal-hub/")({
  validateSearch: (search): { tab: PersonalTab } => {
    const candidate = (search as Record<string, unknown>).tab;
    const tab = TABS.find((t) => t.id === candidate)?.id ?? "notes";
    return { tab };
  },
  component: PersonalHubPage,
});

function PersonalHubPage() {
  const { tab } = Route.useSearch();

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">
          Personal · 05
        </p>
        <h1 className="font-mono text-3xl tracking-tight text-fg">Personal hub</h1>
        <p className="font-serif italic text-muted max-w-prose">
          Local notes and todos. Reminders fire as browser notifications while
          this tab is open.
        </p>
      </header>

      <RemindersPanel />

      <nav className="flex gap-1 border-b border-border" aria-label="Personal hub tabs">
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            to="/personal-hub"
            search={{ tab: entry.id }}
            className="px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-subtle hover:text-fg border-b border-transparent"
            activeProps={{
              className:
                "px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-accent border-b border-accent",
            }}
            activeOptions={{ includeSearch: true }}
            data-testid={`personal-tab-${entry.id}`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {tab === "notes" ? <NotesTab /> : tab === "todos" ? <TodosTab /> : <BookmarksTab />}
    </article>
  );
}
