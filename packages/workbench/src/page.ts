// The Workbench page: the running app in a frame (the canvas), an overlay of handles over it, and
// the inspector. Clicking in the frame selects an element (ETH-102). Each value has up to three
// inputs (ADR-005): a field, a scrub or arrow keys, and handles on the canvas. A change lives
// inline on its element until the override file has it (ADR-004): the window's corner radius on
// the frame's root, the selection's gap and padding on the selection.
import "./page.css";
import { chatKey, chatLayer, referencing, trackChat, watchReference } from "./chat";
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
import {
  fallbackOf,
  familyValue,
  googleName,
  installedFaces,
  isFamilyName,
  matchesFamily,
  mergeFamilies,
  parseGoogleFont,
  previewFiles,
  type GoogleFont,
} from "./fonts";
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
import {
  emOf,
  percentOf,
  SCALE,
  scaleValue,
  STEPS,
  stepOf,
  styleList,
  TYPE,
  type ScaleName,
  type TextStep,
  type TypeName,
} from "./type";

const NAME = "--window-radius";
const ROOT = ":root";
const ENDPOINT = "/__workbench/values";
const FONTS_ENDPOINT = "/__workbench/fonts";
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
type Selection = {
  node: Styled;
  selector: string;
  locked: Set<Spacing | TypeName>;
  nudgeLocked: boolean;
};
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
  const root = new Map(
    entries(prop(values, "tokens")).flatMap(([n, t]): [string, string][] => {
      const saved = text(prop(t, "override"));
      return saved === null ? [] : [[n, saved]];
    }),
  );
  files = new Map([
    ...entries(prop(values, "saved")).map(([selector, rule]): [string, Map<string, string>] => [
      selector,
      new Map(entries(rule).flatMap(([n, v]) => (typeof v === "string" ? [[n, v]] : []))),
    ]),
    [ROOT, root],
  ]);
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
  for (const name of TYPE) commitType(name);
  if (stepList.matches(":popover-open")) stepList.hidePopover();
  endFonts();
  if (fontPicker.matches(":popover-open")) fontPicker.hidePopover();
  if (basics.matches(":popover-open")) basics.hidePopover();
  closeInplace(false);
  selection =
    node === null
      ? null
      : {
          node,
          selector: selectorOf(node),
          locked: new Set(
            [...SPACING, ...TYPE].filter((n) => node.style.getPropertyValue(n) !== ""),
          ),
          nudgeLocked: hasNativeTransform(node),
        };
  selectorText.textContent = selection?.selector ?? "";
}

// Whether Escape selects the parent: the select tool is on, focus is not in a field, and no
// popover is open, whose own Escape closes it.
const climbs = (event: KeyboardEvent): boolean =>
  selecting &&
  !(event.target instanceof HTMLInputElement) &&
  document.querySelector(":popover-open") === null;

function onKey(event: KeyboardEvent): void {
  stepOffset(event);
  if (event.key !== "Escape") return;
  if (offsetEdit !== null) {
    event.preventDefault();
    endOffset(true);
  } else if (drag !== null) {
    event.preventDefault();
    endDrag(true);
  } else if (scaleDrag !== null) {
    event.preventDefault();
    revertScale(scaleDrag.name);
  } else if (press !== null) {
    event.preventDefault();
    endPress();
    revert();
  } else if (selection !== null && climbs(event)) {
    event.preventDefault();
    select(chain(selection.node).at(-2) ?? null);
  }
}

// A key goes to the chat first, then to the page's own handling.
const keyDown = (event: KeyboardEvent): void => {
  if (!chatKey(event)) onKey(event);
};

const block = (event: Event): void => {
  if (!selecting && !referencing()) return;
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
  watchReference(view, frame);
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
  view.addEventListener("keydown", keyDown);
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

// The Typography section (ETH-105). Each control sets one type property inline during a change
// and saves it on release, Enter or blur; its reset removes the saved value.

// A type value set inline during a change: the selection it is on, and its computed value before.
const typeEdits = new Map<TypeName, { target: Selection; before: string }>();
const BLOCKS = new Set(["block", "inline-block", "flow-root", "list-item"]);
// 12px icons, stroked in the text colour.
const ICONS = {
  lineHeight: "M1 1.5h10M1 10.5h10M3.6 8.3 6 3.7l2.4 4.6M4.3 7h3.4",
  letterSpacing: "M1.5 1.5v9M10.5 1.5v9M3.6 8.3 6 3.7l2.4 4.6M4.3 7h3.4",
  left: "M1.5 2.5h9M1.5 6h5M1.5 9.5h7",
  center: "M1.5 2.5h9M3.5 6h5M2.5 9.5h7",
  right: "M1.5 2.5h9M5.5 6h5M3.5 9.5h7",
  start: "M1.5 1.5h9M4 4v6M8 4v3.5",
  middle: "M1.5 6h9M4 2.5v7M8 3.75v4.5",
  end: "M1.5 10.5h9M4 2v6M8 4.5v3.5",
  reset: "M3 3.6A4 4 0 1 1 2 6M3 1.2v2.6h2.6",
  chevron: "M3.5 4.75 6 7.25l2.5-2.5",
  warning: "M6 1.5 11 10.5H1L6 1.5ZM6 5v2.4M6 8.9v.1",
  justify: "M1.5 2.5h9M1.5 6h9M1.5 9.5h9",
  settings:
    "M1.5 3.5h1M5.5 3.5h5M1.5 8.5h5M9.5 8.5h1M5.5 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM9.5 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  trimNone: "M1.5 1.5h9M1.5 10.5h9M3.6 8.3 6 3.7l2.4 4.6M4.3 7h3.4",
  trimCap: "M1.5 3.7h9M1.5 8.3h9M3.6 8.3 6 3.7l2.4 4.6M4.3 7h3.4",
  bulleted: "M2 3h.01M2 6h.01M2 9h.01M4.5 3h6M4.5 6h6M4.5 9h6",
  numbered: "M1.5 2.2l1-.7v3M1.5 7.6c.3-.5 1.5-.5 1.5.2 0 .6-1.5 1.2-1.5 2h1.6M5 3h5.5M5 8.5h5.5",
  paragraph: "M1.5 1.5h9M1.5 4h6M1.5 8h9M1.5 10.5h6",
};

function icon(path: string): HTMLElement {
  const span = element("span", { className: "icon", ariaHidden: "true" });
  span.innerHTML = `<svg viewBox="0 0 12 12" width="12" height="12"><path d="${path}"/></svg>`;
  return span;
}

function typeReset(what: string): HTMLButtonElement {
  return element(
    "button",
    { type: "button", className: "type-reset", ariaLabel: `Reset ${what}`, title: "Reset" },
    icon(ICONS.reset),
  );
}

// The selection's text node, when it holds text directly: a child text node not only white space.
const ownText = (node: Element): Text | undefined =>
  [...node.childNodes].find((c): c is Text => c.nodeType === 3 && c.textContent?.trim() !== "");

// Each step's size in px, as the frame's tokens.css values it now.
function stepSizes(): Partial<Record<TextStep, number>> {
  const root = doc()?.documentElement;
  if (root === undefined) return {};
  const s = style(root);
  return Object.fromEntries(STEPS.map((step) => [step, px(s.getPropertyValue(`--text-${step}`))]));
}

// The value a control shows: the change in hand, else the saved one.
const current = (target: Selection, name: TypeName): string | null =>
  target.node.style.getPropertyValue(name) || was(target.selector, name);

function setType(name: TypeName, value: string): void {
  if (selection === null || selection.locked.has(name)) return;
  if (typeEdits.get(name)?.target !== selection) {
    typeEdits.set(name, {
      target: selection,
      before: style(selection.node).getPropertyValue(name),
    });
  }
  selection.node.style.setProperty(name, value);
}

// Saves a type value set inline, or drops it when it changes nothing.
function commitType(name: TypeName): void {
  const pending = typeEdits.get(name);
  if (pending === undefined) return;
  typeEdits.delete(name);
  const { node, selector } = pending.target;
  const value = node.style.getPropertyValue(name);
  const saved = was(selector, name);
  const same =
    saved === null ? style(node).getPropertyValue(name) === pending.before : value === saved;
  if (same) node.style.removeProperty(name);
  else saveValue(node, selector, name, value);
}

// Puts back a type value set inline, unsaved.
function revertType(name: TypeName): void {
  const pending = typeEdits.get(name);
  typeEdits.delete(name);
  pending?.target.node.style.removeProperty(name);
}

function resetType(...names: TypeName[]): void {
  if (selection === null) return;
  for (const name of names) {
    revertType(name);
    if (was(selection.selector, name) !== null) {
      saveValue(selection.node, selection.selector, name, null);
    }
  }
}

// A number field: Up and Down step it live, Enter or blur saves what was typed, Escape reverts.
// `data-dirty` marks typing not yet saved, which the field keeps on screen.
function typeField(
  id: string,
  aria: string,
  name: TypeName,
  step: (event: KeyboardEvent, sign: 1 | -1) => string | null,
  typed: (raw: string) => string | null,
): HTMLInputElement {
  const input = element("input", { id, ariaLabel: aria, autocomplete: "off" });
  input.spellcheck = false;
  input.addEventListener("input", () => {
    input.dataset.dirty = "";
  });
  input.addEventListener("keydown", (event) => {
    const sign = UP_DOWN[event.key];
    if (sign !== undefined && !input.readOnly) {
      event.preventDefault();
      const value = step(event, sign);
      if (value !== null) setType(name, value);
      delete input.dataset.dirty;
    }
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") {
      event.stopPropagation();
      delete input.dataset.dirty;
      revertType(name);
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    const value = input.dataset.dirty !== undefined && !input.readOnly ? typed(input.value) : null;
    delete input.dataset.dirty;
    if (value !== null) setType(name, value);
    commitType(name);
  });
  return input;
}

// The font picker (ETH-106): one list of the mockup's families, Google's and the computer's,
// for the selection's family or one of the Template's two fonts on the frame's root. Moving to a
// row previews it inline; a pick saves it, after copying a Google font into the repo.

// What the picker sets: `name` on `node`, saved under `selector`, opened from `anchor`.
type FontTarget = { node: Styled; selector: string; name: string; anchor: HTMLButtonElement };
type FontGroup = "mockup" | "google" | "installed";
// One row: its family, its group, the value a pick saves, and the Google font behind it.
type FontRow = {
  family: string;
  group: FontGroup;
  value: string;
  google: GoogleFont | undefined;
  el: HTMLElement;
};

const GROUPS: Record<FontGroup, string> = {
  mockup: "In this mockup",
  google: "Google",
  installed: "Installed",
};
const GOOGLE_LIST = "https://api.fontsource.org/v1/fonts?type=google";
const LOADING = "Loading Google fonts…";
const ASKING = "Asking for the computer's fonts…";
const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
const SAMPLE = "mmmmmmmmmmlli1WQ@#&";
const ROOT_FONTS = { "--font-text": "Text font", "--font-display": "Display font" };

let fontTarget: FontTarget | null = null;
let fontRows: FontRow[] = [];
let shownRows: FontRow[] = [];
let activeRow = -1;
let previewTimer = 0;
const previewFaces = new Map<string, FontFace[]>(); // by family, until the picker closes
const addedFaces = new Set<FontFace>(); // every face a preview added and not yet removed
let googleFonts: GoogleFont[] | string = ""; // the list, or why there is none ("" not asked)
const installed = new Map<string, string[]>(); // each installed family's style names
let installedNote = ""; // why the Installed group is empty
const measured = new Map<string, boolean>(); // whether each family measured as missing

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const unquote = (family: string): string => family.trim().replaceAll(/["']/g, "");

const fontSearch = element("input", {
  className: "font-search",
  placeholder: "Search fonts",
  ariaLabel: "Search fonts",
  autocomplete: "off",
  role: "combobox",
  ariaExpanded: "true",
  ariaAutoComplete: "list",
});
fontSearch.spellcheck = false;
fontSearch.setAttribute("aria-controls", "wb-font-list");
const fontFilter = element(
  "select",
  { className: "font-filter", ariaLabel: "Font source" },
  element("option", { value: "" }, "All fonts"),
  ...Object.entries(GROUPS).map(([value, title]) => element("option", { value }, title)),
);
const fontList = element("div", {
  id: "wb-font-list",
  role: "listbox",
  ariaLabel: "Fonts",
  className: "font-list",
});
const fontPicker = element(
  "div",
  { id: "wb-fonts", className: "font-picker" },
  element("div", { className: "font-head" }, fontSearch, fontFilter),
  fontList,
);
fontPicker.popover = "auto";

// The families the frame's page loads, without the faces a preview added.
function mockupFamilies(): string[] {
  const d = doc();
  if (d === null) return [];
  return [...d.fonts]
    .filter((f) => !addedFaces.has(f))
    .map((f) => unquote(f.family))
    .filter((f) => isFamilyName(f));
}

// Moves to row `index` of the shown rows and previews it once the move settles. No row puts the
// font back, unless `restore` is false.
function setActive(index: number, scroll = true, restore = true): void {
  const old = shownRows[activeRow];
  if (old !== undefined) old.el.ariaSelected = "false";
  activeRow = index;
  const row = shownRows[index];
  window.clearTimeout(previewTimer);
  if (row === undefined) {
    fontSearch.removeAttribute("aria-activedescendant");
    if (restore && fontTarget !== null) fontTarget.node.style.removeProperty(fontTarget.name);
    return;
  }
  row.el.ariaSelected = "true";
  fontSearch.setAttribute("aria-activedescendant", row.el.id);
  if (scroll) row.el.scrollIntoView({ block: "nearest" });
  previewTimer = window.setTimeout(() => {
    previewFont(row);
  }, 150);
}

// Narrows the list to the search and the group filter, and drops the row in hand.
function filterFonts(restore = true): void {
  setActive(-1, false, restore);
  const group = fontFilter.value;
  for (const row of fontRows) {
    row.el.hidden =
      (group !== "" && row.group !== group) || !matchesFamily(fontSearch.value, row.family);
  }
  shownRows = fontRows.filter((r) => r.el.hidden !== true);
  for (const el of fontList.children) {
    if (!(el instanceof HTMLElement)) continue;
    const key = el.dataset.group;
    el.hidden =
      (group !== "" && key !== group) ||
      (el.querySelector(".font-note") === null && !shownRows.some((r) => r.group === key));
  }
}

// Builds the list, keeping the row in hand when the Google or installed fonts arrive.
function fillFonts(): void {
  const keep = shownRows[activeRow];
  const google = typeof googleFonts === "string" ? [] : googleFonts;
  const merged = mergeFamilies(mockupFamilies(), google);
  const byName = new Map(google.map((g) => [g.family, g]));
  const row = (family: string, group: FontGroup, font?: GoogleFont): FontRow => {
    const category = (font ?? byName.get(googleName(family)))?.category;
    const el = element("div", { role: "option", className: "font-row", title: family }, family);
    const value = familyValue(family, group === "installed" ? "sans-serif" : fallbackOf(category));
    const made: FontRow = { family, group, value, google: font, el };
    el.ariaSelected = "false";
    el.addEventListener("pointermove", () => {
      const at = shownRows.indexOf(made);
      if (at !== activeRow) setActive(at, false);
    });
    el.addEventListener("click", () => {
      pickFont(made);
    });
    return made;
  };
  fontRows = [
    ...merged.mockup.map((f) => row(f, "mockup")),
    ...merged.google.map((g) => row(g.family, "google", g)),
    ...[...installed.keys()]
      .filter((f) => isFamilyName(f))
      .toSorted((a, b) => a.localeCompare(b))
      .map((f) => row(f, "installed")),
  ];
  for (const [i, r] of fontRows.entries()) r.el.id = `wb-font-${i}`;
  const notes: Record<string, string> = {
    mockup: "",
    google: typeof googleFonts === "string" ? googleFonts : "",
    installed: installedNote,
  };
  fontList.replaceChildren(
    ...Object.entries(GROUPS).map(([key, title]) => {
      const group = element(
        "div",
        { role: "group", ariaLabel: title, className: "font-group" },
        element("div", { className: "font-label", ariaHidden: "true" }, title),
        ...fontRows.filter((r) => r.group === key).map((r) => r.el),
      );
      const why = notes[key] ?? "";
      if (why !== "") group.append(element("div", { className: "font-note" }, why));
      group.dataset.group = key;
      return group;
    }),
  );
  filterFonts(false);
  const at = shownRows.findIndex((r) => r.family === keep?.family && r.group === keep.group);
  setActive(at, true, keep !== undefined);
}

async function loadGoogle(): Promise<void> {
  googleFonts = LOADING;
  try {
    const response = await fetch(GOOGLE_LIST);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const list: unknown = await response.json();
    googleFonts = Array.isArray(list) ? list.flatMap((e) => parseGoogleFont(e) ?? []) : [];
  } catch (error) {
    googleFonts = `Google fonts could not be listed: ${reason(error)}`;
  }
  if (fontTarget !== null) fillFonts();
}

// Adds one of queryLocalFonts' FontData to its family's style names.
function addInstalled(font: unknown): void {
  const family = text(prop(font, "family"));
  const name = text(prop(font, "style"));
  if (family !== null && name !== null)
    installed.set(family, [...(installed.get(family) ?? []), name]);
}

// Lists the computer's fonts with the browser's queryLocalFonts, which asks for permission once.
async function loadInstalled(): Promise<void> {
  const query: unknown = Reflect.get(window, "queryLocalFonts");
  if (typeof query !== "function") {
    installedNote = "This browser cannot list installed fonts. Chrome and Edge can.";
    return;
  }
  installedNote = ASKING;
  try {
    const fonts: unknown = await Reflect.apply(query, window, []);
    for (const font of Array.isArray(fonts) ? fonts : []) addInstalled(font);
    installedNote = installed.size === 0 ? "No installed fonts were listed." : "";
  } catch (error) {
    installedNote = `Installed fonts are not available: ${reason(error)}`;
  }
  if (fontTarget !== null) fillFonts();
}

function previewFont(row: FontRow): void {
  const d = doc();
  const view = d?.defaultView;
  if (fontTarget === null || d === null || view === null || view === undefined) return;
  if (row.google !== undefined && !previewFaces.has(row.family)) {
    const faces = previewFiles(row.google).map(
      (f) => new view.FontFace(row.family, `url(${f.url})`, { weight: f.weight, style: f.style }),
    );
    for (const face of faces) {
      d.fonts.add(face);
      addedFaces.add(face);
    }
    previewFaces.set(row.family, faces);
  }
  fontTarget.node.style.setProperty(fontTarget.name, row.value);
}

// Puts back what a preview changed, once the picker closes without a pick.
function endFonts(): void {
  window.clearTimeout(previewTimer);
  const target = fontTarget;
  fontTarget = null;
  target?.node.style.removeProperty(target.name);
  for (const faces of previewFaces.values()) void dropFaces(faces, false);
  previewFaces.clear();
  if (target !== null && fontPicker.contains(document.activeElement)) target.anchor.focus();
}

// Removes faces a preview added: at once, or once `copied` the repo's own face of their family
// is in the frame, so the text does not flash its fallback.
async function dropFaces(faces: FontFace[], copied: boolean): Promise<void> {
  const family = unquote(faces[0]?.family ?? "");
  for (let i = 0; i < (copied ? 300 : 0); i++) {
    const own = [...(doc()?.fonts ?? [])].some(
      (f) => unquote(f.family) === family && !addedFaces.has(f),
    );
    if (own) break;
    // oxlint-disable-next-line no-await-in-loop -- one look per painted frame
    await nextFrame();
  }
  for (const face of faces) {
    doc()?.fonts.delete(face);
    addedFaces.delete(face);
  }
}

// Copies a Google font into the repo through the dev server. True when it is there.
async function copyFont(font: GoogleFont): Promise<boolean> {
  message.textContent = `Copying ${font.family} into the repo…`;
  const response = await fetch(FONTS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: font.id }),
  });
  if (response.ok) {
    message.textContent = "";
    return true;
  }
  const body: unknown = await response.json();
  message.textContent = `Not saved: ${text(prop(body, "error")) ?? response.statusText}`;
  return false;
}

function pickFont(row: FontRow): void {
  const target = fontTarget;
  if (target === null) return;
  window.clearTimeout(previewTimer);
  target.node.style.setProperty(target.name, row.value);
  // The pick owns its preview's faces: they go once the repo has the font, or when it fails.
  const faces = previewFaces.get(row.family) ?? [];
  previewFaces.delete(row.family);
  fontTarget = null;
  target.anchor.focus();
  fontPicker.hidePopover();
  enqueue(async () => {
    let copied = false;
    try {
      copied = row.google === undefined || (await copyFont(row.google));
    } finally {
      void dropFaces(faces, copied);
      if (!copied) target.node.style.removeProperty(target.name);
    }
    if (!copied) return;
    if (was(target.selector, target.name) === row.value) {
      target.node.style.removeProperty(target.name);
    } else {
      saveValue(target.node, target.selector, target.name, row.value);
    }
  });
}

// Readies the picker for `target` just before its button opens it.
function prepareFonts(target: FontTarget): void {
  fontTarget = target;
  fontSearch.value = "";
  fontFilter.value = "";
  const rect = (target.anchor.parentElement ?? target.anchor).getBoundingClientRect();
  fontPicker.style.left = `${rect.right - 248}px`; // its right edge on the field's
  fontPicker.style.top = `${rect.bottom + 4}px`;
  if (installed.size === 0 && installedNote !== ASKING) void loadInstalled();
  if (typeof googleFonts === "string" && googleFonts !== LOADING) void loadGoogle();
  shownRows = [];
  fillFonts();
}

// A button that opens the picker for the target `of` names, or nothing when it names none.
function fontOpener(
  of: (anchor: HTMLButtonElement) => FontTarget | null,
  ...children: HTMLElement[]
) {
  const open = element(
    "button",
    { type: "button", className: "font-open", ariaHasPopup: "listbox", ariaExpanded: "false" },
    ...children,
    icon(ICONS.chevron),
  );
  open.popoverTargetElement = fontPicker;
  open.addEventListener("click", () => {
    if (fontPicker.matches(":popover-open")) return;
    const target = of(open);
    if (target !== null) prepareFonts(target);
  });
  return open;
}

fontSearch.addEventListener("input", () => {
  filterFonts();
});
fontFilter.addEventListener("change", () => {
  filterFonts();
  fontSearch.focus();
});
fontSearch.addEventListener("keydown", (event) => {
  const sign = UP_DOWN[event.key];
  if (sign !== undefined) {
    event.preventDefault();
    setActive(Math.min(Math.max(activeRow - sign, 0), shownRows.length - 1));
  }
  const row = shownRows[activeRow] ?? shownRows[0];
  if (event.key === "Enter" && row !== undefined) {
    event.preventDefault(); // focus moves to the opener, which Enter would click open again
    pickFont(row);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    fontPicker.hidePopover();
  }
});
fontPicker.addEventListener("toggle", (event) => {
  const open = event.newState === "open";
  for (const b of [familyOpen, ...rootFonts.map((r) => r.open)]) {
    b.ariaExpanded = String(open && fontTarget?.anchor === b);
  }
  if (!open) endFonts();
  else if (fontTarget === null) fontPicker.hidePopover();
  else fontSearch.focus();
});

// Whether a family is neither in the frame's fonts nor installed: set in it with a fallback, a
// sample is as wide as in the fallback alone, for two different fallbacks.
// ponytail: cannot tell a missing font from one exactly as wide as both fallbacks.
function missing(d: Document, family: string): boolean {
  if (GENERIC.has(family) || [...d.fonts].some((f) => unquote(f.family) === family)) return false;
  let gone = measured.get(family);
  if (gone === undefined) {
    const context = d.createElement("canvas").getContext("2d");
    const width = (font: string): number => {
      if (context === null) return 0;
      context.font = font;
      return context.measureText(SAMPLE).width;
    };
    gone = ["serif", "monospace"].every(
      (f) => width(`40px "${family}", ${f}`) === width(`40px ${f}`),
    );
    measured.set(family, gone);
  }
  return gone;
}

const familyText = element("span", { className: "type-family" });
const familyMissing = element(
  "span",
  { className: "font-missing", role: "img", hidden: true },
  icon(ICONS.warning),
);
const familyOpen = fontOpener(
  (anchor) =>
    selection === null
      ? null
      : { node: selection.node, selector: selection.selector, name: "font-family", anchor },
  familyText,
  familyMissing,
);
const familyReset = typeReset("font family");
familyReset.addEventListener("click", () => {
  resetType("font-family");
});

// The Template's two fonts, on the frame's root, in the Type panel.
const rootFonts = Object.entries(ROOT_FONTS).map(([name, title]) => {
  const value = element("span");
  const open = fontOpener((anchor) => {
    const root = doc()?.documentElement;
    return root === undefined ? null : { node: root, selector: ROOT, name, anchor };
  }, value);
  open.ariaLabel = title;
  const clear = typeReset(title.toLowerCase());
  clear.addEventListener("click", () => {
    const root = doc()?.documentElement;
    if (root !== undefined && was(ROOT, name) !== null) saveValue(root, ROOT, name, null);
  });
  const row = element(
    "div",
    { className: "font-root" },
    element("span", {}, title),
    element("div", { className: "type-field" }, open, clear),
  );
  return { name, value, open, clear, row };
});

function trackRootFonts(): void {
  // A document being replaced has no root element yet, whatever its type says.
  const root: HTMLElement | null | undefined = doc()?.documentElement;
  const visible = Boolean(root);
  for (const r of rootFonts) {
    r.row.hidden = !visible;
    if (!root) continue;
    const family = unquote(style(root).getPropertyValue(r.name).split(",")[0] ?? "");
    if (r.value.textContent !== family) r.value.textContent = family;
    r.clear.disabled = was(ROOT, r.name) === null;
  }
}

// The type scale (ETH-109). tokens.css works out the nine steps and their line heights from three
// values on the frame's root; the panel previews a value inline there, saves it on release, Enter
// or blur, and reads every step back from the frame, so the app's CSS is the one calculation.
const RATIOS = [1.125, 1.2, 1.25, 1.333, 1.5];
// Each value's label, one arrow press, the drag distance per press, its bounds and decimals.
type ScaleSpec = {
  title: string;
  step: number;
  dragPx: number;
  min: number;
  max: number;
  places: number;
  unit: string;
};
const SCALE_SPECS: Record<ScaleName, ScaleSpec> = {
  "--type-base": { title: "Base size", step: 2, dragPx: 4, min: 4, max: 96, places: 0, unit: "px" },
  "--type-ratio": {
    title: "Ratio",
    step: 0.01,
    dragPx: 4,
    min: 1.001,
    max: 3,
    places: 3,
    unit: "",
  },
  "--type-leading": {
    title: "Leading",
    step: 0.05,
    dragPx: 4,
    min: 1,
    max: 3,
    places: 2,
    unit: "",
  },
};

const scaleEdits = new Map<ScaleName, string>(); // each value in hand's value before the change
let scaleDrag: { name: ScaleName; scrub: HTMLElement; from: number; x: number } | null = null;

// A value the endpoint takes: the base floored to even, the others to their decimals, in bounds.
function scaleText(name: ScaleName, n: number): string {
  const { min, max, places, unit } = SCALE_SPECS[name];
  const fitted = name === "--type-base" ? Math.floor(n / 2) * 2 : Number(n.toFixed(places));
  return `${Math.min(Math.max(fitted, min), max)}${unit}`;
}
const scaleNow = (name: ScaleName): number => {
  const root = doc()?.documentElement;
  return root === undefined ? Number.NaN : Number.parseFloat(style(root).getPropertyValue(name));
};
// One arrow press from `n`: the ratio moves between the named ratios, the others by their step.
function scaleStep(name: ScaleName, n: number, sign: 1 | -1): number {
  if (name !== "--type-ratio") return n + sign * SCALE_SPECS[name].step;
  const named =
    sign === 1 ? RATIOS.find((r) => r > n + 1e-9) : RATIOS.findLast((r) => r < n - 1e-9);
  return named ?? n;
}

function previewScale(name: ScaleName, n: number): void {
  const root = doc()?.documentElement;
  if (root === undefined || !Number.isFinite(n)) return;
  if (!scaleEdits.has(name)) scaleEdits.set(name, style(root).getPropertyValue(name).trim());
  root.style.setProperty(name, scaleText(name, n));
}
// Saves the value in hand, or drops it when it changes nothing.
function commitScale(name: ScaleName): void {
  const root = doc()?.documentElement;
  const before = scaleEdits.get(name);
  scaleEdits.delete(name);
  if (root === undefined || before === undefined) return;
  const value = root.style.getPropertyValue(name);
  if (value === before) root.style.removeProperty(name);
  else saveValue(root, ROOT, name, value);
}
// Puts back the value in hand, unsaved, and ends a scrub of it, so its release saves nothing.
function revertScale(name: ScaleName): void {
  if (scaleDrag?.name === name) {
    delete scaleDrag.scrub.dataset.dragging;
    scaleDrag = null;
  }
  if (scaleEdits.delete(name)) doc()?.documentElement.style.removeProperty(name);
}
// A typed value as the endpoint saves it, or null: the whole text must be a plain decimal, the
// base is floored to even, and the value must pass the endpoint's own check.
function typedScale(name: ScaleName, raw: string): string | null {
  if (!/^\d*\.?\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  const value = name === "--type-base" ? `${Math.floor(n / 2) * 2}px` : String(n);
  return scaleValue(name, value) ? value : null;
}

const ratioList = element(
  "datalist",
  { id: "wb-ratios" },
  ...RATIOS.map((r) => element("option", { value: String(r) })),
);
// A drag on a value's label scrubs it one step per `dragPx` px, live, and saves on release.
function scrubScale(scrub: HTMLLabelElement, name: ScaleName): void {
  scrub.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    scrub.setPointerCapture(event.pointerId);
    scaleDrag = { name, scrub, from: scaleNow(name), x: event.clientX };
    scrub.dataset.dragging = "";
  });
  scrub.addEventListener("pointermove", (event) => {
    if (scaleDrag?.name !== name) return;
    const steps = Math.round((event.clientX - scaleDrag.x) / SCALE_SPECS[name].dragPx);
    previewScale(name, scaleDrag.from + steps * SCALE_SPECS[name].step);
  });
  const endScrub = (cancel: boolean) => {
    if (scaleDrag?.name !== name) return;
    scaleDrag = null;
    delete scrub.dataset.dragging;
    if (cancel) revertScale(name);
    else commitScale(name);
  };
  scrub.addEventListener("pointerup", () => {
    endScrub(false);
  });
  scrub.addEventListener("pointercancel", () => {
    endScrub(true);
  });
}

const scaleFields = SCALE.map((name) => {
  const { title } = SCALE_SPECS[name];
  const id = `wb-${name.slice(2)}`;
  const input = element("input", { id, inputMode: "decimal", autocomplete: "off" });
  input.spellcheck = false;
  if (name === "--type-ratio") input.setAttribute("list", ratioList.id);
  const scrub = element("label", { htmlFor: id, className: "scrub" }, title);
  const clear = element("button", { type: "button", className: "reset" }, "Reset");
  clear.ariaLabel = `Reset ${title.toLowerCase()}`;
  input.addEventListener("input", () => {
    input.dataset.dirty = "";
  });
  input.addEventListener("keydown", (event) => {
    const sign = UP_DOWN[event.key];
    if (sign !== undefined) {
      event.preventDefault();
      delete input.dataset.dirty;
      previewScale(name, scaleStep(name, scaleNow(name), sign));
    }
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") {
      event.stopPropagation();
      delete input.dataset.dirty;
      revertScale(name);
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    if (input.dataset.dirty !== undefined) {
      delete input.dataset.dirty;
      const typed = typedScale(name, input.value);
      if (typed === null) message.textContent = `Not a ${title.toLowerCase()}: ${input.value}`;
      else {
        message.textContent = "";
        previewScale(name, Number.parseFloat(typed));
      }
    }
    commitScale(name);
  });
  scrubScale(scrub, name);
  clear.addEventListener("click", () => {
    revertScale(name);
    const root = doc()?.documentElement;
    if (root !== undefined && was(ROOT, name) !== null) saveValue(root, ROOT, name, null);
  });
  return { name, input, clear, row: element("div", { className: "row" }, scrub, input, clear) };
});

// The nine steps as the frame works them out: each one's size and line height in px.
const stepReadouts = STEPS.map((step) => {
  const size = element("span");
  const line = element("span");
  const row = element(
    "div",
    { className: "scale-step" },
    element("code", {}, step),
    size,
    element("span", { className: "times" }, "/"),
    line,
  );
  return { step, size, line, row };
});

const scalePanel = element(
  "section",
  { ariaLabel: "Type", className: "scale" },
  element("h2", {}, "Type"),
  ...rootFonts.map((r) => r.row),
  ...scaleFields.map((f) => f.row),
  ratioList,
  element(
    "div",
    { className: "scale-steps", role: "group", ariaLabel: "Type steps: size / line height" },
    ...stepReadouts.map((r) => r.row),
  ),
);

// Sets `el`'s text only when it changed, so a value under the pointer is not rewritten each frame.
function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function trackScale(): void {
  const root: HTMLElement | null | undefined = doc()?.documentElement;
  if (!root) return;
  const s = style(root);
  for (const { name, input, clear } of scaleFields) {
    const value = String(Number.parseFloat(s.getPropertyValue(name)) || "");
    if (input.dataset.dirty === undefined && input.value !== value) input.value = value;
    clear.disabled = was(ROOT, name) === null && !scaleEdits.has(name);
  }
  trackReadouts(s);
}

// Each step's size and line height in px, blank while the frame's page is still loading.
function trackReadouts(s: CSSStyleDeclaration): void {
  for (const r of stepReadouts) {
    setText(r.size, String(px(s.getPropertyValue(`--text-${r.step}`)) || ""));
    setText(r.line, String(px(s.getPropertyValue(`--text-${r.step}--line-height`)) || ""));
  }
}

const styleSelect = element("select", { id: "wb-style", ariaLabel: "Style" });
const styleReset = typeReset("style");
let styleKey = "";
styleSelect.addEventListener("change", () => {
  const [, weight = "400", italic] = /^(\d+)(i?)$/.exec(styleSelect.value) ?? [];
  setType("font-weight", weight);
  setType("font-style", italic === "i" ? "italic" : "normal");
  commitType("font-weight");
  commitType("font-style");
});
styleReset.addEventListener("click", () => {
  resetType("font-weight", "font-style");
});

// Size: the step in hand, and the next one up or down from a size, on the scale or off it.
function sizeStep(target: Selection): TextStep | null {
  const value = current(target, "font-size") ?? "";
  const named = /^var\(--text-(.+)\)$/.exec(value)?.[1];
  if (named !== undefined) return STEPS.find((s) => s === named) ?? null;
  if (value !== "") return null;
  return stepOf(px(style(target.node).fontSize), stepSizes());
}
function nextStep(sign: 1 | -1): TextStep | null {
  if (selection === null) return null;
  const sizes = stepSizes();
  const at = sizeStep(selection);
  const size = px(style(selection.node).fontSize);
  const order = sign === 1 ? STEPS : STEPS.toReversed();
  if (at !== null) return order[order.indexOf(at) + 1] ?? at;
  return order.find((s) => (sizes[s] ?? 0) * sign > size * sign) ?? null;
}
const sizeInput = typeField(
  "wb-font-size",
  "Size",
  "font-size",
  (_, sign) => {
    const s = nextStep(sign);
    return s === null ? null : `var(--text-${s})`;
  },
  (raw) => {
    const n = wholeNumber(raw);
    return n === null || n < 1 ? null : `${n}px`;
  },
);
const sizeMark = element("span", { className: "unit" });
const sizeOpen = element(
  "button",
  {
    type: "button",
    className: "type-open",
    ariaLabel: "Size steps",
    ariaHasPopup: "listbox",
    ariaExpanded: "false",
  },
  icon(ICONS.chevron),
);
const sizeReset = typeReset("size");
const stepOptions = STEPS.map((s) => {
  const size = element("span", { className: "unit" });
  const option = element(
    "button",
    { type: "button", role: "option", className: "step" },
    element("span", {}, s),
    size,
  );
  option.dataset.step = s;
  option.addEventListener("click", () => {
    setType("font-size", `var(--text-${s})`);
    commitType("font-size");
    stepList.hidePopover();
    sizeInput.focus();
  });
  return { s, option, size };
});
const stepList = element(
  "div",
  { id: "wb-steps", className: "steps", role: "listbox", ariaLabel: "Size steps" },
  ...stepOptions.map((o) => o.option),
);
stepList.popover = "auto";
stepList.addEventListener("keydown", (event) => {
  const sign = UP_DOWN[event.key];
  if (sign === undefined) return;
  event.preventDefault();
  const at = stepOptions.findIndex((o) => o.option === document.activeElement);
  stepOptions[Math.min(Math.max(at - sign, 0), STEPS.length - 1)]?.option.focus();
});
stepList.addEventListener("toggle", (event) => {
  const open = (event as ToggleEvent).newState === "open";
  sizeOpen.ariaExpanded = String(open);
  if (!open) return;
  const at = selection === null ? null : sizeStep(selection);
  const sizes = stepSizes();
  for (const { s, option, size } of stepOptions) {
    size.textContent = String(sizes[s] ?? "");
    option.ariaSelected = String(s === at);
  }
  (stepOptions.find((o) => o.s === at) ?? stepOptions[0])?.option.focus();
});
sizeOpen.addEventListener("click", () => {
  const rect = sizeInput.parentElement?.getBoundingClientRect();
  if (rect !== undefined) {
    stepList.style.left = `${rect.left}px`;
    stepList.style.top = `${rect.bottom + 4}px`;
    stepList.style.width = `${rect.width}px`;
  }
  stepList.togglePopover();
});
sizeReset.addEventListener("click", () => {
  resetType("font-size");
});

// Line height: the browser's height for one line of the text, for an arrow key from Auto.
function lineBox(node: Element): number {
  const own = ownText(node);
  if (own === undefined) return 0;
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(own);
  return range.getClientRects()[0]?.height ?? 0;
}
const lineInput = typeField(
  "wb-line-height",
  "Line height",
  "line-height",
  (_, sign) => {
    if (selection === null) return null;
    const now = style(selection.node).lineHeight;
    if (now === "normal") return `${Math.max(Math.ceil(lineBox(selection.node) / 4) * 4, 4)}px`;
    return `${Math.max(Math.round(px(now)) + sign * 4, 4)}px`;
  },
  (raw) => {
    const n = wholeNumber(raw);
    return n === null || n < 1 ? null : `${n}px`;
  },
);
const lineReset = typeReset("line height");
lineReset.addEventListener("click", () => {
  resetType("line-height");
});

const spacingNow = (node: Element): number => {
  const s = style(node);
  return s.letterSpacing === "normal" ? 0 : percentOf(px(s.letterSpacing), px(s.fontSize));
};
const trackingInput = typeField(
  "wb-letter-spacing",
  "Letter spacing",
  "letter-spacing",
  (event, sign) =>
    selection === null ? null : emOf(spacingNow(selection.node) + sign * (event.shiftKey ? 10 : 1)),
  (raw) => {
    const n = Number(/^\s*(-?\d+(?:\.\d+)?)\s*%?\s*$/.exec(raw)?.[1] ?? Number.NaN);
    return Number.isFinite(n) && n >= -100 && n <= 200 ? emOf(n) : null;
  },
);
const trackingReset = typeReset("letter spacing");
trackingReset.addEventListener("click", () => {
  resetType("letter-spacing");
});

// Sets each value live, then saves them one request after another; null removes a saved value.
function setTypes(values: [TypeName, string | null][]): void {
  for (const [name, value] of values) {
    if (value === null) resetType(name);
    else setType(name, value);
  }
  for (const [name] of values) commitType(name);
}

// A row of buttons with a pressed state, one per option, and its reset after it.
function segmented(
  aria: string,
  options: Record<string, [title: string, content: HTMLElement]>,
  onPick: (value: string) => void,
  onReset: () => void,
) {
  const buttons = Object.entries(options).map(([value, [title, content]]) => {
    const button = element(
      "button",
      { type: "button", ariaLabel: title, title, ariaPressed: "false" },
      content,
    );
    button.dataset.value = value;
    button.addEventListener("click", () => {
      onPick(value);
    });
    return button;
  });
  const clear = typeReset(aria.toLowerCase());
  clear.addEventListener("click", onReset);
  const group = element("div", { className: "segmented", role: "group" }, ...buttons);
  group.ariaLabel = aria;
  return { buttons, clear, cell: element("div", { className: "type-align" }, group, clear) };
}
type Segmented = ReturnType<typeof segmented>;

// A row that sets one property: a pick saves the option's value, its reset removes it.
const one = (name: TypeName) =>
  [
    (value: string) => {
      setTypes([[name, value]]);
    },
    () => {
      resetType(name);
    },
  ] as const;
const hAlign = segmented(
  "Horizontal alignment",
  {
    left: ["Align left", icon(ICONS.left)],
    center: ["Align center", icon(ICONS.center)],
    right: ["Align right", icon(ICONS.right)],
  },
  ...one("text-align"),
);
const vAlign = segmented(
  "Vertical alignment",
  {
    start: ["Align top", icon(ICONS.start)],
    center: ["Align middle", icon(ICONS.middle)],
    end: ["Align bottom", icon(ICONS.end)],
  },
  ...one("align-content"),
);

const cell = (...children: HTMLElement[]) =>
  element("div", { className: "type-field" }, ...children);

// The Basics popover (ETH-107): the type settings used less often, behind the section's
// settings button, in Figma's order. Each row saves plain CSS like the section's controls.

// A short line of text as a button's face, for the options Figma shows as letters.
function glyph(face: string, css = ""): HTMLElement {
  const span = element("span", { className: "glyph", ariaHidden: "true" }, face);
  span.style.cssText = css;
  return span;
}

// How list style applies to an element: a list's markers only, the element as one list item,
// or not at all.
type ListMode = "markers" | "item" | null;
const LISTS = new Set(["UL", "OL", "LI"]);
const LIST: TypeName[] = ["display", "list-style-type", "list-style-position"];
function listMode(target: Selection, s: CSSStyleDeclaration): ListMode {
  if (LISTS.has(target.node.tagName)) return "markers";
  return s.display === "block" || current(target, "display") === "list-item" ? "item" : null;
}

const basicsAlign = segmented(
  "Alignment",
  {
    left: ["Align left", icon(ICONS.left)],
    center: ["Align center", icon(ICONS.center)],
    right: ["Align right", icon(ICONS.right)],
    justify: ["Justify", icon(ICONS.justify)],
  },
  ...one("text-align"),
);
const decoration = segmented(
  "Decoration",
  {
    none: ["No decoration", glyph("–")],
    underline: ["Underline", glyph("U", "text-decoration: underline")],
    "line-through": ["Strikethrough", glyph("S", "text-decoration: line-through")],
  },
  ...one("text-decoration-line"),
);
const textCase = segmented(
  "Case",
  {
    none: ["As typed", glyph("–")],
    uppercase: ["Upper case", glyph("AG")],
    lowercase: ["Lower case", glyph("ag")],
    capitalize: ["Title case", glyph("Ag")],
    "small-caps": ["Small caps", glyph("Aɢ")],
  },
  (value) => {
    const small = value === "small-caps";
    setTypes([
      ["text-transform", small ? "none" : value],
      ["font-variant-caps", small ? "small-caps" : "normal"],
    ]);
  },
  () => {
    resetType("text-transform", "font-variant-caps");
  },
);
const trim = segmented(
  "Vertical trim",
  {
    normal: ["Standard", icon(ICONS.trimNone)],
    "trim-both cap alphabetic": ["Cap height to baseline", icon(ICONS.trimCap)],
  },
  ...one("text-box"),
);
const listStyle = segmented(
  "List style",
  {
    none: ["No list", glyph("–")],
    disc: ["Bulleted list", icon(ICONS.bulleted)],
    decimal: ["Numbered list", icon(ICONS.numbered)],
  },
  (value) => {
    if (selection === null) return;
    const mode = listMode(selection, style(selection.node));
    if (mode === "markers") setTypes([["list-style-type", value]]);
    else if (value === "none") setTypes(LIST.map((n) => [n, null]));
    else {
      setTypes([
        ["display", "list-item"],
        ["list-style-type", value],
        ["list-style-position", "inside"],
      ]);
    }
  },
  () => {
    resetType(...LIST);
  },
);
const listNote = element(
  "p",
  { className: "type-note" },
  "List style needs a block or a list, not an inline or laid out element.",
);
const paragraphInput = typeField(
  "wb-margin-bottom",
  "Paragraph spacing",
  "margin-bottom",
  (event, sign) => {
    if (selection === null) return null;
    const now = Math.round(px(style(selection.node).marginBottom));
    return `${Math.max(now + sign * (event.shiftKey ? 10 : 2), 0)}px`;
  },
  (raw) => {
    const n = wholeNumber(raw);
    return n === null ? null : `${n}px`;
  },
);
const paragraphReset = typeReset("paragraph spacing");
paragraphReset.addEventListener("click", () => {
  resetType("margin-bottom");
});

const basicsRow = (name: string, control: HTMLElement) =>
  element("div", { className: "basics-row" }, element("span", {}, name), control);
const basics = element(
  "div",
  { id: "wb-basics", className: "basics", role: "dialog", ariaLabel: "Type settings" },
  element("h3", {}, "Basics"),
  basicsRow("Alignment", basicsAlign.cell),
  basicsRow("Decoration", decoration.cell),
  basicsRow("Case", textCase.cell),
  basicsRow("Vertical trim", trim.cell),
  basicsRow("List style", listStyle.cell),
  listNote,
  basicsRow(
    "Paragraph spacing",
    element(
      "div",
      { className: "type-align" },
      cell(
        element(
          "label",
          { htmlFor: paragraphInput.id, title: "Paragraph spacing" },
          icon(ICONS.paragraph),
        ),
        paragraphInput,
      ),
      paragraphReset,
    ),
  ),
);
basics.popover = "auto";
const basicsOpen = element(
  "button",
  {
    type: "button",
    className: "type-open",
    ariaLabel: "Type settings",
    title: "Type settings",
    ariaHasPopup: "dialog",
    ariaExpanded: "false",
  },
  icon(ICONS.settings),
);
basicsOpen.popoverTargetElement = basics;
// Opens beside the inspector, as Figma's does, so the section stays in view.
basics.addEventListener("beforetoggle", (event) => {
  if (event.newState !== "open") return;
  const rect = basicsOpen.getBoundingClientRect();
  const inspector = basicsOpen.closest(".inspector")?.getBoundingClientRect() ?? rect;
  basics.style.left = `${inspector.left - 280 - 8}px`; // its width, 8px clear of the inspector
  basics.style.top = `${Math.max(rect.top - 8, 8)}px`;
});
basics.addEventListener("toggle", (event) => {
  const open = event.newState === "open";
  basicsOpen.ariaExpanded = String(open);
  if (!open) return;
  const overflow = basics.getBoundingClientRect().bottom - (innerHeight - 8);
  if (overflow > 0) basics.style.top = `${Math.max(px(basics.style.top) - overflow, 8)}px`;
  basics.querySelector<HTMLButtonElement>("[aria-pressed=true]:enabled")?.focus();
});

const typeNote = element(
  "p",
  { className: "type-note" },
  "Read-only fields are set in the element's own style attribute, which no stylesheet overrides.",
);
const typePanel = element(
  "section",
  { ariaLabel: "Typography", className: "type" },
  element("div", { className: "type-head" }, element("h2", {}, "Typography"), basicsOpen),
  element(
    "div",
    { className: "type-grid" },
    cell(familyOpen, familyReset),
    cell(styleSelect, icon(ICONS.chevron), styleReset),
    cell(sizeInput, sizeMark, sizeOpen, sizeReset),
    cell(
      element("label", { htmlFor: lineInput.id, title: "Line height" }, icon(ICONS.lineHeight)),
      lineInput,
      lineReset,
    ),
    cell(
      element(
        "label",
        { htmlFor: trackingInput.id, title: "Letter spacing" },
        icon(ICONS.letterSpacing),
      ),
      trackingInput,
      element("span", { className: "unit" }, "%"),
      trackingReset,
    ),
    hAlign.cell,
    vAlign.cell,
  ),
  typeNote,
);

// Computed alignments as the buttons name them.
const H_ALIGNED: Record<string, string> = { start: "left", end: "right" };
const V_ALIGNED: Record<string, string> = {
  normal: "start",
  "flex-start": "start",
  "flex-end": "end",
};

// The height of the element's text as laid out: its lines, each a line height tall.
function textHeight(node: Element, lineHeight: string): number {
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  const rects = [...range.getClientRects()];
  const lines = new Set(rects.map((r) => Math.round(r.bottom))).size;
  return lines * (lineHeight === "normal" ? (rects[0]?.height ?? 0) : px(lineHeight));
}

// Lists the family's styles, rebuilt only when the family or the current style changes.
function fillStyles(node: Element, family: string, weight: number, italic: boolean): void {
  const key = `${family}|${weight}|${italic}|${installed.size}`;
  if (key === styleKey) return;
  styleKey = key;
  const faces = [...node.ownerDocument.fonts].filter(
    (f) => f.family.replaceAll(/["']/g, "") === family,
  );
  // An installed family has no face in the page: its weights come from its style names.
  const known = faces.length > 0 ? faces : installedFaces(installed.get(family) ?? []);
  styleSelect.replaceChildren(
    ...styleList(known, { weight, italic }).map((s) =>
      element("option", { value: `${s.weight}${s.italic ? "i" : ""}` }, s.label),
    ),
  );
  styleSelect.value = `${weight}${italic ? "i" : ""}`;
}

// Shows `value` in a field the user is not typing in, leaving its caret alone when unchanged.
function fill(input: HTMLInputElement, value: string): void {
  if (input.dataset.dirty === undefined && input.value !== value) input.value = value;
}

// Shows a number field's value, read-only state and reset.
function trackField(
  target: Selection,
  name: TypeName,
  input: HTMLInputElement,
  value: string,
  clear: HTMLButtonElement,
): void {
  fill(input, value);
  input.readOnly = target.locked.has(name);
  clear.disabled = was(target.selector, name) === null;
}

function trackStyle(target: Selection, s: CSSStyleDeclaration): void {
  const family = s.fontFamily.split(",")[0]?.trim().replaceAll(/["']/g, "") ?? "";
  familyText.textContent = family;
  familyText.title = family;
  familyOpen.ariaLabel = `Font family, ${family}`;
  familyOpen.disabled = target.locked.has("font-family");
  familyReset.disabled = was(target.selector, "font-family") === null;
  const gone = missing(target.node.ownerDocument, family);
  familyMissing.hidden = !gone;
  familyMissing.title = gone ? `${family} is not in the repo or installed on this computer` : "";
  familyMissing.ariaLabel = familyMissing.title;
  fillStyles(target.node, family, Number(s.fontWeight), s.fontStyle !== "normal");
  styleSelect.disabled = target.locked.has("font-weight") || target.locked.has("font-style");
  styleReset.disabled =
    was(target.selector, "font-weight") === null && was(target.selector, "font-style") === null;
}

function trackSize(target: Selection, s: CSSStyleDeclaration): void {
  const at = sizeStep(target);
  trackField(target, "font-size", sizeInput, String(px(s.fontSize)), sizeReset);
  sizeMark.textContent = at ?? "off";
  sizeMark.dataset.off = String(at === null);
  sizeMark.title = at === null ? "Off the type scale: does not follow the type dial" : "";
  sizeOpen.disabled = sizeInput.readOnly;
}

// Presses the option `value` names, and shows whether `names` are read-only or saved.
function trackChoice(target: Selection, row: Segmented, value: string, names: TypeName[]): void {
  for (const b of row.buttons) {
    b.ariaPressed = String(b.dataset.value === value);
    b.disabled = names.some((n) => target.locked.has(n));
  }
  row.clear.disabled = names.every((n) => was(target.selector, n) === null);
}

function trackAlign(target: Selection, s: CSSStyleDeclaration): void {
  trackChoice(target, hAlign, H_ALIGNED[s.textAlign] ?? s.textAlign, ["text-align"]);
  trackChoice(target, vAlign, V_ALIGNED[s.alignContent] ?? s.alignContent, ["align-content"]);
  // Vertical alignment only moves text in a block taller than its text.
  const { node } = target;
  const content = node.clientHeight - px(s.paddingTop) - px(s.paddingBottom);
  vAlign.cell.hidden = !BLOCKS.has(s.display) || content <= textHeight(node, s.lineHeight) + 1;
}

function trackList(target: Selection, s: CSSStyleDeclaration): void {
  const mode = listMode(target, s);
  const list = mode === "item" && s.display !== "list-item" ? "none" : s.listStyleType;
  trackChoice(target, listStyle, list, mode === "markers" ? ["list-style-type"] : LIST);
  if (mode === null) for (const b of listStyle.buttons) b.disabled = true;
  listNote.hidden = mode !== null;
}

function trackBasics(target: Selection, s: CSSStyleDeclaration): void {
  trackChoice(target, basicsAlign, H_ALIGNED[s.textAlign] ?? s.textAlign, ["text-align"]);
  trackChoice(target, decoration, s.textDecorationLine, ["text-decoration-line"]);
  const small = s.fontVariantCaps === "small-caps" && s.textTransform === "none";
  trackChoice(target, textCase, small ? "small-caps" : s.textTransform, [
    "text-transform",
    "font-variant-caps",
  ]);
  const trimmed = s.getPropertyValue("text-box") !== "normal";
  trackChoice(target, trim, trimmed ? "trim-both cap alphabetic" : "normal", ["text-box"]);
  trackList(target, s);
  const spacing = String(Math.round(px(s.marginBottom)));
  trackField(target, "margin-bottom", paragraphInput, spacing, paragraphReset);
}

function trackType(): void {
  const target = selection;
  typePanel.hidden = target === null || ownText(target.node) === undefined;
  if (typePanel.hidden && basics.matches(":popover-open")) basics.hidePopover();
  if (target === null || typePanel.hidden) return;
  const s = style(target.node);
  trackStyle(target, s);
  trackSize(target, s);
  const line = s.lineHeight === "normal" ? "Auto" : String(Math.round(px(s.lineHeight)));
  trackField(target, "line-height", lineInput, line, lineReset);
  const tracking = String(spacingNow(target.node));
  trackField(target, "letter-spacing", trackingInput, tracking, trackingReset);
  trackAlign(target, s);
  trackBasics(target, s);
  typeNote.hidden = !TYPE.some((n) => target.locked.has(n));
}

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
  trackType();
  trackRootFonts();
  trackScale();
  trackUnmatched();
  trackChat();
  requestAnimationFrame(track);
}

document.body.append(
  element(
    "main",
    { className: "workbench" },
    element("div", { className: "canvas" }, frame, overlay, ...chatLayer),
    element(
      "aside",
      { className: "inspector", ariaLabel: "Inspector" },
      element("div", { className: "tools" }, tool),
      element("h2", {}, "Window"),
      element("div", { className: "row" }, label, field, reset),
      scalePanel,
      selectionPanel,
      typePanel,
      unmatchedPanel,
      message,
    ),
  ),
);
document.body.append(stepList, fontPicker, basics);
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
document.addEventListener("keydown", keyDown);
frame.addEventListener("load", () => {
  watchFrame();
  void load();
});
requestAnimationFrame(track);
