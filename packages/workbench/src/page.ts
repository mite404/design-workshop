// The Workbench page: the running app in a frame (the canvas), an overlay of handles over it, and
// the inspector. Clicking in the frame selects an element (ETH-102). Each value has up to three
// inputs (ADR-005): a field, a scrub or arrow keys, and handles on the canvas. A change lives
// inline on its element until the override file has it (ADR-004): the window's corner radius on
// the frame's root, the selection's gap and padding on the selection.
import "./page.css";
import {
  clampRadius,
  CORNERS,
  dragRadius,
  handleMoved,
  handlePoint,
  maxRadius,
  type Box,
  type Corner,
} from "./radius";
import {
  applied,
  canvasPath,
  chain,
  element,
  hasNativeTransform,
  inside,
  laysOut,
  matches,
  offsetOf,
  paddingBox,
  place,
  px,
  selectorOf,
  spacingOf,
  style,
  wholeNumber,
  type Styled,
} from "./dom";
import { pick } from "./selector";
import {
  boundedOffset,
  dragSpace,
  gapSpaces,
  paddingMoved,
  paddingSides,
  paddingSpace,
  SIDES,
  SPACING,
  type Offset,
  type Side,
  type Spacing,
} from "./spacing";

const NAME = "--window-radius";
const ROOT = ":root";
const ENDPOINT = "/__workbench/values";
const LEAST_INSET = 8;
const PADDING_INSET = 5; // a padding handle's least distance inside its edge
const DRAG_START = 3; // px a press moves before it is a drag rather than a click
const CURSOR: Record<Corner, string> = {
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};
const LABEL: Record<Spacing, string> = {
  gap: "Gap",
  "padding-top": "Top",
  "padding-right": "Right",
  "padding-bottom": "Bottom",
  "padding-left": "Left",
};
const ARROWS: Record<string, 1 | -1> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
const UP_DOWN: Record<string, 1 | -1> = { ArrowUp: 1, ArrowDown: -1 };
// What the app must not see while the select tool is on.
const BLOCKED = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "auxclick",
  "contextmenu",
];

// A radius drag in progress: the control dragged, the value before it, and where it started.
type Drag = { control: HTMLElement; from: number; x: number; y: number };
// The selection: the element, its selector, and the values its own `style` attribute sets,
// which no stylesheet can override.
type Selection = { node: Styled; selector: string; locked: Set<Spacing>; nudgeLocked: boolean };
// A change to the selection's spacing: the values before it, and the names it set inline.
type Edit = { selection: Selection; before: Record<Spacing, number>; touched: Set<Spacing> };
// A spacing handle: its element, the highlight of the space it controls, and its drag axis.
type Bar = {
  el: HTMLElement;
  space: HTMLElement;
  name: Spacing;
  side: Side | null;
  axis: "x" | "y";
};
// A press on a spacing handle: where it started, and whether it has moved enough to be a drag.
type Press = { bar: Bar; x: number; y: number; moved: boolean };

// One offset edit retains its geometry and inline value until commit or cancellation.
type OffsetEdit = {
  target: Selection;
  from: Offset;
  box: Box;
  parent: Box;
  inline: string;
};
type BodyPress = { x: number; y: number; id: number; under: Element | null; moved: boolean };

const frame = element("iframe", {
  src: canvasPath(location.search),
  title: "Canvas",
  className: "frame",
});
const outline = element("div", { className: "outline" });
const handles = CORNERS.map(() =>
  element("div", { className: "handle", tabIndex: 0, ariaLabel: "Corner radius" }),
);
const pill = element("div", { className: "pill", ariaHidden: "true" });
const paddingLayer = element("div");
const gapLayer = element("div");
const inplace = element("input", { className: "inplace", inputMode: "numeric", hidden: true });
const overlay = element(
  "div",
  { className: "overlay" },
  outline,
  paddingLayer,
  gapLayer,
  ...handles,
  pill,
  inplace,
);
const tool = element(
  "button",
  { type: "button", className: "tool", ariaPressed: "true" },
  "Select",
);
const field = element("input", { id: "radius", inputMode: "numeric", autocomplete: "off" });
const label = element("label", { htmlFor: "radius", className: "scrub" }, "Corner radius");
const reset = element("button", { type: "button", className: "reset" }, "Reset");
const selectorText = element("code", { className: "selector" });
const note = element(
  "p",
  { className: "note" },
  "Read-only fields are set in the element's own style attribute, which no stylesheet overrides.",
);
const unmatchedList = element("ul", { className: "unmatched" });
const message = element("p", { className: "message", role: "status" });
const offsetNote = element(
  "p",
  { className: "offset-note" },
  "Offset is read-only because the element already has a native transform or translate.",
);

let baseline = 0; // tokens.css's radius, in px
let files = new Map<string, Map<string, string>>(); // the override file as last read: each `was`
let shown = 0; // the radius in hand, in px
let drag: Drag | null = null;
let selecting = true;
let selection: Selection | null = null;
let edit: Edit | null = null;
let press: Press | null = null;
let inplaceBar: Bar | null = null;
let offsetEdit: OffsetEdit | null = null;
let bodyPress: BodyPress | null = null;
let pointer = { x: -1, y: -1 }; // in the canvas's coordinates
let unmatchedKey = "";
let queue = Promise.resolve();

const prop = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const entries = (value: unknown): [string, unknown][] =>
  typeof value === "object" && value !== null ? Object.entries(value) : [];
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const doc = (): Document | null => frame.contentDocument;
const windowElement = (): Element | null => doc()?.querySelector("[data-slot=window]") ?? null;
const box = (): Box => windowElement()?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
const was = (selector: string, name: string): string | null =>
  files.get(selector)?.get(name) ?? null;
const savedRadius = (): string | null => was(ROOT, NAME);
const onDisk = (): number => px(savedRadius() ?? `${baseline}px`);
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
// Drops `node`'s inline `name` once the frame's copy of the override file gives `expected`.
// Stops early when something newer has changed the inline value.
async function settle(
  node: Styled,
  selector: string,
  name: string,
  expected: string | null,
  inline = node.style.getPropertyValue(name),
): Promise<void> {
  const parsed = element("div").style;
  parsed.setProperty(name, expected ?? "");
  const canonical = expected === null ? null : parsed.getPropertyValue(name);
  for (let i = 0; i < 300; i++) {
    if (node.style.getPropertyValue(name) !== inline) return;
    const d = doc();
    if (d !== null && applied(d, selector, name) === canonical) {
      node.style.removeProperty(name);
      return;
    }
    // oxlint-disable-next-line no-await-in-loop -- one look per painted frame
    await nextFrame();
  }
}

const settleRadius = async (): Promise<void> => {
  const root = doc()?.documentElement;
  if (root !== undefined) await settle(root, ROOT, NAME, savedRadius());
};

function show(radius: number): void {
  shown = radius;
  field.value = String(radius);
  pill.textContent = `Radius ${radius}`;
  for (const handle of handles) handle.ariaValueNow = String(radius);
  doc()?.documentElement.style.setProperty(NAME, `${radius}px`);
}

async function load(): Promise<void> {
  const values: unknown = await (await fetch(ENDPOINT)).json();
  const token = prop(prop(values, "tokens"), NAME);
  baseline = px(text(prop(token, "baseline")) ?? "0");
  files = new Map(
    entries(prop(values, "saved")).map(([selector, rule]) => [
      selector,
      new Map(entries(rule).flatMap(([n, v]) => (typeof v === "string" ? [[n, v]] : []))),
    ]),
  );
  const radius = text(prop(token, "override"));
  if (radius !== null) files.set(ROOT, new Map([[NAME, radius]]));
  reset.disabled = savedRadius() === null;
  show(onDisk());
  await settleRadius();
}

function record(selector: string, name: string, value: string | null): void {
  const block = files.get(selector) ?? new Map<string, string>();
  if (value === null) block.delete(name);
  else block.set(name, value);
  files.set(selector, block);
}

// Writes one value, or removes it when `value` is null. True when the file now has it.
async function write(selector: string, name: string, value: string | null): Promise<boolean> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selector, name, value, was: was(selector, name) }),
  });
  if (response.status === 409) {
    message.textContent = "The override file changed on disk, so this was not saved. Showing it.";
    await load();
    return false;
  }
  if (!response.ok) {
    const body: unknown = await response.json();
    message.textContent = `Not saved: ${text(prop(body, "error")) ?? response.statusText}`;
    return false;
  }
  record(selector, name, value);
  message.textContent = "";
  return true;
}

// Runs `task` after every earlier write: one write at a time (ADR-004).
function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch((error: unknown) => {
    message.textContent = `Not saved: ${String(error)}`;
  });
}

// Saves `selector`'s `name` from `node`'s inline value, or removes it when `value` is null, then
// drops the inline value once the file applies.
function saveValue(node: Styled, selector: string, name: string, value: string | null): void {
  const inline = node.style.getPropertyValue(name);
  enqueue(async () => {
    if (await write(selector, name, value)) void settle(node, selector, name, value, inline);
  });
}

function beginOffset(): OffsetEdit | null {
  if (selection === null || selection.nudgeLocked || selection.node.parentElement === null)
    return null;
  if (offsetEdit === null) {
    offsetEdit = {
      target: selection,
      from: offsetOf(selection.node),
      box: selection.node.getBoundingClientRect(),
      parent: paddingBox(selection.node.parentElement),
      inline: selection.node.style.translate,
    };
  }
  return offsetEdit;
}

function setOffset(value: Offset, step = 1): void {
  const current = beginOffset();
  if (current === null) return;
  const next =
    value.x === 0 && value.y === 0
      ? value
      : boundedOffset(value, current.from, current.box, current.parent, step);
  current.target.node.style.translate = `${next.x}px ${next.y}px`;
  pill.textContent = `X ${next.x}  Y ${next.y}`;
}

function endOffset(restore = false): void {
  const current = offsetEdit;
  offsetEdit = null;
  bodyPress = null;
  delete overlay.dataset.nudging;
  if (current === null) return;
  const { node, selector } = current.target;
  const value = offsetOf(node);
  if (restore || (value.x === current.from.x && value.y === current.from.y)) {
    node.style.translate = current.inline;
    return;
  }
  saveValue(
    node,
    selector,
    "translate",
    value.x === 0 && value.y === 0 ? null : `${value.x}px ${value.y}px`,
  );
}

function editingTarget(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest("input, button, .bar, .handle, .scrub"))
    return true;
  // Frame elements belong to a different realm. Their editing controls must not nudge either.
  return (
    target !== null &&
    "nodeName" in target &&
    /^(INPUT|TEXTAREA|SELECT)$/.test(String(target.nodeName))
  );
}

function stepOffset(event: KeyboardEvent): void {
  if (bodyPress !== null || selection === null || editingTarget(event.target)) return;
  const direction: Record<string, Offset> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  };
  const by = direction[event.key];
  if (by === undefined || beginOffset() === null) return;
  event.preventDefault();
  const from = offsetOf(selection.node);
  const step = event.shiftKey ? 10 : 2;
  setOffset({ x: from.x + by.x * step, y: from.y + by.y * step });
  endOffset();
}

// Writes the radius in hand, or null to reset. A value the file already gives, saved or
// baseline, writes nothing.
function save(value: string | null = `${shown}px`): void {
  const same = value === savedRadius() || (savedRadius() === null && value === `${baseline}px`);
  enqueue(async () => {
    if (!same && !(await write(ROOT, NAME, value))) return;
    reset.disabled = savedRadius() === null;
    void settleRadius();
  });
}

function commitField(): void {
  const radius = wholeNumber(field.value) ?? Number.NaN;
  if (radius <= maxRadius(box())) show(radius);
  else field.value = String(shown);
  save();
}

function nudge(event: KeyboardEvent, keys: Record<string, 1 | -1>): void {
  const sign = keys[event.key];
  if (sign === undefined) return;
  event.preventDefault();
  show(clampRadius(shown + sign * (event.shiftKey ? 10 : 1), box()));
}

function endDrag(restore: boolean): void {
  if (drag === null) return;
  const { control, from } = drag;
  drag = null;
  delete control.dataset.dragging;
  if (restore) show(from);
  save();
}

function draggable(control: HTMLElement, moved: (dx: number, dy: number) => number): void {
  control.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    control.setPointerCapture(event.pointerId);
    drag = { control, from: shown, x: event.clientX, y: event.clientY };
    control.dataset.dragging = "";
  });
  control.addEventListener("pointermove", (event) => {
    if (drag?.control !== control) return;
    const step = event.shiftKey ? 10 : 2;
    const radius = moved(event.clientX - drag.x, event.clientY - drag.y);
    show(dragRadius(drag.from, radius, step, box()));
  });
  control.addEventListener("pointerup", () => {
    endDrag(false);
  });
  control.addEventListener("pointercancel", () => {
    endDrag(true);
  });
}

// Saves each value the edit changed, and drops the inline values it put back.
function commit(): void {
  if (edit === null) return;
  const { selection: target, before, touched } = edit;
  edit = null;
  for (const name of touched) {
    const value = target.node.style.getPropertyValue(name);
    if (px(value) === before[name]) target.node.style.removeProperty(name);
    else saveValue(target.node, target.selector, name, value);
  }
}

// Puts back every value the edit changed, unsaved.
function revert(): void {
  if (edit === null) return;
  for (const name of edit.touched) edit.selection.node.style.removeProperty(name);
  edit = null;
}

function begin(): Edit | null {
  if (selection === null) return null;
  if (edit?.selection !== selection) {
    commit();
    edit = { selection, before: spacingOf(selection.node), touched: new Set() };
  }
  return edit;
}

function setSpacing(name: Spacing, value: number): void {
  const current = begin();
  if (current === null || current.selection.locked.has(name)) return;
  current.selection.node.style.setProperty(name, `${value}px`);
  current.touched.add(name);
}

const readout = (bar: Bar): string => {
  const value = selection === null ? 0 : spacingOf(selection.node)[bar.name];
  return `${bar.side === null ? "Gap" : "Padding"} ${value}`;
};

function highlightOpposite(bar: Bar, sides: Side[]): void {
  for (const other of paddingBars) {
    other.space.dataset.active = String(
      other.side !== bar.side && sides.includes(other.side ?? "top"),
    );
  }
}

function dragBar(bar: Bar, dx: number, dy: number, event: PointerEvent): void {
  const before = edit?.before;
  if (before === undefined) return;
  const step = event.shiftKey ? 10 : 2;
  if (bar.side === null) {
    setSpacing("gap", dragSpace(before.gap, bar.axis === "x" ? dx : dy, step));
  } else {
    const value = dragSpace(before[bar.name], paddingMoved(bar.side, dx, dy), step);
    const sides = paddingSides(bar.side, event.altKey, event.shiftKey);
    for (const side of SIDES) {
      const name: Spacing = `padding-${side}`;
      setSpacing(name, sides.includes(side) ? value : before[name]);
    }
    highlightOpposite(bar, sides);
  }
  pill.textContent = readout(bar);
}

function endPress(): void {
  if (press !== null) delete press.bar.el.dataset.dragging;
  for (const bar of paddingBars) delete bar.space.dataset.active;
  press = null;
}

function openInplace(bar: Bar): void {
  if (selection === null) return;
  inplaceBar = bar;
  inplace.value = String(spacingOf(selection.node)[bar.name]);
  inplace.style.translate = bar.el.style.translate;
  inplace.ariaLabel = bar.el.ariaLabel;
  inplace.hidden = false;
  inplace.focus();
  inplace.select();
}

function closeInplace(keep: boolean): void {
  const bar = inplaceBar;
  if (bar === null) return;
  inplaceBar = null;
  inplace.hidden = true;
  const typed = wholeNumber(inplace.value);
  if (keep && typed !== null) {
    setSpacing(bar.name, typed);
    commit();
  } else {
    revert();
  }
}

function stepBar(bar: Bar, event: KeyboardEvent): void {
  const sign = ARROWS[event.key];
  if (sign === undefined || selection === null) return;
  event.preventDefault();
  const from = spacingOf(selection.node)[bar.name];
  setSpacing(bar.name, Math.max(from + sign * (event.shiftKey ? 10 : 2), 0));
  pill.textContent = readout(bar);
}

function wireBar(bar: Bar): void {
  const { el } = bar;
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    commit();
    begin();
    press = { bar, x: event.clientX, y: event.clientY, moved: false };
  });
  el.addEventListener("pointermove", (event) => {
    if (press?.bar !== bar) return;
    const [dx, dy] = [event.clientX - press.x, event.clientY - press.y];
    if (!press.moved && Math.abs(dx) + Math.abs(dy) < DRAG_START) return;
    press.moved = true;
    el.dataset.dragging = "";
    dragBar(bar, dx, dy, event);
  });
  el.addEventListener("pointerup", () => {
    if (press?.bar !== bar) return;
    const { moved } = press;
    endPress();
    if (moved) commit();
    else openInplace(bar);
  });
  el.addEventListener("pointercancel", () => {
    if (press?.bar !== bar) return;
    endPress();
    revert();
  });
  el.addEventListener("pointerenter", () => {
    pill.textContent = readout(bar);
  });
  el.addEventListener("focus", () => {
    begin();
  });
  el.addEventListener("keydown", (event) => {
    stepBar(bar, event);
    if (event.key === "Enter") commit();
  });
  el.addEventListener("blur", commit);
}

function makeBar(name: Spacing, side: Side | null, axis: "x" | "y"): Bar {
  const aria = side === null ? "Gap" : `Padding ${side}`;
  const el = element("div", { className: "bar", tabIndex: 0, role: "slider", ariaLabel: aria });
  const space = element("div", { className: "space" });
  el.dataset.name = name;
  space.dataset.name = name;
  const bar = { el, space, name, side, axis };
  wireBar(bar);
  return bar;
}

const paddingBars = SIDES.map((side) =>
  makeBar(`padding-${side}`, side, side === "top" || side === "bottom" ? "y" : "x"),
);
const gapBars: Bar[] = [];

function select(node: Styled | null): void {
  endOffset();
  commit();
  closeInplace(false);
  selection =
    node === null
      ? null
      : {
          node,
          selector: selectorOf(node),
          locked: new Set(SPACING.filter((n) => node.style.getPropertyValue(n) !== "")),
          nudgeLocked: hasNativeTransform(node),
        };
  selectorText.textContent = selection?.selector ?? "";
}

function onKey(event: KeyboardEvent): void {
  stepOffset(event);
  if (event.key !== "Escape") return;
  if (offsetEdit !== null) {
    event.preventDefault();
    endOffset(true);
  } else if (drag !== null) {
    event.preventDefault();
    endDrag(true);
  } else if (press !== null) {
    event.preventDefault();
    endPress();
    revert();
  } else if (selecting && selection !== null && !(event.target instanceof HTMLInputElement)) {
    event.preventDefault();
    select(chain(selection.node).at(-2) ?? null);
  }
}

const block = (event: Event): void => {
  if (!selecting) return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

function cancelBody(): void {
  if (bodyPress !== null) endOffset(true);
}

// Follows the frame's document across reloads: selection by click, and keys while it has focus.
function watchFrame(): void {
  const view = frame.contentWindow;
  if (view === null) return;
  select(null);
  view.addEventListener(
    "pointerdown",
    (event) => {
      if (!selecting || event.button !== 0 || bodyPress !== null) return;
      view.focus();
      const under = view.document.elementFromPoint(event.clientX, event.clientY);
      if (
        selection !== null &&
        inside({ x: event.clientX, y: event.clientY }, selection.node.getBoundingClientRect()) &&
        beginOffset() !== null
      ) {
        selection.node.setPointerCapture(event.pointerId);
        bodyPress = {
          x: event.clientX,
          y: event.clientY,
          id: event.pointerId,
          under,
          moved: false,
        };
        return;
      }
      select(pick(chain(under), chain(selection?.node ?? null)));
    },
    true,
  );
  view.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (bodyPress === null || event.pointerId !== bodyPress.id || offsetEdit === null) return;
    const dx = event.clientX - bodyPress.x;
    const dy = event.clientY - bodyPress.y;
    if (!bodyPress.moved && Math.abs(dx) + Math.abs(dy) < DRAG_START) return;
    bodyPress.moved = true;
    overlay.dataset.nudging = "true";
    setOffset({ x: offsetEdit.from.x + dx, y: offsetEdit.from.y + dy }, event.shiftKey ? 10 : 2);
    const parent = offsetEdit.parent;
    const right = parent.left + parent.width + 14;
    const x =
      right + pill.offsetWidth <= overlay.clientWidth
        ? right
        : Math.max(0, parent.left - pill.offsetWidth - 14);
    pill.style.translate = `${x}px ${event.clientY - pill.offsetHeight / 2}px`;
  });
  view.addEventListener(
    "pointerup",
    (event) => {
      if (bodyPress === null || event.pointerId !== bodyPress.id) return;
      const { moved, under } = bodyPress;
      endOffset();
      if (!moved) select(pick(chain(under), chain(selection?.node ?? null)));
    },
    true,
  );
  view.addEventListener("pointercancel", cancelBody, true);
  view.addEventListener("lostpointercapture", cancelBody, true);
  for (const type of BLOCKED) view.addEventListener(type, block, true);
  view.addEventListener("keydown", onKey);
}

function trackRadius(): void {
  const rect = box();
  const target = windowElement();
  const radius = target === null ? 0 : px(style(target).borderTopLeftRadius);
  for (const [i, handle] of handles.entries()) {
    const { x, y } = handlePoint(CORNERS[i] ?? "nw", rect, radius, LEAST_INSET);
    handle.style.translate = `${x}px ${y}px`;
    handle.ariaValueMax = String(maxRadius(rect));
  }
}

function placeBar(bar: Bar, x: number, y: number, space: Box, value: number): void {
  bar.el.style.translate = `${x}px ${y}px`;
  bar.el.dataset.axis = bar.axis;
  bar.el.ariaValueNow = String(value);
  place(bar.space, space);
}

function trackPadding(node: Styled, border: Box, s: CSSStyleDeclaration): Box {
  const inner = {
    left: border.left + px(s.borderLeftWidth),
    top: border.top + px(s.borderTopWidth),
    width: border.width - px(s.borderLeftWidth) - px(s.borderRightWidth),
    height: border.height - px(s.borderTopWidth) - px(s.borderBottomWidth),
  };
  const v = spacingOf(node);
  const padding = {
    top: v["padding-top"],
    right: v["padding-right"],
    bottom: v["padding-bottom"],
    left: v["padding-left"],
  };
  for (const bar of paddingBars) {
    const side = bar.side ?? "top";
    const band = paddingSpace(side, inner, padding);
    const inset = Math.max(padding[side] / 2, PADDING_INSET);
    const mid = { x: band.left + band.width / 2, y: band.top + band.height / 2 };
    const at: Record<Side, [number, number]> = {
      top: [mid.x, inner.top + inset],
      right: [inner.left + inner.width - inset, mid.y],
      bottom: [mid.x, inner.top + inner.height - inset],
      left: [inner.left + inset, mid.y],
    };
    placeBar(bar, ...at[side], band, padding[side]);
    bar.el.hidden = selection?.locked.has(bar.name) === true;
  }
  return {
    left: inner.left + padding.left,
    top: inner.top + padding.top,
    width: inner.width - padding.left - padding.right,
    height: inner.height - padding.top - padding.bottom,
  };
}

function trackGaps(node: Styled, content: Box): void {
  const laidOut = laysOut(node) && selection?.locked.has("gap") !== true;
  const children = [...node.children].filter((c) => {
    const cs = style(c);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
  });
  const spaces = laidOut
    ? gapSpaces(
        content,
        children.map((c) => c.getBoundingClientRect()),
      )
    : [];
  while (gapBars.length < spaces.length) {
    const bar = makeBar("gap", null, "x");
    gapBars.push(bar);
    gapLayer.append(bar.el, bar.space);
  }
  const gap = spacingOf(node).gap;
  for (const [i, bar] of gapBars.entries()) {
    const space = spaces[i];
    bar.el.hidden = space === undefined;
    bar.space.hidden = space === undefined;
    if (space === undefined) continue;
    bar.axis = space.axis;
    const { left, top, width, height } = space.box;
    placeBar(bar, left + width / 2, top + height / 2, space.box, gap);
  }
}

// ponytail: reads the selection's box every frame, so the overlay follows resize, scroll, layout
// and hot reloads alike; switch to observers if it ever shows in a profile.
function trackSelection(): void {
  if (selection !== null && !selection.node.isConnected) select(null);
  const node = selection?.node;
  overlay.dataset.selected = String(node !== undefined);
  overlay.dataset.window = String(node !== undefined && node === windowElement());
  if (node === undefined) return;
  const rect = node.getBoundingClientRect();
  const s = style(node);
  place(outline, rect);
  outline.style.borderRadius = s.borderTopLeftRadius;
  overlay.dataset.hover = String(inside(pointer, rect));
  trackGaps(node, trackPadding(node, rect, s));
}

const rows = SPACING.map((name) => {
  const input = element("input", { id: `wb-${name}`, inputMode: "numeric", autocomplete: "off" });
  const clear = element("button", { type: "button", className: "reset" }, "Reset");
  clear.ariaLabel = `Reset ${LABEL[name].toLowerCase()}`;
  const row = element(
    "div",
    { className: "row" },
    element("label", { htmlFor: input.id }, LABEL[name]),
    input,
    clear,
  );
  const commitInput = () => {
    const typed = wholeNumber(input.value);
    if (typed !== null) setSpacing(name, typed);
    commit();
    if (selection !== null) input.value = String(spacingOf(selection.node)[name]);
  };
  input.addEventListener("focus", () => {
    begin();
  });
  input.addEventListener("keydown", (event) => {
    const sign = UP_DOWN[event.key];
    if (sign !== undefined && selection !== null && !input.readOnly) {
      event.preventDefault();
      const value = Math.max(spacingOf(selection.node)[name] + sign * (event.shiftKey ? 10 : 1), 0);
      setSpacing(name, value);
      input.value = String(value);
    }
    if (event.key === "Enter") commitInput();
  });
  input.addEventListener("blur", commitInput);
  clear.addEventListener("click", () => {
    if (selection !== null) saveValue(selection.node, selection.selector, name, null);
  });
  return { name, input, clear, row };
});
const offsetRows = (["x", "y"] as const).map((axis) => {
  const input = element("input", { id: `wb-${axis}`, inputMode: "numeric", autocomplete: "off" });
  const clear = element(
    "button",
    { type: "button", className: "reset", ariaLabel: `Reset ${axis}` },
    "Reset",
  );
  const row = element(
    "div",
    { className: "row" },
    element("label", { htmlFor: input.id }, axis.toUpperCase()),
    input,
    clear,
  );
  const commitInput = () => {
    const typed = /^\s*-?\d{1,4}\s*(?:px)?\s*$/.test(input.value)
      ? Number.parseInt(input.value, 10)
      : Number.NaN;
    const current = beginOffset();
    if (Number.isFinite(typed) && current !== null) {
      const value = { ...offsetOf(current.target.node), [axis]: typed };
      const bounded = boundedOffset(value, current.from, current.box, current.parent);
      if ((value.x === 0 && value.y === 0) || (value.x === bounded.x && value.y === bounded.y))
        setOffset(value);
    }
    endOffset();
    if (selection !== null) input.value = String(offsetOf(selection.node)[axis]);
  };
  input.addEventListener("focus", beginOffset);
  input.addEventListener("keydown", (event) => {
    const sign = UP_DOWN[event.key];
    if (sign !== undefined && selection !== null && !input.readOnly) {
      event.preventDefault();
      const from = offsetOf(selection.node);
      setOffset({ ...from, [axis]: from[axis] + sign * (event.shiftKey ? 10 : 1) });
      input.value = String(offsetOf(selection.node)[axis]);
    }
    if (event.key === "Enter") commitInput();
    if (event.key === "Escape") {
      event.stopPropagation();
      endOffset(true);
      if (selection !== null) input.value = String(offsetOf(selection.node)[axis]);
    }
  });
  input.addEventListener("blur", commitInput);
  clear.addEventListener("click", () => {
    if (selection === null) return;
    setOffset({ ...offsetOf(selection.node), [axis]: 0 });
    endOffset();
  });
  return { axis, input, clear, row };
});
const selectionPanel = element(
  "section",
  { ariaLabel: "Selection" },
  element("h2", {}, "Selection"),
  selectorText,
  ...rows.map((r) => r.row),
  note,
  ...offsetRows.map((r) => r.row),
  offsetNote,
);
const unmatchedPanel = element(
  "section",
  { ariaLabel: "Saved values that match nothing" },
  element("h2", {}, "Saved, matching nothing"),
  unmatchedList,
);

function trackFields(): void {
  selectionPanel.hidden = selection === null;
  if (selection === null) return;
  const { node, selector, locked } = selection;
  const v = spacingOf(node);
  const laidOut = laysOut(node);
  for (const { name, input, clear } of rows) {
    if (document.activeElement !== input) input.value = String(v[name]);
    input.readOnly = locked.has(name);
    input.disabled = name === "gap" && !laidOut;
    clear.disabled = was(selector, name) === null;
  }
  note.hidden = locked.size === 0;
  const offset = offsetOf(node);
  for (const { axis, input, clear } of offsetRows) {
    if (document.activeElement !== input) input.value = String(offset[axis]);
    input.readOnly = selection.nudgeLocked;
    clear.disabled = selection.nudgeLocked || offset[axis] === 0;
  }
  offsetNote.hidden = !selection.nudgeLocked;
}

// Lists saved values whose selector matches nothing in the frame's page, each with a delete.
function trackUnmatched(): void {
  const d = doc();
  if (d === null || windowElement() === null) return;
  const lost = [...files]
    .filter(([selector]) => selector !== ROOT && !matches(d, selector))
    .flatMap(([selector, rule]) => [...rule].map(([name, value]) => ({ selector, name, value })));
  const key = JSON.stringify(lost);
  if (key === unmatchedKey) return;
  unmatchedKey = key;
  unmatchedPanel.hidden = lost.length === 0;
  unmatchedList.replaceChildren(
    ...lost.map(({ selector, name, value }) => {
      const remove = element("button", { type: "button", className: "reset" }, "Delete");
      remove.ariaLabel = `Delete ${name} of ${selector}`;
      remove.addEventListener("click", () => {
        enqueue(async () => {
          await write(selector, name, null);
        });
      });
      return element(
        "li",
        {},
        element("code", {}, selector),
        element("span", {}, `${name}: ${value}`),
        remove,
      );
    }),
  );
}

function track(): void {
  trackRadius();
  trackSelection();
  trackFields();
  trackUnmatched();
  requestAnimationFrame(track);
}

document.body.append(
  element(
    "main",
    { className: "workbench" },
    element("div", { className: "canvas" }, frame, overlay),
    element(
      "aside",
      { className: "inspector", ariaLabel: "Inspector" },
      element("div", { className: "tools" }, tool),
      element("h2", {}, "Window"),
      element("div", { className: "row" }, label, field, reset),
      selectionPanel,
      unmatchedPanel,
      message,
    ),
  ),
);
paddingLayer.append(...paddingBars.flatMap((b) => [b.el, b.space]));
unmatchedPanel.hidden = true;

for (const [i, handle] of handles.entries()) {
  const corner = CORNERS[i] ?? "nw";
  handle.dataset.corner = corner;
  handle.role = "slider";
  handle.ariaValueMin = "0";
  handle.style.cursor = CURSOR[corner];
  draggable(handle, (dx, dy) => handleMoved(corner, dx, dy));
  handle.addEventListener("keydown", (event) => {
    nudge(event, ARROWS);
    if (event.key === "Enter") save();
  });
  handle.addEventListener("blur", () => {
    save();
  });
}
draggable(label, (dx) => dx);
overlay.addEventListener("pointermove", (event) => {
  const spacingBar = event.target instanceof HTMLElement ? event.target.closest(".bar") : null;
  const bounds = selection?.node.getBoundingClientRect();
  // Keep spacing readouts beside the selected box, rather than on top of its content.
  const left = spacingBar?.getAttribute("data-name") === "padding-left";
  const edge = spacingBar === null ? event.clientX : (bounds?.right ?? event.clientX);
  const x = left
    ? Math.max(0, (bounds?.left ?? event.clientX) - 14 - pill.offsetWidth)
    : Math.min(edge + 14, overlay.clientWidth - pill.offsetWidth);
  const y = spacingBar === null ? event.clientY + 14 : event.clientY - pill.offsetHeight / 2;
  pill.style.translate = `${x}px ${y}px`;
});
document.addEventListener("pointermove", (event) => {
  const origin = overlay.getBoundingClientRect();
  pointer = { x: event.clientX - origin.left, y: event.clientY - origin.top };
});
inplace.addEventListener("keydown", (event) => {
  if (event.key === "Enter") closeInplace(true);
  if (event.key !== "Escape") return;
  event.stopPropagation();
  closeInplace(false);
});
inplace.addEventListener("blur", () => {
  closeInplace(true);
});
tool.addEventListener("click", () => {
  selecting = !selecting;
  tool.ariaPressed = String(selecting);
  if (!selecting) select(null);
});
field.addEventListener("keydown", (event) => {
  nudge(event, UP_DOWN);
  if (event.key === "Enter") commitField();
});
field.addEventListener("blur", commitField);
reset.addEventListener("click", () => {
  show(baseline);
  save(null);
});
document.addEventListener("keydown", onKey);
frame.addEventListener("load", () => {
  watchFrame();
  void load();
});
requestAnimationFrame(track);
