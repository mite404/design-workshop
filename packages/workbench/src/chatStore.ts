// A component's chat as stored (R19): one list of sent messages per `data-wb` name, in the
// browser's localStorage. A reference keeps its identity when chosen, never its element.

/** A sent reference without its element: what was chosen, where, and its values then. */
export type StoredRef = {
  label: string;
  selector: string;
  preview: string;
  source: string;
  values: string[];
};

/** A sent message: its text and its references. */
export type Message = { text: string; refs: StoredRef[] };

/** The localStorage key of the chat of `component`, a `data-wb` name. */
export const chatKeyOf = (component: string): string => `workbench-chat:${component}`;

const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

const isStoredRef = (v: unknown): v is StoredRef =>
  typeof v === "object" &&
  v !== null &&
  ["label", "selector", "preview", "source"].every((k) => typeof Reflect.get(v, k) === "string") &&
  strings(Reflect.get(v, "values"));

function isMessage(v: unknown): v is Message {
  if (typeof v !== "object" || v === null) return false;
  const refs: unknown = Reflect.get(v, "refs");
  return (
    typeof Reflect.get(v, "text") === "string" &&
    Array.isArray(refs) &&
    refs.every((r) => isStoredRef(r))
  );
}

/**
 * The messages in a stored chat's `text`, null when there is none. A message that is not this
 * shape is dropped, never shown half read; text that is not JSON is no messages.
 */
export function parseMessages(text: string | null): Message[] {
  try {
    const parsed: unknown = JSON.parse(text ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((m) => isMessage(m)) : [];
  } catch {
    return [];
  }
}

/** What a reference keeps once sent, without its element. */
export const storedRef = (ref: StoredRef): StoredRef => ({
  label: ref.label,
  selector: ref.selector,
  preview: ref.preview,
  source: ref.source,
  values: ref.values,
});
