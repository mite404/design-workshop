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

/** A reference's label, its tag and first words: "button · Start with a refund workflow". */
export function labelOf(tag: string, name: string): string {
  const words = name.replaceAll(/\s+/g, " ").trim(); // "  Start\n with " → "Start with"
  const short = words.length > 40 ? `${words.slice(0, 39).trimEnd()}…` : words;
  return short === "" ? tag : `${tag} · ${short}`;
}
