// What the Workbench page reads from the DOM, its own and the framed app's: computed values,
// boxes, the elements a click can select, and the override file as the frame has it.
import type { Box } from "./radius";
import { selectorFor, type Step } from "./selector";
import type { Offset, Spacing } from "./spacing";

/** The requested app URL, the single demo chat by default, or `/` for an unsafe target. */
export function canvasPath(search: string): string {
  const path = new URLSearchParams(search).get("path") ?? "/t/demo-brief";
  try {
    const decoded = decodeURIComponent(path);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.split("").some((c) => c === "\\" || c <= " ")
    )
      return "/";
    const url = new URL(decoded, "https://workbench.invalid");
    if (url.pathname.startsWith("/__workbench")) return "/";
    return path;
  } catch {
    return "/";
  }
}

/** An element that takes inline styles: HTML or SVG. */
export type Styled = Element & ElementCSSInlineStyle;

/** A new element of the Workbench page with `props` and `children`. */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** A CSS length's number of pixels: "20px" → 20. */
// oxlint-disable-next-line prefer-number-coercion -- Number("20px") is NaN
export const px = (value: string): number => Number.parseFloat(value);

const size = (value: string): number => px(value) || 0; // "normal" → 0

/** `node`'s computed style, from the window of its own document. */
export const style = (node: Element): CSSStyleDeclaration =>
  (node.ownerDocument.defaultView ?? window).getComputedStyle(node);

/** Whether an element supports inline CSS, including elements from the canvas's realm. */
export const styled = (node: Element): node is Styled => "style" in node;

/** A typed whole number of 0 to 9999, with or without "px", or null for anything else. */
export function wholeNumber(typed: string): number | null {
  const digits = /^\s*(\d{1,4})\s*(?:px)?\s*$/.exec(typed)?.[1]; // " 20px " → "20"
  return digits === undefined ? null : Number(digits);
}

/** Whether `node` lays out its children with flex or grid, so it has a gap. */
export const laysOut = (node: Element): boolean => /flex|grid/.test(style(node).display);

/** Whether `point` is inside `rect`, edges included. */
export const inside = (point: { x: number; y: number }, rect: Box): boolean =>
  point.x >= rect.left &&
  point.x <= rect.left + rect.width &&
  point.y >= rect.top &&
  point.y <= rect.top + rect.height;

/** Positions an overlay element over `rect`. */
export function place(node: HTMLElement, rect: Box): void {
  Object.assign(node.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

/** `node`'s size, gap and padding as the browser lays them out, inline values included. */
export function spacingOf(node: Element): Record<Spacing, number> {
  const s = style(node);
  return {
    width: size(s.width),
    height: size(s.height),
    gap: Math.max(size(s.rowGap), size(s.columnGap)),
    "padding-top": size(s.paddingTop),
    "padding-right": size(s.paddingRight),
    "padding-bottom": size(s.paddingBottom),
    "padding-left": size(s.paddingLeft),
  };
}

/** The computed two-dimensional pixel offset of an editable element. */
export function offsetOf(node: Element): Offset {
  const [x = "0", y = "0"] = style(node).translate.split(/\s+/);
  return { x: size(x), y: size(y) };
}

/** The parent's padding edge, inside its borders. */
export function paddingBox(node: Element): Box {
  const r = node.getBoundingClientRect();
  const s = style(node);
  return {
    left: r.left + size(s.borderLeftWidth),
    top: r.top + size(s.borderTopWidth),
    width: r.width - size(s.borderLeftWidth) - size(s.borderRightWidth),
    height: r.height - size(s.borderTopWidth) - size(s.borderBottomWidth),
  };
}

// The override file's links in `doc`, in document order: the one `design-workshop dev` injects
// (ADR-043), and its replacement while the page swaps it after a write.
function overrideSheets(doc: Document): CSSStyleSheet[] {
  const view = doc.defaultView;
  if (view === null) return [];
  return [...doc.styleSheets].filter(
    (s) =>
      s.ownerNode instanceof view.HTMLElement &&
      s.ownerNode.dataset.workbenchOverrides !== undefined,
  );
}

/** Whether the source, excluding the Workbench stylesheet, already transforms this element. */
export function hasNativeTransform(node: Styled): boolean {
  const sheets = overrideSheets(node.ownerDocument);
  const disabled = sheets.map((sheet) => sheet.disabled);
  for (const sheet of sheets) sheet.disabled = true;
  try {
    const s = style(node);
    return [s.transform, s.translate, s.rotate, s.scale].some((v) => v !== "none");
  } finally {
    for (const [i, sheet] of sheets.entries()) sheet.disabled = disabled[i] ?? false;
  }
}

/**
 * The override file's value for `name` in `selector`'s rule, as `doc`'s copy of the file has it
 * now, after any hot reload.
 */
export function applied(doc: Document, selector: string, name: string): string | null {
  const view = doc.defaultView;
  if (view === null) return null;
  const sheet = overrideSheets(doc).at(-1); // the copy that wins the cascade
  for (const rule of sheet?.cssRules ?? []) {
    if (rule instanceof view.CSSStyleRule && rule.selectorText === selector) {
      const value = rule.style.getPropertyValue(name).trim();
      return value === "" ? null : value;
    }
  }
  return null;
}

/**
 * The elements a click can select, from the top of the page down to `node`. Elements that fill
 * the frame, like the desk behind the window, and those with no box of their own are passed
 * over, so a click on the desk is a click on empty space.
 * @param includeNamed Keep viewport-filling component roots in an isolated story.
 */
export function chain(node: Element | null, includeNamed = false): Styled[] {
  const view = node?.ownerDocument.defaultView;
  const out: Styled[] = [];
  for (let e = node; e !== null && e.localName !== "body"; e = e.parentElement) {
    const r = e.getBoundingClientRect();
    const fills =
      r.left <= 0 &&
      r.top <= 0 &&
      r.right >= (view?.innerWidth ?? 0) &&
      r.bottom >= (view?.innerHeight ?? 0);
    if (
      styled(e) &&
      (!fills || (includeNamed && e.hasAttribute("data-wb"))) &&
      style(e).display !== "contents"
    )
      out.unshift(e);
  }
  return out;
}

// `node`'s `attr`, when no other element in its page has the same one.
function unique(node: Element, attr: string): string | null {
  const value = node.getAttribute(attr);
  const all = [...node.ownerDocument.querySelectorAll(`[${attr}]`)];
  return value !== null && all.filter((n) => n.getAttribute(attr) === value).length === 1
    ? value
    : null;
}

/** Instance path in Live mode; nearest named root and inner path in Component mode (ADR-023). */
export function selectorOf(node: Element, reach: "live" | "component" = "live"): string {
  const steps: Step[] = [];
  for (
    let e: Element | null = node;
    e !== null;
    e = e.localName === "body" ? null : e.parentElement
  ) {
    steps.push({
      tag: e.localName,
      index: [...(e.parentElement?.children ?? [])].indexOf(e) + 1,
      wb: reach === "component" ? e.getAttribute("data-wb") : null,
      id: reach === "component" ? null : unique(e, "id"),
    });
  }
  return selectorFor(steps);
}

/** Whether `selector` matches an element in `doc`; false for one the browser cannot parse. */
export function matches(doc: Document, selector: string): boolean {
  try {
    return doc.querySelector(selector) !== null;
  } catch {
    return false;
  }
}
