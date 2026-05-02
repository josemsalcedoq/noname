const KEY = "noname:handoff:v1";

export type Handoff =
  | { kind: "yt-to-transcriber"; jobId: string; filename?: string }
  | { kind: "text"; text: string; source?: string; target?: string }
  | { kind: "srt"; content: string; source: string; target: string; filename?: string };

export function setHandoff(handoff: Handoff): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(handoff));
}

export function consumeHandoff<T extends Handoff["kind"]>(
  kind: T,
): Extract<Handoff, { kind: T }> | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  let parsed: Handoff;
  try {
    parsed = JSON.parse(raw) as Handoff;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
  if (parsed.kind !== kind) return null;
  window.sessionStorage.removeItem(KEY);
  return parsed as Extract<Handoff, { kind: T }>;
}
