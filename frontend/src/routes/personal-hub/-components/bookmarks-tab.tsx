import { useState } from "react";

import {
  useArchiveBookmark,
  useBookmarks,
  useCreateBookmark,
  useDeleteBookmark,
  type Bookmark,
} from "../api";

export function BookmarksTab() {
  const [search, setSearch] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftTags, setDraftTags] = useState("");

  const bookmarks = useBookmarks({ search });
  const createBookmark = useCreateBookmark();
  const archiveBookmark = useArchiveBookmark();
  const deleteBookmark = useDeleteBookmark();

  const onCreate = async () => {
    if (!draftUrl.trim()) return;
    await createBookmark.mutateAsync({
      url: draftUrl.trim(),
      title: draftTitle.trim(),
      notes: draftNotes,
      tags: parseTags(draftTags),
    });
    setDraftUrl("");
    setDraftTitle("");
    setDraftNotes("");
    setDraftTags("");
  };

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-sm p-4 space-y-3 bg-surface/40">
        <input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="bookmark-url-input"
        />
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="title (optional — will use URL if blank)"
          className="w-full bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="bookmark-title-input"
        />
        <textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="notes (optional)"
          rows={2}
          className="w-full bg-bg border border-border text-fg font-serif text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="bookmark-notes-input"
        />
        <div className="flex items-center gap-3">
          <input
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            placeholder="tags (comma-separated)"
            className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="bookmark-tags-input"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={!draftUrl.trim() || createBookmark.isPending}
            className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40"
            data-testid="bookmark-create-button"
          >
            {createBookmark.isPending ? "saving…" : "save"}
          </button>
        </div>
      </section>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search url, title, or notes"
        className="w-full bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
        data-testid="bookmark-search"
      />

      {bookmarks.isLoading ? (
        <p className="font-mono text-xs text-subtle">loading…</p>
      ) : (bookmarks.data ?? []).length === 0 ? (
        <p className="font-mono text-xs text-subtle">no bookmarks</p>
      ) : (
        <ul className="space-y-2">
          {(bookmarks.data ?? []).map((bookmark) => (
            <BookmarkRow
              key={bookmark.id}
              bookmark={bookmark}
              onArchive={() => archiveBookmark.mutate(bookmark.id)}
              onDelete={() => deleteBookmark.mutate(bookmark.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BookmarkRow({
  bookmark,
  onArchive,
  onDelete,
}: {
  bookmark: Bookmark;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const display = bookmark.title || bookmark.url;
  let host: string;
  try {
    host = new URL(bookmark.url).hostname;
  } catch {
    host = "";
  }
  return (
    <li className="border border-border rounded-sm p-3 hover:border-muted">
      <div className="flex items-start justify-between gap-3">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer"
          className="block min-w-0 flex-1"
        >
          <p className="font-mono text-sm text-fg hover:text-accent truncate">{display}</p>
          {host ? (
            <p className="font-mono text-[10px] text-subtle truncate">{host}</p>
          ) : null}
        </a>
        <div className="flex gap-1 shrink-0 font-mono text-[10px]">
          <button
            type="button"
            onClick={onArchive}
            className="px-2 py-1 border border-border hover:border-accent rounded-sm"
          >
            archive
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 border border-error text-error hover:bg-error/10 rounded-sm"
          >
            delete
          </button>
        </div>
      </div>
      {bookmark.notes ? (
        <p className="mt-2 font-serif text-xs text-muted whitespace-pre-wrap">{bookmark.notes}</p>
      ) : null}
      {bookmark.tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {bookmark.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-accent bg-accent-soft rounded-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}
