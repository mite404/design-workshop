// How the chat's element reference (ETH-110) aims and names its target, kept free of the page so
// it can be tested on its own.
import { inside } from "./dom";
import type { Box } from "./radius";

// px the pointer may stray past the highlighted element before a neighbour or container takes
// over. ponytail: one fixed band; tune it here if small adjacent controls feel sticky.
const SLOP = 6;

/**
 * Whether the highlight stays on the element in `current` while the pointer at `point` is over
 * another one: until the pointer leaves `current` by more than a few pixels, unless the other
 * element is inside `current`, which is a deliberate move to its child.
 */
export const holds = (current: Box, point: { x: number; y: number }, intoChild: boolean): boolean =>
  !intoChild &&
  inside(point, {
    left: current.left - SLOP,
    top: current.top - SLOP,
    width: current.width + 2 * SLOP,
    height: current.height + 2 * SLOP,
  });

/**
 * Where a reference lives in code (R12): the line declaring the named component around it, then
 * its name, `packages/catalog/src/ComposeBox.tsx:193 · ComposeBox`; path first, so a narrow chip
 * wraps the short name. Never guessed: an element outside every named component, or a name the
 * source scan did not find, says so.
 */
export function sourceOf(owner: string | null, known: unknown): string {
  if (owner === null) return "No named component";
  const at: unknown =
    typeof known === "object" && known !== null ? Reflect.get(known, owner) : null;
  // A no-break space ties the dot to the name, so a wrap moves both to the next line.
  return typeof at === "string" ? `${at} ·\u00A0${owner}` : `${owner} · source not found`;
}

/**
 * A reference's current values (R12): each named property as the browser renders it, in order,
 * as `name: value` lines. Ethan: "the property currently being rendered in live mode".
 */
export const currentValues = (names: readonly string[], read: (name: string) => string): string[] =>
  names.map((name) => `${name}: ${read(name).trim() || "none"}`); // → ["gap: 8px", …]

/** A reference's label, its tag and first words: "button · Start with a refund workflow". */
export function labelOf(tag: string, name: string): string {
  const words = name.replaceAll(/\s+/g, " ").trim(); // "  Start\n with " → "Start with"
  const short = words.length > 40 ? `${words.slice(0, 39).trimEnd()}…` : words;
  return short === "" ? tag : `${tag} · ${short}`;
}
