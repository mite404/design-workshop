// The Workbench page: the running app in a frame (the canvas), an overlay of handles over it, and
// the inspector. One value, the window's corner radius, has three inputs (ADR-005): the field,
// a scrub on its label, and four handles on the canvas. All three set `shown`, the one value in
// hand, which lives inline on the frame's root until the override file has it (ADR-004).
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

const NAME = "--window-radius";
const ENDPOINT = "/__workbench/values";
const LEAST_INSET = 8;
const CURSOR: Record<Corner, string> = {
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};

// A drag in progress: the control dragged, the value before it, and where the pointer started.
type Drag = { control: HTMLElement; from: number; x: number; y: number };

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const frame = element("iframe", { src: "/", title: "Canvas", className: "frame" });
const outline = element("div", { className: "outline" });
const handles = CORNERS.map(() =>
  element("div", { className: "handle", tabIndex: 0, ariaLabel: "Corner radius" }),
);
const pill = element("div", { className: "pill", ariaHidden: "true" });
const overlay = element("div", { className: "overlay" }, outline, ...handles, pill);
const field = element("input", { id: "radius", inputMode: "numeric", autocomplete: "off" });
const label = element("label", { htmlFor: "radius", className: "scrub" }, "Corner radius");
const reset = element("button", { type: "button", className: "reset" }, "Reset");
const message = element("p", { className: "message", role: "status" });

let baseline = 0; // tokens.css's value, in px
let saved: string | null = null; // the override file's value as last read: the next write's `was`
let shown = 0; // the value in hand, in px
let drag: Drag | null = null;
let selected = false;
let queue = Promise.resolve();

// oxlint-disable-next-line prefer-number-coercion -- Number("20px") is NaN
const px = (value: string): number => Number.parseFloat(value); // "20px" → 20
const prop = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const doc = (): Document | null => frame.contentDocument;
const windowElement = (): Element | null => doc()?.querySelector("[data-slot=window]") ?? null;
const box = (): Box => windowElement()?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
const onDisk = (): number => (saved === null ? baseline : px(saved));
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
const style = (node: Element) => (node.ownerDocument.defaultView ?? window).getComputedStyle(node);

function show(radius: number): void {
  shown = radius;
  field.value = String(radius);
  pill.textContent = `Radius ${radius}`;
  for (const handle of handles) handle.ariaValueNow = String(radius);
  doc()?.documentElement.style.setProperty(NAME, `${radius}px`);
}

// Drops the inline value once the frame's own stylesheets give `expected`: after the override
// file's hot reload. Stops early when a newer change has taken the value in hand.
async function settle(expected: number): Promise<void> {
  for (let i = 0; i < 300; i++) {
    const root = doc()?.documentElement;
    if (root === undefined || shown !== expected || drag !== null) return;
    root.style.removeProperty(NAME);
    if (px(style(root).getPropertyValue(NAME)) === expected) return;
    root.style.setProperty(NAME, `${expected}px`);
    // oxlint-disable-next-line no-await-in-loop -- one look per painted frame
    await nextFrame();
  }
}

async function load(): Promise<void> {
  const values: unknown = await (await fetch(ENDPOINT)).json();
  baseline = px(text(prop(prop(values, NAME), "baseline")) ?? "0");
  saved = text(prop(prop(values, NAME), "override"));
  reset.disabled = saved === null;
  show(onDisk());
  await settle(shown);
}

async function write(value: string | null): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: NAME, value, was: saved }),
  });
  if (response.status === 409) {
    message.textContent = "The override file changed on disk, so this was not saved. Showing it.";
    await load();
    return;
  }
  if (!response.ok) {
    const body: unknown = await response.json();
    message.textContent = `Not saved: ${text(prop(body, "error")) ?? response.statusText}`;
    return;
  }
  saved = value;
  reset.disabled = saved === null;
  message.textContent = "";
  await settle(onDisk());
}

// Writes the value in hand, or null to reset, one write at a time (ADR-004). A value the file
// already gives, saved or baseline, writes nothing.
function save(value: string | null = `${shown}px`): void {
  const same = value === saved || (saved === null && value === `${baseline}px`);
  queue = queue
    .then(() => (same ? settle(shown) : write(value)))
    .catch((error: unknown) => {
      message.textContent = `Not saved: ${String(error)}`;
    });
}

function commitField(): void {
  const typed = /^\s*(\d+)\s*(?:px)?\s*$/.exec(field.value)?.[1]; // " 20px " → "20"
  const radius = typed === undefined ? Number.NaN : Number(typed);
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

function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape" && drag !== null) {
    event.preventDefault();
    endDrag(true);
  }
}

// Follows the frame's document across reloads: selection by click, and Escape while it has focus.
function watchFrame(): void {
  const frameDoc = doc();
  if (frameDoc === null) return;
  frameDoc.addEventListener("keydown", onKey);
  frameDoc.addEventListener(
    "pointerdown",
    (event) => {
      // The path, not `instanceof Element`: the frame's nodes belong to the frame's own realm.
      const target = windowElement();
      selected = target !== null && event.composedPath().includes(target);
    },
    true,
  );
}

// ponytail: reads the window's box every frame, so the overlay follows resize, scroll, layout
// and hot reloads alike; switch to observers if it ever shows in a profile.
function track(): void {
  const rect = box();
  overlay.dataset.selected = String(selected && rect.width > 0);
  const target = windowElement();
  const radius = target === null ? 0 : px(style(target).borderTopLeftRadius);
  Object.assign(outline.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: `${radius}px`,
  });
  for (const [i, handle] of handles.entries()) {
    const { x, y } = handlePoint(CORNERS[i] ?? "nw", rect, radius, LEAST_INSET);
    handle.style.translate = `${x}px ${y}px`;
    handle.ariaValueMax = String(maxRadius(rect));
  }
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
      element("h2", {}, "Window"),
      element("div", { className: "row" }, label, field, reset),
      message,
    ),
  ),
);

for (const [i, handle] of handles.entries()) {
  const corner = CORNERS[i] ?? "nw";
  handle.dataset.corner = corner;
  handle.role = "slider";
  handle.ariaValueMin = "0";
  handle.style.cursor = CURSOR[corner];
  draggable(handle, (dx, dy) => handleMoved(corner, dx, dy));
  handle.addEventListener("keydown", (event) => {
    nudge(event, { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 });
    if (event.key === "Enter") save();
  });
  handle.addEventListener("blur", () => {
    save();
  });
}
draggable(label, (dx) => dx);
overlay.addEventListener("pointermove", (event) => {
  // Below right of the pointer, or below left where the canvas would clip it.
  const right = event.clientX + 14 + pill.offsetWidth <= overlay.clientWidth;
  const x = right ? event.clientX + 14 : event.clientX - 14 - pill.offsetWidth;
  pill.style.translate = `${x}px ${event.clientY + 14}px`;
});
field.addEventListener("keydown", (event) => {
  nudge(event, { ArrowUp: 1, ArrowDown: -1 });
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
