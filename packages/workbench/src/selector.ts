// An element's identity in the override file (ADR-012): its `data-wb` name when it has one,
// otherwise a path of tags and `:nth-child()` steps from the nearest ancestor with a `data-wb` or
// an `id`, or from `body`. Class names never appear: Tailwind's change whenever styling does.

/** One element on the way up to `body`: its tag, its 1-based place among its siblings, and the
 * `data-wb` and `id` it has, given only when no other element in the page shares them. */
export type Step = { tag: string; index: number; wb: string | null; id: string | null };

const IDENT = "[A-Za-z][\\w-]*";
const ANCHOR = `(?:body|#${IDENT}|\\[data-wb="${IDENT}"\\])`;
const PATH_STEP = ` > [A-Za-z][\\w-]*:nth-child\\([1-9]\\d{0,3}\\)`;
const GRAMMAR = new RegExp(`^${ANCHOR}(?:${PATH_STEP}){0,64}$`);
const NAME = new RegExp(`^${IDENT}$`);

function anchor({ tag, wb, id }: Step): string | null {
  if (wb !== null && NAME.test(wb)) return `[data-wb="${wb}"]`;
  if (id !== null && NAME.test(id)) return `#${id}`;
  return tag === "body" ? "body" : null;
}

/**
 * The selector for the first step's element, given the steps from it up to `body`.
 * @throws when no step is `body` or has a usable `data-wb` or `id`.
 */
export function selectorFor(steps: Step[]): string {
  const at = steps.findIndex((s) => anchor(s) !== null);
  const top = steps[at];
  if (top === undefined) throw new Error("selectorFor: the steps must reach body");
  const path = steps.slice(0, at).toReversed(); // from the anchor's child down to the element
  return [anchor(top), ...path.map((s) => `${s.tag}:nth-child(${s.index})`)].join(" > ");
}

/** Whether `text` has exactly the shape `selectorFor` produces, the only selectors the
 * override file accepts for an element. */
export const isSelector = (text: string): boolean => GRAMMAR.test(text);

/**
 * The element a click selects (Figma's rule): of the elements under the pointer, outermost
 * first, the one just inside the deepest ancestor the click shares with the selection. With
 * nothing selected that is the outermost; inside the selection it is one level deeper. Null when
 * nothing is under the pointer.
 */
export function pick<T>(under: T[], selected: T[]): T | null {
  const shared = under.findIndex((node, i) => selected[i] !== node);
  return under[Math.min(shared === -1 ? under.length : shared, under.length - 1)] ?? null;
}
