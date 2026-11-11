import type { Position } from "./overrides";

export type Change = {
  selector: string;
  name: string;
  before: string | null;
  after: string | null;
  at?: Position;
};
export type History = { steps: Change[][]; cursor: number };

const field = (input: unknown, key: string): unknown =>
  typeof input === "object" && input !== null ? Reflect.get(input, key) : undefined;
const nullable = (input: unknown): input is string | null =>
  input === null || typeof input === "string";

function readChange(input: unknown): Change | null {
  const [selector, name, before, after, at] = ["selector", "name", "before", "after", "at"].map(
    (key) => field(input, key),
  );
  if (
    typeof selector !== "string" ||
    typeof name !== "string" ||
    !nullable(before) ||
    !nullable(after)
  )
    return null;
  if (at !== undefined && !isPosition(at)) return null;
  return { selector, name, before, after, ...(at === undefined ? {} : { at }) };
}

/** A saved property's block and declaration offsets, used only when restoring a deletion. */
export function isPosition(at: unknown): at is Position {
  return Array.isArray(at) && at.length === 2 && at.every((n) => Number.isInteger(n) && n >= 0);
}

/** Adds one release, dropping redo steps and changes that saved nothing. */
export function push(history: History, changes: Change[]): History {
  const step = changes.filter((c) => c.before !== c.after);
  return step.length === 0
    ? history
    : { steps: [...history.steps.slice(0, history.cursor), step], cursor: history.cursor + 1 };
}

/** Moves the cursor only after a successful replay. */
export function move(history: History, direction: -1 | 1): History {
  return {
    ...history,
    cursor: Math.max(0, Math.min(history.steps.length, history.cursor + direction)),
  };
}

/** Parses one release from a save response or tab storage. */
export function readChanges(input: unknown): Change[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const items: unknown[] = input;
  const changes: Change[] = [];
  for (const item of items) {
    const change = readChange(item);
    if (change === null) return null;
    changes.push(change);
  }
  return changes;
}

/** Parses tab storage, rejecting malformed or older history shapes. */
export function readHistory(raw: string | null): { head: string; history: History } | null {
  try {
    const data: unknown = JSON.parse(raw ?? "null");
    const head = field(data, "head");
    const h = field(data, "history");
    const rawSteps = field(h, "steps");
    const cursor = field(h, "cursor");
    if (typeof head !== "string" || !Array.isArray(rawSteps)) return null;
    if (
      typeof cursor !== "number" ||
      !Number.isInteger(cursor) ||
      cursor < 0 ||
      cursor > rawSteps.length
    )
      return null;
    const items: unknown[] = rawSteps;
    const steps: Change[][] = [];
    for (const item of items) {
      const step = readChanges(item);
      if (step === null) return null;
      steps.push(step);
    }
    return { head, history: { steps, cursor } };
  } catch {
    return null;
  }
}

/** The saved-history shortcut's direction, independent of focus or the document's realm. */
export function historyDirection(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
): -1 | 1 | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? 1 : -1;
  return event.ctrlKey && key === "y" ? 1 : null;
}
