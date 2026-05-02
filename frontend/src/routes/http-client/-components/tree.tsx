import { useState } from "react";

import {
  useCollections,
  useCollectionTree,
  useCreateCollection,
  useCreateFolder,
  useCreateRequest,
  useImportPostman,
  type CollectionTree,
  type Method,
  type TreeNode,
} from "../api";

export function TreeSidebar({
  selectedCollection,
  selectedRequest,
  onSelectCollection,
  onSelectRequest,
}: {
  selectedCollection: number | null;
  selectedRequest: number | null;
  onSelectCollection: (id: number | null) => void;
  onSelectRequest: (id: number) => void;
}) {
  const collections = useCollections();
  const tree = useCollectionTree(selectedCollection);
  const createCollection = useCreateCollection();
  const importPostman = useImportPostman();
  const createFolder = useCreateFolder();
  const createRequest = useCreateRequest();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const onImport = async (file: File) => {
    const created = await importPostman.mutateAsync(file);
    onSelectCollection(created.id);
  };

  const onCreateCollection = async () => {
    if (!newName.trim()) return;
    const created = await createCollection.mutateAsync({ name: newName.trim() });
    setNewName("");
    setShowNew(false);
    onSelectCollection(created.id);
  };

  return (
    <aside className="border border-border rounded-sm bg-surface/30 p-3 space-y-3 w-72 shrink-0 max-h-[calc(100vh-12rem)] overflow-auto">
      <div className="flex items-center gap-2">
        <select
          value={selectedCollection ?? ""}
          onChange={(e) => onSelectCollection(e.target.value ? Number(e.target.value) : null)}
          className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-2 py-1.5 rounded-sm focus:border-accent focus:outline-none"
          data-testid="collection-select"
        >
          <option value="">— pick collection —</option>
          {(collections.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNew((prev) => !prev)}
          className="px-2 py-1.5 border border-border hover:border-accent font-mono text-xs rounded-sm"
          title="New collection"
          data-testid="new-collection-toggle"
        >
          +
        </button>
      </div>

      {showNew ? (
        <div className="space-y-2 border-t border-border pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="collection name"
            className="w-full bg-bg border border-border text-fg font-mono text-xs px-2 py-1.5 rounded-sm focus:border-accent focus:outline-none"
            data-testid="new-collection-name"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCreateCollection}
              disabled={!newName.trim() || createCollection.isPending}
              className="flex-1 px-2 py-1 bg-accent text-bg font-mono text-xs rounded-sm hover:opacity-90 disabled:opacity-40"
              data-testid="new-collection-create"
            >
              create
            </button>
            <label className="flex-1 px-2 py-1 border border-border hover:border-accent font-mono text-xs rounded-sm text-center cursor-pointer">
              import .json
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(file);
                  e.target.value = "";
                }}
                data-testid="import-input"
              />
            </label>
          </div>
          {importPostman.isError ? (
            <p className="font-mono text-[10px] text-error" role="alert">
              {(importPostman.error as Error).message}
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedCollection !== null && tree.data ? (
        <CollectionTreeView
          tree={tree.data}
          selectedRequest={selectedRequest}
          onSelectRequest={onSelectRequest}
          onCreateFolder={(parent) => {
            const name = window.prompt("Folder name");
            if (name) createFolder.mutate({ collection: selectedCollection, parent, name });
          }}
          onCreateRequest={(folder) => {
            const name = window.prompt("Request name", "untitled");
            if (name) {
              createRequest.mutate({
                collection: selectedCollection,
                folder,
                name,
                method: "GET",
                url: "https://example.com",
              });
            }
          }}
        />
      ) : selectedCollection !== null && tree.isLoading ? (
        <p className="font-mono text-[11px] text-subtle">loading…</p>
      ) : (
        <p className="font-mono text-[11px] text-subtle">pick or create a collection</p>
      )}
    </aside>
  );
}

function CollectionTreeView({
  tree,
  selectedRequest,
  onSelectRequest,
  onCreateFolder,
  onCreateRequest,
}: {
  tree: CollectionTree;
  selectedRequest: number | null;
  onSelectRequest: (id: number) => void;
  onCreateFolder: (parent: number | null) => void;
  onCreateRequest: (folder: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent truncate">
          {tree.name}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onCreateRequest(null)}
            className="px-1.5 py-0.5 font-mono text-[10px] border border-border hover:border-accent rounded-sm"
            title="New request at root"
          >
            +req
          </button>
          <button
            type="button"
            onClick={() => onCreateFolder(null)}
            className="px-1.5 py-0.5 font-mono text-[10px] border border-border hover:border-accent rounded-sm"
            title="New folder at root"
          >
            +dir
          </button>
        </div>
      </div>
      <ul className="space-y-0.5">
        {tree.items.map((node) => (
          <NodeRow
            key={`${node.kind}-${node.id}`}
            node={node}
            depth={0}
            selectedRequest={selectedRequest}
            onSelectRequest={onSelectRequest}
            onCreateFolder={onCreateFolder}
            onCreateRequest={onCreateRequest}
          />
        ))}
      </ul>
    </div>
  );
}

function NodeRow({
  node,
  depth,
  selectedRequest,
  onSelectRequest,
  onCreateFolder,
  onCreateRequest,
}: {
  node: TreeNode;
  depth: number;
  selectedRequest: number | null;
  onSelectRequest: (id: number) => void;
  onCreateFolder: (parent: number | null) => void;
  onCreateRequest: (folder: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.kind === "request") {
    const active = node.id === selectedRequest;
    return (
      <li
        style={{ paddingLeft: depth * 10 }}
        className={[
          "flex items-center gap-2 px-1 py-0.5 font-mono text-xs cursor-pointer rounded-sm",
          active ? "bg-accent-soft text-accent" : "text-muted hover:text-fg",
        ].join(" ")}
        onClick={() => onSelectRequest(node.id)}
        data-testid={`tree-request-${node.id}`}
      >
        <MethodBadge method={node.method} />
        <span className="truncate">{node.name}</span>
      </li>
    );
  }

  return (
    <li>
      <div
        style={{ paddingLeft: depth * 10 }}
        className="flex items-center gap-1 px-1 py-0.5 font-mono text-xs text-fg"
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-subtle hover:text-fg"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="truncate flex-1">{node.name}</span>
        <button
          type="button"
          onClick={() => onCreateRequest(node.id)}
          className="px-1 font-mono text-[9px] border border-border hover:border-accent rounded-sm opacity-60 hover:opacity-100"
          title="New request in this folder"
        >
          +req
        </button>
        <button
          type="button"
          onClick={() => onCreateFolder(node.id)}
          className="px-1 font-mono text-[9px] border border-border hover:border-accent rounded-sm opacity-60 hover:opacity-100"
          title="New nested folder"
        >
          +dir
        </button>
      </div>
      {expanded ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <NodeRow
              key={`${child.kind}-${child.id}`}
              node={child}
              depth={depth + 1}
              selectedRequest={selectedRequest}
              onSelectRequest={onSelectRequest}
              onCreateFolder={onCreateFolder}
              onCreateRequest={onCreateRequest}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MethodBadge({ method }: { method: Method }) {
  const colors: Record<Method, string> = {
    GET: "text-success",
    POST: "text-accent",
    PUT: "text-accent",
    PATCH: "text-accent",
    DELETE: "text-error",
    HEAD: "text-muted",
    OPTIONS: "text-muted",
  };
  return (
    <span className={`font-mono text-[10px] uppercase tracking-tight ${colors[method] ?? "text-muted"} w-10 shrink-0`}>
      {method}
    </span>
  );
}
