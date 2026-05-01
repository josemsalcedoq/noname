import { useState } from "react";

import {
  useCompleteTodo,
  useCreateTodo,
  useDeleteTodo,
  useReopenTodo,
  useTodos,
  type Todo,
} from "../api";

export function TodosTab() {
  const [statusFilter, setStatusFilter] = useState<"open" | "done">("open");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDueAt, setDraftDueAt] = useState("");

  const todos = useTodos({ status: statusFilter });
  const createTodo = useCreateTodo();
  const completeTodo = useCompleteTodo();
  const reopenTodo = useReopenTodo();
  const deleteTodo = useDeleteTodo();

  const onCreate = async () => {
    if (!draftTitle.trim()) return;
    await createTodo.mutateAsync({
      title: draftTitle.trim(),
      due_at: draftDueAt ? new Date(draftDueAt).toISOString() : null,
    });
    setDraftTitle("");
    setDraftDueAt("");
  };

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-sm p-4 space-y-3 bg-surface/40">
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="what needs doing?"
          className="w-full bg-bg border border-border text-fg font-mono text-sm px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
          data-testid="todo-title-input"
        />
        <div className="flex items-center gap-3">
          <input
            type="datetime-local"
            value={draftDueAt}
            onChange={(e) => setDraftDueAt(e.target.value)}
            className="flex-1 bg-bg border border-border text-fg font-mono text-xs px-3 py-2 rounded-sm focus:border-accent focus:outline-none"
            data-testid="todo-due-input"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={!draftTitle.trim() || createTodo.isPending}
            className="px-4 py-2 bg-accent text-bg font-mono text-sm rounded-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="todo-create-button"
          >
            {createTodo.isPending ? "saving…" : "add todo"}
          </button>
        </div>
      </section>

      <div className="flex gap-1 font-mono text-xs">
        <FilterButton active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>
          open
        </FilterButton>
        <FilterButton active={statusFilter === "done"} onClick={() => setStatusFilter("done")}>
          done
        </FilterButton>
      </div>

      {todos.isLoading ? (
        <p className="font-mono text-xs text-subtle">loading…</p>
      ) : (todos.data ?? []).length === 0 ? (
        <p className="font-mono text-xs text-subtle">no todos</p>
      ) : (
        <ul className="space-y-2">
          {(todos.data ?? []).map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              onComplete={() => completeTodo.mutate(todo.id)}
              onReopen={() => reopenTodo.mutate(todo.id)}
              onDelete={() => deleteTodo.mutate(todo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  onComplete,
  onReopen,
  onDelete,
}: {
  todo: Todo;
  onComplete: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const isDone = todo.completed_at !== null;
  return (
    <li
      className={[
        "border rounded-sm p-3 flex items-center gap-3",
        todo.is_overdue ? "border-error/60" : "border-border hover:border-muted",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => (isDone ? onReopen() : onComplete())}
        className="accent-accent w-4 h-4 cursor-pointer"
        data-testid={`todo-checkbox-${todo.id}`}
      />
      <div className="flex-1 min-w-0">
        <p className={["font-mono text-sm truncate", isDone ? "text-subtle line-through" : "text-fg"].join(" ")}>
          {todo.title}
        </p>
        {todo.due_at ? (
          <p className={["mt-0.5 font-mono text-[10px]", todo.is_overdue ? "text-error" : "text-subtle"].join(" ")}>
            due {formatDateTime(todo.due_at)}
            {todo.is_overdue ? " · overdue" : ""}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="font-mono text-[10px] text-subtle hover:text-error"
        title="delete"
      >
        ×
      </button>
    </li>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 uppercase tracking-[0.18em] border-b",
        active ? "text-accent border-accent" : "text-subtle border-transparent hover:text-fg",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
