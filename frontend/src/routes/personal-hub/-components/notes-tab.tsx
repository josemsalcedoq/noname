import { useState } from "react";

import {
  useArchiveNote,
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUnarchiveNote,
  type Note,
} from "../api";

export function NotesTab() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTags, setDraftTags] = useState("");

  const notes = useNotes({ search, archived: showArchived });
  const createNote = useCreateNote();
  const archiveNote = useArchiveNote();
  const unarchiveNote = useUnarchiveNote();
  const deleteNote = useDeleteNote();

  const onCreate = async () => {
    if (!draftTitle.trim()) return;
    await createNote.mutateAsync({
      title: draftTitle.trim(),
      body: draftBody,
      tags: parseTags(draftTags),
    });
    setDraftTitle("");
    setDraftBody("");
    setDraftTags("");
  };

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-sm p-4 space-y-3 bg-surface/40">
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="title"
          className="w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="note-title-input"
        />
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          placeholder="body (markdown supported)"
          rows={3}
          className="w-full bg-bg border border-border text-fg font-serif text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="note-body-input"
        />
        <div className="flex items-center gap-3">
          <input
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            placeholder="tags (comma-separated)"
            className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="note-tags-input"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={!draftTitle.trim() || createNote.isPending}
            className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="note-create-button"
          >
            {createNote.isPending ? "saving…" : "add note"}
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search"
          className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="note-search"
        />
        <button
          type="button"
          onClick={() => setShowArchived((prev) => !prev)}
          className="px-3 py-2 border border-border hover:border-accent font-mono text-xs rounded-sm"
          data-testid="archived-toggle"
        >
          {showArchived ? "showing archived" : "active only"}
        </button>
      </div>

      {notes.isLoading ? (
        <p className="font-mono text-xs text-subtle">loading…</p>
      ) : (notes.data ?? []).length === 0 ? (
        <p className="font-mono text-xs text-subtle">no notes</p>
      ) : (
        <ul className="space-y-2">
          {(notes.data ?? []).map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              isArchivedView={showArchived}
              onArchive={() => archiveNote.mutate(note.id)}
              onUnarchive={() => unarchiveNote.mutate(note.id)}
              onDelete={() => deleteNote.mutate(note.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteRow({
  note,
  isArchivedView,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  note: Note;
  isArchivedView: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="border border-border rounded-sm p-3 hover:border-muted">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-left w-full"
      >
        <p className="font-mono text-sm text-fg">{note.title}</p>
        {!expanded && note.body ? (
          <p className="mt-1 font-serif text-xs text-muted truncate">{firstLine(note.body)}</p>
        ) : null}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2">
          {note.body ? (
            <pre className="font-serif text-sm text-fg whitespace-pre-wrap">{note.body}</pre>
          ) : null}
          {note.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-accent bg-accent-soft rounded-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 font-mono text-xs">
            {isArchivedView ? (
              <button type="button" onClick={onUnarchive} className="px-2 py-1 border border-border hover:border-accent rounded-sm">
                unarchive
              </button>
            ) : (
              <button type="button" onClick={onArchive} className="px-2 py-1 border border-border hover:border-accent rounded-sm">
                archive
              </button>
            )}
            <button type="button" onClick={onDelete} className="px-2 py-1 border border-error text-error hover:bg-error/10 rounded-sm">
              delete
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function firstLine(text: string): string {
  return text.split("\n")[0] ?? "";
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}
