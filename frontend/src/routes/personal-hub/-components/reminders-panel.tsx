import { useEffect, useMemo, useRef, useState } from "react";

import {
  useCompleteTodo,
  useDismissReminder,
  useDueReminders,
  useSnoozeTodo,
  type Todo,
} from "../api";

const NOTIFICATION_AVAILABLE = typeof window !== "undefined" && "Notification" in window;

export function RemindersPanel() {
  const reminders = useDueReminders();
  const snooze = useSnoozeTodo();
  const dismiss = useDismissReminder();
  const complete = useCompleteTodo();

  const items = useMemo(() => reminders.data?.reminders ?? [], [reminders.data]);

  const notifiedRef = useRef<Set<number>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission>(
    NOTIFICATION_AVAILABLE ? Notification.permission : "denied",
  );

  useEffect(() => {
    if (!NOTIFICATION_AVAILABLE || permission !== "granted") return;
    items.forEach((todo) => {
      if (notifiedRef.current.has(todo.id)) return;
      notifiedRef.current.add(todo.id);
      new Notification("noname · reminder", {
        body: todo.title,
        tag: `todo-${todo.id}`,
        icon: "/favicon.svg",
      });
    });
  }, [items, permission]);

  if (items.length === 0 && permission !== "default") return null;

  const requestPermission = async () => {
    if (!NOTIFICATION_AVAILABLE) return;
    const next = await Notification.requestPermission();
    setPermission(next);
  };

  return (
    <section className="border border-accent/40 bg-accent-soft rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
          Reminders due
        </p>
        {items.length === 0 ? null : (
          <span className="font-mono text-[10px] text-accent">{items.length}</span>
        )}
      </div>

      {permission === "default" && NOTIFICATION_AVAILABLE ? (
        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
          <span>Allow desktop notifications so reminders ping when this tab is in the background.</span>
          <button
            type="button"
            onClick={requestPermission}
            className="ml-3 px-2 py-1 border border-accent text-accent rounded-sm hover:bg-accent hover:text-bg"
            data-testid="enable-notifications"
          >
            enable
          </button>
        </div>
      ) : null}

      {items.length === 0 ? null : (
        <ul className="space-y-2">
          {items.map((todo) => (
            <ReminderRow
              key={todo.id}
              todo={todo}
              onSnooze={(minutes) => snooze.mutate({ id: todo.id, minutes })}
              onDone={() => complete.mutate(todo.id)}
              onDismiss={() => dismiss.mutate(todo.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReminderRow({
  todo,
  onSnooze,
  onDone,
  onDismiss,
}: {
  todo: Todo;
  onSnooze: (minutes: number) => void;
  onDone: () => void;
  onDismiss: () => void;
}) {
  return (
    <li className="flex items-center gap-3 bg-bg/40 rounded-sm px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-fg truncate">{todo.title}</p>
        {todo.remind_at ? (
          <p className="font-mono text-[10px] text-subtle">
            {formatRelative(todo.remind_at)}
          </p>
        ) : null}
      </div>
      <div className="flex gap-1 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => onSnooze(10)}
          className="px-2 py-1 border border-border hover:border-accent rounded-sm"
          data-testid={`reminder-snooze-${todo.id}`}
        >
          snooze 10m
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-2 py-1 border border-border hover:border-success text-success rounded-sm"
          data-testid={`reminder-done-${todo.id}`}
        >
          done
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-2 py-1 border border-border hover:border-muted text-subtle rounded-sm"
          data-testid={`reminder-dismiss-${todo.id}`}
        >
          dismiss
        </button>
      </div>
    </li>
  );
}

function formatRelative(iso: string): string {
  const target = new Date(iso).getTime();
  const diffSec = Math.round((target - Date.now()) / 1000);
  if (diffSec >= 0 && diffSec < 60) return `in ${diffSec}s`;
  if (diffSec < 0 && diffSec > -60) return `${-diffSec}s ago`;
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const minutes = Math.round(diffSec / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
