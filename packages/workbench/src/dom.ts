// What the Workbench page reads from the DOM, its own and the framed app's: computed values,
// boxes, the elements a click can select, and the override file as the frame has it.
import type { Box } from "./radius";
import { selectorFor, type Step } from "./selector";
import type { Offset, Spacing } from "./spacing";

const OVERRIDES = "/catalog/src/overrides.css";

/** The same-origin app URL requested by `path`, or `/` for an unsafe or recursive target. */
export function canvasPath(search: string): string {
  const path = new URLSearchParams(search).get("path") ?? "/";
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

/** `node`'s gap and padding as the browser lays them out, inline values included. */
export function spacingOf(node: Element): Record<Spacing, number> {
  const s = style(node);
  return {
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

function overrideSheet(doc: Document): CSSStyleSheet | undefined {
  const view = doc.defaultView;
  if (view === null) return undefined;
  return [...doc.styleSheets].find(
    (s) =>
      s.ownerNode instanceof view.HTMLElement &&
      s.ownerNode.dataset.viteDevId?.endsWith(OVERRIDES) === true,
  );
}

/** Whether the source, excluding the Workbench stylesheet, already transforms this element. */
export function hasNativeTransform(node: Styled): boolean {
  const sheet = overrideSheet(node.ownerDocument);
  const disabled = sheet?.disabled ?? false;
  if (sheet !== undefined) sheet.disabled = true;
  try {
    const s = style(node);
    return [s.transform, s.translate, s.rotate, s.scale].some((v) => v !== "none");
  } finally {
    if (sheet !== undefined) sheet.disabled = disabled;
  }
}

/**
 * The override file's value for `name` in `selector`'s rule, as `doc`'s copy of the file has it
 * now, after any hot reload.
 */
export function applied(doc: Document, selector: string, name: string): string | null {
  const view = doc.defaultView;
  if (view === null) return null;
  const sheet = overrideSheet(doc);
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
 */
export function chain(node: Element | null): Styled[] {
  const view = node?.ownerDocument.defaultView;
  const out: Styled[] = [];
  for (let e = node; e !== null && e.localName !== "body"; e = e.parentElement) {
    const r = e.getBoundingClientRect();
    const fills =
      r.left <= 0 &&
      r.top <= 0 &&
      r.right >= (view?.innerWidth ?? 0) &&
      r.bottom >= (view?.innerHeight ?? 0);
    if (styled(e) && !fills && style(e).display !== "contents") out.unshift(e);
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

/** `node`'s instance selector. Component names are reserved for shared edits (ADR-023). */
export function selectorOf(node: Element): string {
  const steps: Step[] = [];
  for (
    let e: Element | null = node;
    e !== null;
    e = e.localName === "body" ? null : e.parentElement
  ) {
    steps.push({
      tag: e.localName,
      index: [...(e.parentElement?.children ?? [])].indexOf(e) + 1,
      wb: null,
      id: unique(e, "id"),
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
