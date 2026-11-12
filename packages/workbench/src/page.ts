// The Workbench page: the running app in a frame (the canvas), an overlay of handles over it, and
// the inspector. Clicking in the frame selects an element (ETH-102). Each value has up to three
// inputs (ADR-005): a field, a scrub or arrow keys, and handles on the canvas. A change lives
// inline on its element until the override file has it (ADR-004): the window's corner radius on
// the frame's root, the selection's gap and padding on the selection.
import "./page.css";
import { DRAWER, TREE_EVENT } from "./tree";
import { COLOUR_ROOT, CONTRAST, contrast, HEX } from "./colour";
import { checkProject, surfaceOf } from "./contract";
import {
  COLOUR_ROLES,
  parseTheme,
  themeValues,
  TYPE_ROLES,
  type Theme,
  type ThemeValue,
} from "./theme";
import {
  historyDirection,
  move,
  push,
  readChanges,
  readHistory,
  replaceLook,
  type Change,
  type History,
} from "./history";
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
import { type Bezier, EASE, formatBezier, parseBezier, progressAt } from "./motion";
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
  styled,
  wholeNumber,
  type Styled,
} from "./dom";
import {
  fallbackOf,
  familyOf,
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
import { isSelector, pick } from "./selector";
import {
  boundedOffset,
  dragSpace,
  gapSpaces,
  paddingMoved,
  paddingSides,
  paddingSpace,
  SIDES,
  SIZE,
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
const SIZE_OUT = 12; // a size handle's distance outside its edge, clear of the padding handles
const DRAG_START = 3; // px a press moves before it is a drag rather than a click
const CURSOR: Record<Corner, string> = {
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};
const LABEL: Record<Spacing, string> = {
  width: "Width",
  height: "Height",
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
  reach: string;
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
const treeOutline = element("div", { className: "tree-outline", hidden: true });
let treeHover: Element | null = null;
let component: Styled | null = null;
let componentMode = false;
const requestedComponent = new URL(location.href).searchParams.get("component");
let componentKey =
  requestedComponent !== null && isSelector(requestedComponent) ? requestedComponent : null;
const reachNote = element("p", { className: "mode-note" });
const componentNotice = element("p", {
  className: "component-notice",
  role: "status",
  hidden: true,
});
const handles = CORNERS.map(() =>
  element("div", { className: "handle", tabIndex: 0, ariaLabel: "Corner radius" }),
);
const pill = element("div", { className: "pill", ariaHidden: "true" });
const paddingLayer = element("div");
const gapLayer = element("div");
const sizeLayer = element("div");
const inplace = element("input", { className: "inplace", inputMode: "numeric", hidden: true });
const overlay = element(
  "div",
  { className: "overlay" },
  outline,
  treeOutline,
  paddingLayer,
  gapLayer,
  sizeLayer,
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
const canvasMode = element("select", { id: "theme", ariaLabel: "Canvas mode" });
canvasMode.append(
  element("option", { value: "light" }, "Light"),
  element("option", { value: "dark" }, "Dark"),
);
const modeLabel = element("p", { className: "mode-note" }, "Editing Light mode");
const undo = element(
  "button",
  { type: "button", className: "history-button", disabled: true, title: "Undo (⌘Z / Ctrl+Z)" },
  "Undo",
);
const redo = element(
  "button",
  { type: "button", className: "history-button", disabled: true, title: "Redo (⇧⌘Z / Ctrl+Y)" },
  "Redo",
);
const discard = element(
  "button",
  { type: "button", className: "history-button", disabled: true },
  "Discard",
);
const checkCommit = element(
  "button",
  { type: "button", className: "check-commit", disabled: true },
  "Check and commit",
);
const exportButton = element(
  "button",
  { type: "button", className: "history-button", title: "Download this look as a project file" },
  "Export",
);
const projectFile = element("input", {
  type: "file",
  accept: ".json,application/json",
  hidden: true,
  ariaLabel: "Project file",
});
const openButton = element(
  "button",
  { type: "button", className: "history-button", title: "Check a project file before loading it" },
  "Open",
);
const projectList = element("ul", {
  className: "project-checklist",
  ariaLabel: "Project checklist",
});
const projectVerdict = element("p", { className: "commit-note", role: "status" });
const projectClose = element("button", { type: "button", className: "history-button" }, "Close");
const projectLoad = element(
  "button",
  {
    type: "button",
    className: "check-commit",
    title: "Replace the override values with this file's",
  },
  "Load",
);
const projectDialog = element(
  "dialog",
  { className: "commit-dialog", ariaLabel: "Project file" },
  element("h2", {}, "Project file"),
  projectVerdict,
  projectList,
  element("div", { className: "commit-actions" }, projectClose, projectLoad),
);
const commitStatus = element("pre", { className: "commit-status", role: "status" });
const commitClose = element("button", { type: "button", className: "history-button" }, "Close");
const commitDialog = element(
  "dialog",
  { className: "commit-dialog", ariaLabel: "Check and commit" },
  element("h2", {}, "Check and commit"),
  element(
    "p",
    { className: "commit-note" },
    "Workbench commits overrides.css without pushing. Repository hooks still run and may amend the message or perform other actions, including pushing.",
  ),
  commitStatus,
  element("div", { className: "commit-actions" }, commitClose),
);
let commitController: AbortController | null = null;
const selectorText = element("code", { className: "selector" });
const surfaceSwatch = element("span", { className: "surface-swatch" });
const surfaceLabel = element("span", {});
const surfaceNote = element("p", { className: "surface-note" }, surfaceSwatch, surfaceLabel);
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
let projectLook: { name: string; overrides: Map<string, Map<string, string>> } | null = null;
const HISTORY_KEY = "workbench-history";
const stored = readHistory(sessionStorage.getItem(HISTORY_KEY));
let history: History = stored?.history ?? { steps: [], cursor: 0 };
let head = stored?.head ?? "";
let pendingSaves: {
  node: Styled;
  selector: string;
  name: string;
  value: string | null;
  inline: string;
}[] = [];

function storeHistory(): void {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ head, history }));
  undo.disabled = history.cursor === 0;
  redo.disabled = history.cursor === history.steps.length;
}

const prop = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const entries = (value: unknown): [string, unknown][] =>
  typeof value === "object" && value !== null ? Object.entries(value) : [];
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const appDoc = (): Document | null => frame.contentDocument;
const storyFrame = (): HTMLIFrameElement | null => {
  const d = appDoc();
  if (d?.documentElement?.dataset.wbMode !== "component") return null;
  const nested = d.querySelector("iframe[data-wb-story]:not([inert] *)");
  return nested instanceof (d.defaultView ?? window).HTMLIFrameElement &&
    nested.dataset.wbStory === new URL(location.href).searchParams.get("story")
    ? nested
    : null;
};
const doc = (): Document | null => {
  const current = (storyFrame() ?? frame).contentDocument;
  return current?.documentElement ? current : null;
};
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

const settleRadius = async (inline?: string): Promise<void> => {
  const root = doc()?.documentElement;
  if (root !== undefined) await settle(root, ROOT, NAME, savedRadius(), inline);
};

function show(radius: number): void {
  shown = radius;
  field.value = String(radius);
  pill.textContent = `Radius ${radius}`;
  for (const handle of handles) handle.ariaValueNow = String(radius);
  doc()?.documentElement.style.setProperty(NAME, `${radius}px`);
}

function showMessage(value: string, error = false): void {
  message.textContent = value;
  message.classList.toggle("error", error);
}

function historyStatus(values: unknown): void {
  const nowHead = text(prop(values, "head")) ?? "";
  if (nowHead !== head) history = { steps: [], cursor: 0 };
  head = nowHead;
  discard.disabled = prop(values, "dirty") !== true;
  checkCommit.disabled = discard.disabled;
  storeHistory();
}

function commitEvent(event: unknown): boolean {
  const kind = prop(event, "kind");
  switch (kind) {
    case "checking":
      commitStatus.textContent = `Running ${text(prop(event, "command")) ?? "checks"}…`;
      return false;
    case "committing":
      commitStatus.textContent = "Checks passed. Committing overrides.css…";
      commitClose.disabled = true;
      commitDialog.focus();
      return false;
    case "success":
      commitStatus.textContent = `Committed ${text(prop(event, "hash")) ?? ""}. Workbench did not push.`;
      showMessage(commitStatus.textContent);
      return true;
    case "error":
      commitStatus.textContent = text(prop(event, "message")) ?? "Commit failed.";
      return true;
    case "cancelled":
      commitStatus.textContent = "Cancelled. Nothing was committed.";
      return true;
    default:
      throw new Error("Unrecognized commit progress.");
  }
}

async function readCommitStream(body: NonNullable<Response["body"]>): Promise<void> {
  let buffer = "";
  let finished = false;
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event: unknown = JSON.parse(line);
      finished = commitEvent(event) || finished;
    }
  }
  if (!finished) throw new Error("Connection lost before the commit result arrived.");
}

async function runCommit(): Promise<void> {
  commitClose.textContent = "Close";
  commitClose.disabled = true;
  commitStatus.textContent = "Reading saved values…";
  commitDialog.showModal();
  try {
    const preview = await fetch("/__workbench/commit/preview", { method: "POST" });
    const snapshot: unknown = await preview.json();
    if (!preview.ok)
      throw new Error(text(prop(snapshot, "error")) ?? "Could not read saved values.");
    const revision = text(prop(snapshot, "head"));
    const source = text(prop(snapshot, "source"));
    if (revision === null || source === null) throw new Error("Could not read saved values.");
    const controller = new AbortController();
    commitController = controller;
    commitClose.disabled = false;
    commitClose.textContent = "Cancel checks";
    commitClose.focus();
    const response = await fetch("/__workbench/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ head: revision, source }),
      signal: controller.signal,
    });
    if (!response.ok || response.body === null) {
      const body: unknown = await response.json();
      throw new Error(text(prop(body, "error")) ?? "Could not start checks.");
    }
    await readCommitStream(response.body);
  } catch (error) {
    commitStatus.textContent = `Connection lost. Refresh to check the commit outcome. ${String(error)}`;
  } finally {
    commitController = null;
    commitClose.textContent = "Close";
    commitClose.disabled = false;
    commitClose.focus();
    await refreshStatus();
  }
}

async function cancelCommit(): Promise<void> {
  if (commitClose.disabled) return;
  try {
    const response = await fetch("/__workbench/commit/cancel", { method: "POST" });
    if (!response.ok) throw new Error("Cancellation was refused.");
  } catch (error) {
    commitStatus.textContent = `Could not cancel checks. ${String(error)}`;
  }
}

async function refreshStatus(): Promise<void> {
  const values: unknown = await (await fetch(ENDPOINT)).json();
  historyStatus(values);
}

async function load(): Promise<void> {
  const values: unknown = await (await fetch(ENDPOINT)).json();
  historyStatus(values);
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
  rootBaseline = new Map(
    entries(prop(values, "tokens")).flatMap(([n, t]): [string, string][] => {
      const base = text(prop(t, "baseline"));
      return base === null ? [] : [[n, base]];
    }),
  );
  colourBaseline = new Map(
    entries(prop(values, "colours")).map(([name, t]): [string, { light: string; dark: string }] => [
      name,
      { light: text(prop(t, "light")) ?? "", dark: text(prop(t, "dark")) ?? "" },
    ]),
  );
  buildColours(prop(values, "colours"));
  reset.disabled = savedRadius() === null;
  show(onDisk());
  await settleRadius();
  showActiveTheme();
}

function record(selector: string, name: string, value: string | null): void {
  const block = files.get(selector) ?? new Map<string, string>();
  if (value === null) block.delete(name);
  else block.set(name, value);
  files.set(selector, block);
}

// Writes one value, or removes it when `value` is null. True when the file now has it.
function write(selector: string, name: string, value: string | null): Promise<boolean> {
  return writeChanges([{ selector, name, before: was(selector, name), after: value }]);
}

async function writeChanges(changes: Change[], replaying = false): Promise<boolean> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      head,
      changes: changes.map((c) => ({
        selector: c.selector,
        name: c.name,
        value: c.after,
        was: c.before,
        at: c.at,
      })),
    }),
  });
  if (response.status === 409) {
    showMessage("The override file changed on disk, so this was not saved. Showing it.", true);
    await load();
    return false;
  }
  if (!response.ok) {
    const body: unknown = await response.json();
    showMessage(`Not saved: ${text(prop(body, "error")) ?? response.statusText}`, true);
    return false;
  }
  for (const c of changes) record(c.selector, c.name, c.after);
  showActiveTheme();
  const body: unknown = await response.json();
  const saved = readChanges(prop(body, "changes"));
  if (!replaying && saved !== null) history = push(history, saved);
  historyStatus(body);
  showMessage("");
  return true;
}

// Runs `task` after every earlier write: one write at a time (ADR-004).
function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch((error: unknown) => {
    showMessage(`Not saved: ${String(error)}`, true);
  });
}

// Saves `selector`'s `name` from `node`'s inline value, or removes it when `value` is null, then
// drops the inline value once the file applies.
function saveValue(node: Styled, selector: string, name: string, value: string | null): void {
  pendingSaves.push({ node, selector, name, value, inline: node.style.getPropertyValue(name) });
  if (pendingSaves.length !== 1) return;
  queueMicrotask(() => {
    const saves = pendingSaves;
    pendingSaves = [];
    enqueue(async () => {
      const changes = saves.map((s) => ({
        selector: s.selector,
        name: s.name,
        before: was(s.selector, s.name),
        after: s.value,
      }));
      const accepted = await writeChanges(changes);
      for (const s of saves) {
        if (accepted) void settle(s.node, s.selector, s.name, s.value, s.inline);
        else if (s.node.style.getPropertyValue(s.name) === s.inline)
          s.node.style.removeProperty(s.name);
      }
    });
  });
}

function settleChanges(changes: { selector: string; name: string; after: string | null }[]): void {
  for (const c of changes) {
    for (const node of doc()?.querySelectorAll(c.selector) ?? []) {
      if (styled(node)) void settle(node, c.selector, c.name, c.after);
    }
  }
}

function replay(direction: -1 | 1): void {
  enqueue(async () => {
    const step = history.steps[direction === -1 ? history.cursor - 1 : history.cursor];
    if (step === undefined) return;
    const changes =
      direction === 1
        ? step
        : step.toReversed().map((c) => ({ ...c, before: c.after, after: c.before }));
    if (!(await writeChanges(changes, true))) return;
    settleChanges(changes);
    history = move(history, direction);
    storeHistory();
    await load();
  });
}

function historyKey(event: KeyboardEvent): boolean {
  const direction = historyDirection(event);
  if (direction === null) return false;
  const target = event.target;
  const view = doc()?.defaultView ?? window;
  if (
    (target instanceof Element || target instanceof view.Element) &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")
  )
    return false;
  event.preventDefault();
  replay(direction);
  return true;
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
  const inline = doc()?.documentElement.style.getPropertyValue(NAME);
  enqueue(async () => {
    if (!same && !(await write(ROOT, NAME, value))) return;
    reset.disabled = savedRadius() === null;
    void settleRadius(inline);
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
  return `${bar.side === null ? LABEL[bar.name] : "Padding"} ${value}`;
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
    setSpacing(bar.name, dragSpace(before[bar.name], bar.axis === "x" ? dx : dy, step));
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
  const aria = side === null ? LABEL[name] : `Padding ${side}`;
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
const sizeBars = SIZE.map((name) => makeBar(name, null, name === "width" ? "x" : "y"));

function componentAvailable(): boolean {
  return component !== null && component.closest("[inert], [hidden]") === null;
}

function selectable(node: Styled): boolean {
  if (storyFrame() !== null) return node.closest("[data-wb]") !== null;
  if (!componentMode || componentKey === null) return true;
  return componentAvailable() && component?.contains(node) === true;
}

function componentRoot(node: Styled): boolean {
  return (
    componentMode && (node === component || (storyFrame() !== null && node.matches("[data-wb]")))
  );
}

function selectionOf(node: Styled): Selection {
  const componentName = node.closest("[data-wb]")?.getAttribute("data-wb");
  return {
    node,
    selector: selectorOf(node, componentMode ? "component" : "live"),
    reach:
      componentMode && componentName ? `Every instance of ${componentName}` : "This one element",
    locked: new Set(
      [...SPACING, ...TYPE].filter(
        (name) =>
          node.style.getPropertyValue(name) !== "" ||
          (componentRoot(node) && name === "margin-bottom"),
      ),
    ),
    nudgeLocked: hasNativeTransform(node) || componentRoot(node),
  };
}

function select(node: Styled | null): void {
  if (node !== null && !selectable(node)) return;
  endOffset();
  commit();
  TYPE.forEach(commitType);
  if (stepList.matches(":popover-open")) stepList.hidePopover();
  endFonts();
  [fontPicker, basics].forEach((popover) => {
    if (popover.matches(":popover-open")) popover.hidePopover();
  });
  closeInplace(false);
  selection = node === null ? null : selectionOf(node);
  selectorText.textContent = selection?.selector ?? "";
  reachNote.textContent = selection?.reach ?? "";
  doc()?.dispatchEvent(new CustomEvent(TREE_EVENT.selected, { detail: node }));
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
    select(componentChain(selection.node).at(-2) ?? null);
  }
}

// A key goes to the chat first, then to the page's own handling.
const keyDown = (event: KeyboardEvent): void => {
  if (commitDialog.open) return;
  if (historyKey(event) || drawerEvent(event)) return;
  if (!chatKey(event)) onKey(event);
};

const block = (event: Event): void => {
  if (drawerEvent(event)) return;
  if (!selecting && !referencing()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

function cancelBody(): void {
  if (bodyPress !== null) endOffset(true);
}

// Drawer controls belong to the app even while canvas clicks belong to the select tool.
function drawerEvent(event: Event): boolean {
  const target = event.target;
  return (
    target instanceof (appDoc()?.defaultView ?? window).Element &&
    target.closest(
      `${DRAWER}, [data-slot="title-bar"], [data-slot="sidebar-trigger"], [data-slot="sidebar-push-scrim"], [data-slot="sidebar-hot-zone"]`,
    ) !== null
  );
}

// A press within the selection starts its offset drag rather than selecting beneath it.
function pressSelection(event: PointerEvent, under: Element | null): boolean {
  if (selection === null) return false;
  if (!inside({ x: event.clientX, y: event.clientY }, selection.node.getBoundingClientRect()))
    return false;
  if (beginOffset() === null) return false;
  selection.node.setPointerCapture(event.pointerId);
  bodyPress = {
    x: event.clientX,
    y: event.clientY,
    id: event.pointerId,
    under,
    moved: false,
  };
  return true;
}

// Records the component `node` belongs to as the open one. Entering Component mode centres it;
// in Live mode it stays put unless it is off screen, ready for Component mode to focus later.
function openComponent(node: Styled, enter: boolean): void {
  const root = node.closest("[data-wb]");
  if (root === null || !styled(root)) {
    select(node);
    return;
  }
  const url = new URL(location.href);
  url.searchParams.delete("story");
  componentKey = selectorOf(root);
  url.searchParams.set("component", componentKey);
  const path = frame.contentWindow?.location;
  if (path !== undefined) url.searchParams.set("path", path.pathname + path.search);
  const view =
    root.closest('[aria-label="Component mode"]') !== null
      ? "preview"
      : root.closest("[data-wb-live-thread]") !== null
        ? "thread"
        : "live";
  url.searchParams.set("component-view", view);
  window.history.replaceState(null, "", url);
  component = root;
  if (enter) componentMode = true;
  doc()?.dispatchEvent(new Event(TREE_EVENT.focus));
  root.scrollIntoView({
    block: enter ? "center" : "nearest",
    inline: "nearest",
    behavior: "instant",
  });
  select(root);
}

function componentChain(node: Element | null): Styled[] {
  const story = storyFrame() !== null;
  const nodes = chain(node, story);
  if (story) {
    const at = nodes.findIndex((candidate) => candidate.matches("[data-wb]"));
    return at < 0 ? [] : nodes.slice(at);
  }
  if (!componentMode || componentKey === null) return nodes;
  const at = component === null ? -1 : nodes.indexOf(component);
  return at < 0 ? [] : nodes.slice(at);
}

// Follows the frame's document across reloads: selection by click, and keys while it has focus.
const watchedDocuments = new WeakSet<Document>();
function watchFrame(from = frame): void {
  const view = from.contentWindow;
  if (view === null || watchedDocuments.has(view.document)) return;
  watchedDocuments.add(view.document);
  treeHover = null;
  select(null);
  view.document.addEventListener(TREE_EVENT.select, (event) => {
    if (!("detail" in event)) return;
    const node = event.detail;
    if (
      node instanceof (view.document.defaultView ?? window).Element &&
      node.isConnected &&
      styled(node)
    ) {
      // The app's mode now, not as the last frame saw it, so a row pressed straight after a mode
      // switch follows that switch.
      openComponent(node, appDoc()?.documentElement.dataset.wbMode === "component");
    }
  });
  view.document.addEventListener(TREE_EVENT.hover, (event) => {
    if (!("detail" in event)) return;
    treeHover =
      event.detail instanceof (view.document.defaultView ?? window).Element ? event.detail : null;
  });
  view.document.addEventListener(TREE_EVENT.story, (event) => {
    if (
      from !== frame ||
      !("detail" in event) ||
      typeof event.detail !== "string" ||
      !/^[a-z0-9][a-z0-9-]*$/.test(event.detail)
    )
      return;
    select(null);
    component = null;
    componentKey = null;
    const url = new URL(location.href);
    url.searchParams.set("story", event.detail);
    url.searchParams.set("path", view.location.pathname + view.location.search);
    url.searchParams.delete("component");
    url.searchParams.delete("component-view");
    window.history.replaceState(null, "", url);
    view.document.dispatchEvent(new Event(TREE_EVENT.focus));
  });
  view.addEventListener(
    "pointerdown",
    (event) => {
      if (from.contentDocument !== doc() || drawerEvent(event)) return;
      if (!selecting || event.button !== 0 || bodyPress !== null) return;
      view.focus();
      const under = view.document.elementFromPoint(event.clientX, event.clientY);
      if (pressSelection(event, under)) return;
      select(pick(componentChain(under), componentChain(selection?.node ?? null)));
    },
    true,
  );
  view.addEventListener("pointermove", (event) => {
    if (from.contentDocument !== doc()) return;
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
      if (!moved) select(pick(componentChain(under), componentChain(selection?.node ?? null)));
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

// Width and height handles sit just outside the right and bottom edges, in Live mode only.
function trackSizeBars(node: Styled, rect: Box): void {
  const off = componentMode || style(node).display === "inline";
  const at = {
    x: [rect.left + rect.width + SIZE_OUT, rect.top + rect.height / 2],
    y: [rect.left + rect.width / 2, rect.top + rect.height + SIZE_OUT],
  } as const;
  const v = spacingOf(node);
  for (const bar of sizeBars) {
    placeBar(bar, ...at[bar.axis], rect, v[bar.name]);
    bar.el.hidden = off || selection?.locked.has(bar.name) === true;
  }
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
    if (bar.el.matches(":hover, [data-dragging]")) {
      const x = Math.max(
        4,
        Math.min(
          left + width / 2 - pill.offsetWidth / 2,
          overlay.clientWidth - pill.offsetWidth - 4,
        ),
      );
      const above = top + height / 2 - 14 - pill.offsetHeight;
      const y = Math.max(
        4,
        Math.min(
          above >= 4 ? above : top + height / 2 + 14,
          overlay.clientHeight - pill.offsetHeight - 4,
        ),
      );
      pill.style.translate = `${x}px ${y}px`;
    }
  }
}

// ponytail: reads the selection's box every frame, so the overlay follows resize, scroll, layout
// and hot reloads alike; switch to observers if it ever shows in a profile.
function trackSelection(): void {
  treeOutline.hidden = treeHover === null || !treeHover.isConnected;
  if (!treeOutline.hidden && treeHover !== null)
    place(treeOutline, treeHover.getBoundingClientRect());
  if (selection !== null && !selection.node.isConnected) select(null);
  const node = selection?.node;
  overlay.dataset.selected = String(node !== undefined);
  overlay.dataset.window = String(node !== undefined && node === windowElement());
  if (node === undefined) return;
  const rect = node.getBoundingClientRect();
  const s = style(node);
  place(outline, rect);
  outline.style.borderRadius = s.borderTopLeftRadius;
  const reach = {
    left: rect.left,
    top: rect.top,
    width: rect.width + 2 * SIZE_OUT,
    height: rect.height + 2 * SIZE_OUT,
  };
  overlay.dataset.hover = String(inside(pointer, reach)); // reaches the size handles outside
  trackGaps(node, trackPadding(node, rect, s));
  trackSizeBars(node, rect);
}

// Fade in the frame's own coordinates, leaving the drawer as an independent opaque layer.
// No animation: reduced-motion users get the same immediate, interruptible view.
const fade = (axis: string, start: number, end: number): string =>
  `linear-gradient(to ${axis}, transparent ${start - 48}px, black ${start}px, black ${end}px, transparent ${end + 48}px)`;

function maskComponent(d: Document, root: Styled): void {
  const r = root.getBoundingClientRect();
  const chrome = [d.querySelector("#sidebar"), d.querySelector('[data-slot="title-bar"]')].map(
    (node) => node?.getBoundingClientRect() ?? new DOMRect(),
  );
  frame.style.maskImage = `linear-gradient(black, black), linear-gradient(black, black), ${fade("right", r.left, r.right)}, ${fade("bottom", r.top, r.bottom)}`;
  frame.style.maskSize = [
    ...chrome.map((rect) => `${rect.width}px ${rect.height}px`),
    "100% 100%",
    "100% 100%",
  ].join(", ");
  frame.style.maskPosition = [
    ...chrome.map((rect) => `${rect.left}px ${rect.top}px`),
    "0 0",
    "0 0",
  ].join(", ");
  frame.style.maskRepeat = "no-repeat";
  frame.style.maskComposite = "add, add, intersect";
}

function restoreComponent(d: Document): void {
  if (component?.isConnected || componentKey === null) return;
  if (new URL(location.href).searchParams.get("path") !== d.location.pathname + d.location.search)
    return;
  const found = d.querySelector(componentKey);
  component = found !== null && styled(found) ? found : null;
  if (component !== null && componentMode) {
    component.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    select(component);
  }
}

function showComponent(d: Document): void {
  const focused = componentMode && componentKey !== null;
  const unavailable = focused && !componentAvailable();
  if (unavailable && selection !== null) select(null);
  componentNotice.hidden = !unavailable;
  componentNotice.textContent =
    "The open component is no longer on this page. Open another from the drawer.";
  handles.forEach((handle) => {
    handle.style.display = focused ? "none" : "";
  });
  frame.style.maskImage = "";
  if (focused && componentAvailable() && component !== null) maskComponent(d, component);
}

let activeDocument: Document | null = null;
function trackCanvas(d: Document): void {
  const nested = storyFrame();
  if (activeDocument !== d) {
    select(null);
    treeHover = null;
    activeDocument = d;
    const view = (nested ?? frame).contentWindow;
    if (view !== null) watchReference(view, nested ?? frame);
    watchFrame(nested ?? frame);
  }
  if (nested !== null) {
    place(overlay, nested.getBoundingClientRect());
    const theme = appDoc()?.documentElement.dataset.theme;
    if (theme !== undefined && d.documentElement.dataset.theme !== theme)
      d.documentElement.dataset.theme = theme;
  } else {
    overlay.style.left = "";
    overlay.style.top = "";
    overlay.style.width = "";
    overlay.style.height = "";
  }
}

function trackComponent(): void {
  const d = doc();
  if (d === null) return;
  trackCanvas(d);
  const mode = appDoc()?.documentElement.dataset.wbMode === "component";
  if (componentMode !== mode) {
    componentMode = mode;
    const node = selection?.node ?? null;
    select(node !== null && !selectable(node) ? null : node);
  }
  if (storyFrame() === null) restoreComponent(d);
  showComponent(d);
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
  showMessage(`Copying ${font.family} into the repo…`);
  const response = await fetch(FONTS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: font.id }),
  });
  if (response.ok) {
    showMessage("");
    return true;
  }
  const body: unknown = await response.json();
  showMessage(`Not saved: ${text(prop(body, "error")) ?? response.statusText}`, true);
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
  const gone = element(
    "span",
    { className: "font-missing", role: "img", hidden: true },
    icon(ICONS.warning),
  );
  const open = fontOpener(
    (anchor) => {
      const root = doc()?.documentElement;
      return root === undefined ? null : { node: root, selector: ROOT, name, anchor };
    },
    value,
    gone,
  );
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
  return { name, value, gone, open, clear, row };
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
    const gone = missing(root.ownerDocument, family);
    r.gone.hidden = !gone;
    r.gone.title = gone ? `${family} is not in the repo or installed on this computer` : "";
    r.gone.ariaLabel = r.gone.title;
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
const MOTION = "--motion-hover"; // the one shared duration so far (R17)
// A `:root` value edited as a number: the type scale's three, and the motion duration.
type RootName = ScaleName | typeof MOTION;
const SCALE_SPECS: Record<RootName, ScaleSpec> = {
  [MOTION]: {
    title: "Hover time",
    step: 10,
    dragPx: 2,
    min: 0,
    max: 2000,
    places: 0,
    unit: "ms",
  },
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

const scaleEdits = new Map<RootName, string>(); // each value in hand's value before the change
let scaleDrag: { name: RootName; scrub: HTMLElement; from: number; x: number } | null = null;

// A value the endpoint takes: the base floored to even, the others to their decimals, in bounds.
function scaleText(name: RootName, n: number): string {
  const { min, max, places, unit } = SCALE_SPECS[name];
  const fitted = name === "--type-base" ? Math.floor(n / 2) * 2 : Number(n.toFixed(places));
  return `${Math.min(Math.max(fitted, min), max)}${unit}`;
}
const scaleNow = (name: RootName): number => {
  const root = doc()?.documentElement;
  return root === undefined ? Number.NaN : Number.parseFloat(style(root).getPropertyValue(name));
};
// One arrow press from `n`: the ratio moves between the named ratios, the others by their step.
function scaleStep(name: RootName, n: number, sign: 1 | -1): number {
  if (name !== "--type-ratio") return n + sign * SCALE_SPECS[name].step;
  const named =
    sign === 1 ? RATIOS.find((r) => r > n + 1e-9) : RATIOS.findLast((r) => r < n - 1e-9);
  return named ?? n;
}

function previewScale(name: RootName, n: number): void {
  const root = doc()?.documentElement;
  if (root === undefined || !Number.isFinite(n)) return;
  if (!scaleEdits.has(name)) scaleEdits.set(name, style(root).getPropertyValue(name).trim());
  root.style.setProperty(name, scaleText(name, n));
}
// Saves the value in hand, or drops it when it changes nothing.
function commitScale(name: RootName): void {
  const root = doc()?.documentElement;
  const before = scaleEdits.get(name);
  scaleEdits.delete(name);
  if (root === undefined || before === undefined) return;
  const value = root.style.getPropertyValue(name);
  if (value === before) root.style.removeProperty(name);
  else saveValue(root, ROOT, name, value);
}
// Puts back the value in hand, unsaved, and ends a scrub of it, so its release saves nothing.
function revertScale(name: RootName): void {
  if (scaleDrag?.name === name) {
    delete scaleDrag.scrub.dataset.dragging;
    scaleDrag = null;
  }
  if (scaleEdits.delete(name)) doc()?.documentElement.style.removeProperty(name);
}
// A typed value as the endpoint saves it, or null: the whole text must be a plain decimal, the
// base is floored to even, and the value must pass the endpoint's own check.
function typedScale(name: RootName, raw: string): string | null {
  if (!/^\d*\.?\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  if (name === MOTION) return Number.isInteger(n) && n <= 2000 ? `${n}ms` : null;
  const value = name === "--type-base" ? `${Math.floor(n / 2) * 2}px` : String(n);
  return scaleValue(name, value) ? value : null;
}

const ratioList = element(
  "datalist",
  { id: "wb-ratios" },
  ...RATIOS.map((r) => element("option", { value: String(r) })),
);
// A drag on a value's label scrubs it one step per `dragPx` px, live, and saves on release.
function scrubScale(scrub: HTMLLabelElement, name: RootName): void {
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

// A `:root` number field: type it, step it with the arrows, scrub its label, Escape or Reset it.
function rootField(name: RootName) {
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
      if (typed === null) showMessage(`Not a ${title.toLowerCase()}: ${input.value}`, true);
      else {
        showMessage("");
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
}
const scaleFields = SCALE.map(rootField);
const motionField = rootField(MOTION);

// The hover easing's curve editor (ETH-140), in bklit's look (PRD section 9): a dark plot of
// time against progress, a crosshair with a blurred readout, and two control points to drag.
const SVG = "http://www.w3.org/2000/svg";
const PLOT_W = 200; // time 0..1 across
const PLOT_H = 100; // progress 0..1 up
const PLOT_PAD = 60; // room above and below: progress -0.6..1.6, every curve the endpoint takes
const STEP_EASE = 0.01; // an arrow press; 0.1 with Shift
function svgOf(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
const plotX = (t: number): number => t * PLOT_W;
const plotY = (p: number): number => PLOT_PAD + (1 - p) * PLOT_H;
const curveLine = svgOf("path", { class: "curve-line" });
const curveArms = [0, 1].map(() => svgOf("line", { class: "curve-arm" }));
const crossTime = svgOf("line", { class: "cross" });
const crossProgress = svgOf("line", { class: "cross" });
const curvePoints = (["First", "Second"] as const).map((which) =>
  svgOf("circle", {
    class: "curve-point",
    r: "6",
    tabindex: "0",
    role: "slider",
    "aria-label": `${which} control point`,
  }),
);
const curveSvg = svgOf("svg", {
  class: "curve",
  viewBox: `-8 0 ${PLOT_W + 16} ${PLOT_H + 2 * PLOT_PAD}`,
  "aria-label": "Hover easing curve",
});
curveSvg.append(
  ...[0, 0.25, 0.5, 0.75, 1].map((t) =>
    svgOf("line", {
      class: "grid",
      x1: `${plotX(t)}`,
      x2: `${plotX(t)}`,
      y1: "0",
      y2: `${PLOT_H + 2 * PLOT_PAD}`,
    }),
  ),
  ...[0, 1].map((p) =>
    svgOf("line", {
      class: "grid",
      x1: "0",
      x2: `${PLOT_W}`,
      y1: `${plotY(p)}`,
      y2: `${plotY(p)}`,
    }),
  ),
  crossTime,
  crossProgress,
  ...curveArms,
  curveLine,
  ...curvePoints,
);
const curveTip = element("div", { className: "curve-tip", hidden: true });
const easeInput = element("input", {
  id: "wb-motion-hover-ease",
  autocomplete: "off",
  placeholder: "x1, y1, x2, y2",
});
// A curve as its field shows it: the four numbers, without the cubic-bezier() around them.
const easeText = (curve: Bezier): string => formatBezier(curve).slice("cubic-bezier(".length, -1);
easeInput.spellcheck = false;
const easeReset = element(
  "button",
  { type: "button", className: "reset", ariaLabel: "Reset hover easing" },
  "Reset",
);
let easeBefore: string | null = null; // the saved curve while one is in hand
let easeDrag: number | null = null; // the control point being dragged
let crossAt: number | null = null; // the crosshair's time while the pointer is on the plot

const easeNow = (): Bezier =>
  parseBezier(style(doc()?.documentElement ?? document.documentElement).getPropertyValue(EASE)) ?? [
    0.25, 0.1, 0.25, 1,
  ];

function drawCurve(curve: Bezier): void {
  const [x1, y1, x2, y2] = curve;
  if (crossAt !== null) placeCross(curve, crossAt); // keeps the readout on the curve shown
  const [ax, ay, bx, by] = [plotX(x1), plotY(y1), plotX(x2), plotY(y2)];
  curveLine.setAttribute("d", `M0,${plotY(0)} C${ax},${ay} ${bx},${by} ${PLOT_W},${plotY(1)}`);
  const ends = [
    [0, plotY(0), ax, ay],
    [PLOT_W, plotY(1), bx, by],
  ];
  for (const [i, arm] of curveArms.entries()) {
    const [ex1, ey1, ex2, ey2] = ends[i] ?? [0, 0, 0, 0];
    arm.setAttribute("x1", `${ex1}`);
    arm.setAttribute("y1", `${ey1}`);
    arm.setAttribute("x2", `${ex2}`);
    arm.setAttribute("y2", `${ey2}`);
  }
  for (const [i, point] of curvePoints.entries()) {
    point.setAttribute("cx", `${i === 0 ? ax : bx}`);
    point.setAttribute("cy", `${i === 0 ? ay : by}`);
  }
}

// Shows `curve` on the frame's root, unsaved, remembering the saved value to commit against.
function previewEase(curve: Bezier): void {
  const root = doc()?.documentElement;
  if (root === undefined) return;
  easeBefore ??= style(root).getPropertyValue(EASE).trim();
  root.style.setProperty(EASE, formatBezier(curve));
  drawCurve(curve);
}
function commitEase(): void {
  const root = doc()?.documentElement;
  const before = easeBefore;
  easeBefore = null;
  easeDrag = null;
  if (root === undefined || before === null) return;
  const value = root.style.getPropertyValue(EASE);
  if (value === before) root.style.removeProperty(EASE);
  else saveValue(root, ROOT, EASE, value);
}
function revertEase(): void {
  easeDrag = null;
  if (easeBefore === null) return;
  easeBefore = null;
  doc()?.documentElement.style.removeProperty(EASE);
}

// The plot coordinates under a pointer, as time and progress.
function plotAt(event: PointerEvent): [number, number] {
  const plot = curveSvg.getBoundingClientRect();
  const scale = (PLOT_W + 16) / plot.width;
  const x = (event.clientX - plot.left) * scale - 8;
  const y = (event.clientY - plot.top) * scale;
  return [x / PLOT_W, 1 - (y - PLOT_PAD) / PLOT_H];
}

function setLine(line: SVGElement, x1: number, y1: number, x2: number, y2: number): void {
  for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) line.setAttribute(k, `${v}`);
}

// The crosshair at `time` on `curve`, with the progress there in the readout.
function placeCross(curve: Bezier, time: number): void {
  const progress = progressAt(curve, time);
  setLine(crossTime, plotX(time), 0, plotX(time), PLOT_H + 2 * PLOT_PAD);
  setLine(crossProgress, 0, plotY(progress), PLOT_W, plotY(progress));
  curveTip.textContent = `${Math.round(time * 100)}% time · ${Math.round(progress * 100)}% done`;
}

// Moves the crosshair to the pointer's time and shows the curve's progress there.
function showCross(event: PointerEvent): void {
  crossAt = Math.min(Math.max(plotAt(event)[0], 0), 1);
  placeCross(easeNow(), crossAt);
  const plot = curveSvg.getBoundingClientRect();
  curveTip.style.translate = `${event.clientX - plot.left + 12}px ${event.clientY - plot.top + 12}px`;
  curveTip.hidden = false;
}

// `curve` with control point `i` (0 or 1) moved to x, y, kept to what CSS and the endpoint take.
function setPoint(curve: Bezier, i: number, x: number, y: number): Bezier {
  const [x1, y1, x2, y2] = curve;
  const next: Bezier = i === 0 ? [x, y, x2, y2] : [x1, y1, x, y];
  return parseBezier(formatBezier(next)) ?? curve;
}

const EASE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};
// Moves control point `i` one arrow press: 0.01, or 0.1 with Shift.
function stepEase(i: number, event: KeyboardEvent): void {
  const dir = EASE_KEYS[event.key];
  if (dir === undefined) return;
  event.preventDefault();
  const step = event.shiftKey ? STEP_EASE * 10 : STEP_EASE;
  const curve = easeNow();
  const [x, y] = i === 0 ? [curve[0], curve[1]] : [curve[2], curve[3]];
  previewEase(setPoint(curve, i, x + dir[0] * step, y + dir[1] * step));
}

for (const [i, point] of curvePoints.entries()) {
  point.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    point.setPointerCapture(event.pointerId);
    easeDrag = i;
  });
  point.addEventListener("pointermove", (event) => {
    if (easeDrag === i) previewEase(setPoint(easeNow(), i, ...plotAt(event)));
  });
  point.addEventListener("pointerup", () => {
    if (easeDrag === i) commitEase();
  });
  point.addEventListener("pointercancel", revertEase);
  point.addEventListener("keydown", (event) => {
    stepEase(i, event);
    if (event.key === "Enter") commitEase();
    if (event.key !== "Escape") return;
    event.stopPropagation();
    revertEase();
  });
  point.addEventListener("blur", commitEase);
}
curveSvg.addEventListener("pointermove", showCross);
curveSvg.addEventListener("pointerleave", () => {
  crossAt = null;
  curveTip.hidden = true;
});
easeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") easeInput.blur();
  if (event.key === "Escape") {
    event.stopPropagation();
    easeInput.value = easeText(easeNow());
    easeInput.blur();
  }
});
easeInput.addEventListener("change", () => {
  const raw = easeInput.value.trim();
  const typed = parseBezier(raw.startsWith("cubic-bezier") ? raw : `cubic-bezier(${raw})`);
  if (typed === null) {
    showMessage(`Not a curve: ${raw}. Type four numbers: x1, y1, x2, y2.`, true);
    return;
  }
  showMessage("");
  previewEase(typed);
  commitEase();
});
easeReset.addEventListener("click", () => {
  revertEase();
  const root = doc()?.documentElement;
  if (root !== undefined && was(ROOT, EASE) !== null) saveValue(root, ROOT, EASE, null);
});
const easeEditor = element(
  "div",
  { className: "ease" },
  element("div", { className: "curve-box" }, curveSvg, curveTip),
  element(
    "div",
    { className: "row" },
    element("label", { htmlFor: easeInput.id }, "Hover easing"),
    easeInput,
    easeReset,
  ),
);

// The hover scrub (ETH-141): every control in the canvas with a hover preview state is put in
// it, and the transitions that start are paused at the slider's place along the shared hover.
const motionScrub = element("input", {
  id: "wb-motion-scrub",
  type: "range",
  min: "0",
  max: "100",
  value: "0",
});
const scrubAt = element("output", {}, "0%");
let scrubbed: [Element, string | null][] = []; // each control held in hover, and its own preview

function scrubTo(percent: number): void {
  const d = doc();
  if (d === null) return;
  if (scrubbed.length === 0) {
    scrubbed = [...d.querySelectorAll(".btn, .field")].map((el) => [
      el,
      el.getAttribute("data-preview"),
    ]);
    for (const [el] of scrubbed) el.setAttribute("data-preview", "hover");
  }
  for (const [el] of scrubbed) {
    for (const a of el.getAnimations()) {
      a.pause();
      a.currentTime = (Number(a.effect?.getComputedTiming().duration) || 0) * (percent / 100);
    }
  }
  scrubAt.textContent = `${percent}%`;
}
// Lets every scrubbed control go back to rest, through its own transition, and the slider to 0.
function endHoverScrub(): void {
  for (const [el, own] of scrubbed) {
    if (own === null) el.removeAttribute("data-preview");
    else el.setAttribute("data-preview", own);
  }
  scrubbed = [];
  motionScrub.value = "0";
  scrubAt.textContent = "0%";
}
motionScrub.addEventListener("input", () => {
  scrubTo(Number(motionScrub.value));
});
motionScrub.addEventListener("pointerup", endHoverScrub);
motionScrub.addEventListener("blur", endHoverScrub);
motionScrub.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.stopPropagation();
  endHoverScrub();
});
const scrubRow = element(
  "div",
  { className: "row scrub-row" },
  element("label", { htmlFor: motionScrub.id }, "Scrub hover"),
  motionScrub,
  scrubAt,
);

// Keeps the curve and its field on the frame's value, except while one is in hand.
function trackEase(): void {
  if (easeBefore !== null || easeDrag !== null) return;
  const curve = easeNow();
  drawCurve(curve);
  if (document.activeElement !== easeInput) easeInput.value = easeText(curve);
  easeReset.disabled = was(ROOT, EASE) === null;
}

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

type ThemeKind = "colours" | "type";
// One section's theme controls (ADR-028): a theme of colour roles in Colours, a pairing of type
// roles in Type. Both apply, show and remove the same way.
function themeKit(kind: ThemeKind, id: string, noun: string) {
  const picker = element("select", { id: `${id}-file`, ariaLabel: `Apply a ${noun}` });
  const remove = element(
    "button",
    {
      type: "button",
      className: "history-button",
      disabled: true,
      title: `Remove the ${noun}'s values`,
    },
    "Remove",
  );
  const name = element("input", {
    id: `${id}-name`,
    ariaLabel: `New ${noun} name`,
    placeholder: `new-${noun}-name`,
    required: true,
    pattern: "[a-z0-9][a-z0-9\\-]{0,47}",
    title: "Lowercase letters, digits and hyphens",
    autocomplete: "off",
    spellcheck: false,
  });
  const form = element(
    "form",
    { className: "theme-save", ariaLabel: `Save the ${kind} as a ${noun}` },
    name,
    element("button", { type: "submit", className: "history-button" }, "Save"),
  );
  const row = element("div", { className: "mode-row theme-row" }, picker, remove);
  return { kind, noun, picker, remove, name, form, row };
}
const colourKit = themeKit("colours", "theme", "theme");
const typeKit = themeKit("type", "pairing", "pairing");
const kits = [colourKit, typeKit];

const scalePanel = element(
  "details",
  { ariaLabel: "Type", className: "scale", open: true },
  element("summary", {}, element("h2", {}, "Type")),
  typeKit.row,
  typeKit.form,
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
  for (const { name, input, clear } of [...scaleFields, motionField]) {
    const n = Number.parseFloat(s.getPropertyValue(name)); // 0ms is a real duration
    const value = Number.isNaN(n) ? "" : String(n);
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

// The shell's side (ETH-142, ADR-041): where the rail and its drawer sit, left or right only.
const SIDE = "--shell-side";
function pickSide(value: string): void {
  const root = doc()?.documentElement;
  if (root === undefined || style(root).getPropertyValue(SIDE).trim() === value) return;
  root.style.setProperty(SIDE, value);
  saveValue(root, ROOT, SIDE, value);
}
const shellSide = segmented(
  "Shell side",
  {
    left: ["Rail on the left", element("span", {}, "Left")],
    right: ["Rail on the right", element("span", {}, "Right")],
  },
  pickSide,
  () => {
    const root = doc()?.documentElement;
    if (root !== undefined && was(ROOT, SIDE) !== null) saveValue(root, ROOT, SIDE, null);
  },
);
function trackSide(): void {
  const root = doc()?.documentElement;
  if (root === undefined) return;
  const side = style(root).getPropertyValue(SIDE).trim() || "left";
  for (const b of shellSide.buttons) b.ariaPressed = String(b.dataset.value === side);
  shellSide.clear.disabled = was(ROOT, SIDE) === null;
}

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
  "details",
  { ariaLabel: "Typography", className: "type", open: true },
  element("summary", { className: "type-head" }, element("h2", {}, "Typography"), basicsOpen),
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
  "details",
  { ariaLabel: "Selection", open: true },
  element("summary", {}, element("h2", {}, "Selection")),
  selectorText,
  surfaceNote,
  reachNote,
  ...rows.map((r) => r.row),
  note,
  ...offsetRows.map((r) => r.row),
  offsetNote,
);
const unmatchedPanel = element(
  "details",
  { ariaLabel: "Saved values that match nothing", open: true },
  element("summary", {}, element("h2", {}, "Saved, matching nothing")),
  unmatchedList,
);

// Names the contract surface the selection draws and that surface's colour role now (ETH-132).
function trackSurface(node: Element): void {
  const names: string[] = [];
  for (
    let at = node.closest("[data-wb]");
    at !== null;
    at = at.parentElement?.closest("[data-wb]") ?? null
  )
    names.push(at.getAttribute("data-wb") ?? "");
  const found = surfaceOf(names); // → { surface, colour } | null
  surfaceNote.hidden = found === null;
  if (found === null) return;
  const mode = doc()?.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const value = effectiveValue(COLOUR_ROOT[mode], found.colour) ?? "";
  surfaceLabel.textContent = `${found.surface.charAt(0).toUpperCase()}${found.surface.slice(1)} surface · ${found.colour}`;
  surfaceSwatch.title = value;
  surfaceSwatch.style.background = value;
}

function trackFields(): void {
  selectionPanel.hidden = selection === null;
  if (selection === null) return;
  const { node, selector, locked } = selection;
  trackSurface(node);
  const v = spacingOf(node);
  const laidOut = laysOut(node);
  const inline = style(node).display === "inline"; // width and height do nothing there
  for (const { name, input, clear, row } of rows) {
    const sized = SIZE.includes(name);
    row.hidden = sized && componentMode; // size is a Live-mode edit (Ethan)
    if (document.activeElement !== input) input.value = String(v[name]);
    input.readOnly = locked.has(name);
    input.disabled = (name === "gap" && !laidOut) || (sized && inline);
    clear.disabled = was(selector, name) === null;
  }
  note.hidden = !SPACING.some((name) => locked.has(name));
  trackOffset(node, selection.nudgeLocked);
}

function trackOffset(node: Styled, nudgeLocked: boolean): void {
  const offset = offsetOf(node);
  for (const { axis, input, clear } of offsetRows) {
    if (document.activeElement !== input) input.value = String(offset[axis]);
    input.readOnly = nudgeLocked;
    clear.disabled = nudgeLocked || offset[axis] === 0;
  }
  offsetNote.hidden = !nudgeLocked;
  offsetNote.textContent = componentRoot(node)
    ? "Placement belongs to Live mode. Edit inside this component's border."
    : "Offset is read-only because the element already has a native transform or translate.";
}

// Lists saved values whose selector matches nothing in the frame's page, each with a delete.
function trackUnmatched(): void {
  const d = doc();
  if (d === null || windowElement() === null) return;
  const lost = [...files]
    .filter(
      ([selector]) =>
        selector !== ROOT &&
        !Object.values(COLOUR_ROOT).includes(selector) &&
        !matches(d, selector),
    )
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

const THEMES_ENDPOINT = "/__workbench/themes";
// The bundled and saved themes (ADR-028), as the plugin lists them.
let themes: Theme[] = [];
const colourList = element("div", { className: "colour-list" });
const colourHeading = element("h2", {}, "Colours · Light");
const colourPanel = element(
  "details",
  { ariaLabel: "Colours", open: true },
  element("summary", {}, colourHeading),
  colourKit.row,
  colourKit.form,
  colourList,
);
type ColourRow = {
  name: string;
  picker: HTMLInputElement;
  input: HTMLInputElement;
  reset: HTMLButtonElement;
  ratios: HTMLElement;
  editable: boolean;
};
let colourRows: ColourRow[] = [];
let colourEdit: {
  row: ColourRow;
  root: HTMLElement;
  selector: string;
  before: string;
  inline: string;
} | null = null;
const colourCanvas = element("canvas");
colourCanvas.width = colourCanvas.height = 1;
const colourContext = colourCanvas.getContext("2d", { willReadFrequently: true });
const colourCache = new Map<string, string>();
let colourKey = "";

function colourHex(value: string, background = "#ffffff"): string {
  const key = `${background}/${value}`;
  const cached = colourCache.get(key);
  if (cached !== undefined) return cached;
  if (colourContext === null) return "#000000";
  colourContext.clearRect(0, 0, 1, 1);
  colourContext.fillStyle = background;
  colourContext.fillRect(0, 0, 1, 1);
  colourContext.fillStyle = value;
  colourContext.fillRect(0, 0, 1, 1);
  const rgb = colourContext.getImageData(0, 0, 1, 1).data;
  const hex = `#${[rgb[0], rgb[1], rgb[2]].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("")}`;
  colourCache.set(key, hex);
  return hex;
}

function beginColour(row: ColourRow): void {
  if (colourEdit?.row === row) return;
  finishColour(true);
  const root = doc()?.documentElement;
  if (root === undefined) return;
  colourEdit = {
    row,
    root,
    selector: canvasMode.value === "dark" ? COLOUR_ROOT.dark : COLOUR_ROOT.light,
    before: colourHex(style(root).getPropertyValue(row.name)),
    inline: root.style.getPropertyValue(row.name),
  };
}

function previewColour(row: ColourRow, value: string): void {
  if (!HEX.test(value)) return;
  beginColour(row);
  colourEdit?.root.style.setProperty(row.name, value.toLowerCase());
  row.picker.value = value;
  if (document.activeElement !== row.input) row.input.value = value;
}

function finishColour(accept: boolean): void {
  const pending = colourEdit;
  if (pending === null) return;
  colourEdit = null;
  const { row, root, selector, before, inline } = pending;
  const value = root.style.getPropertyValue(row.name);
  if (accept && HEX.test(value) && value.toLowerCase() !== before) {
    saveValue(root, selector, row.name, value.toLowerCase());
  } else {
    if (inline === "") root.style.removeProperty(row.name);
    else root.style.setProperty(row.name, inline);
  }
  row.input.value = colourHex(style(root).getPropertyValue(row.name));
  row.input.removeAttribute("aria-invalid");
  colourKey = "";
}

// Each colour name's baseline from tokens.css, per mode, as the plugin reads it.
let colourBaseline = new Map<string, { light: string; dark: string }>();

// `value` with each `var(--x)` replaced by x's baseline in `mode`, so the canvas-free colour
// probe can read it. Depth-limited: tokens.css has no cycles, but a cycle must not hang.
function resolveVars(value: string, mode: "light" | "dark", depth = 0): string {
  if (depth > 8) return value;
  const next = value.replaceAll(/var\((--[\w-]+)\)/g, (all, name: string) => {
    const base = colourBaseline.get(name)?.[mode];
    return base === undefined ? all : resolveVars(base, mode, depth + 1);
  });
  return next;
}

// Each `:root` design value's baseline from tokens.css, as the plugin reads it.
let rootBaseline = new Map<string, string>();

// The value `name` has in `selector` per the override file, else its tokens.css baseline, in the
// form a theme saves. Read from data, not the canvas, which lags each write until it reloads.
function effectiveValue(selector: string, name: string): string | null {
  const mode = (["light", "dark"] as const).find((m) => COLOUR_ROOT[m] === selector);
  if (mode === undefined) {
    const value = was(selector, name) ?? rootBaseline.get(name) ?? null;
    return value !== null && name.startsWith("--font-") ? familyOf(value) : value;
  }
  const saved = was(selector, name);
  if (saved !== null) return saved.toLowerCase();
  const base = colourBaseline.get(name)?.[mode];
  return base === undefined ? null : colourHex(resolveVars(base, mode));
}

const inEffect = (values: ThemeValue[]): boolean[] =>
  values.map((v) => effectiveValue(v.selector, v.name) === v.value);

// The part of `theme` a kit applies: its colour roles or its type roles.
const kindValues = (theme: Theme, kind: ThemeKind): ThemeValue[] =>
  themeValues(kind === "colours" ? { ...theme, type: {} } : { ...theme, colours: {} });
const ofKind = (theme: Theme, kind: ThemeKind): boolean =>
  Object.keys(theme[kind] ?? {}).length > 0;

// Every colour role's value now, light and dark.
function currentColours(): NonNullable<Theme["colours"]> {
  return Object.fromEntries(
    Object.entries(COLOUR_ROLES).map(([role, name]) => [
      role,
      {
        light: effectiveValue(COLOUR_ROOT.light, name) ?? undefined,
        dark: effectiveValue(COLOUR_ROOT.dark, name) ?? undefined,
      },
    ]),
  );
}

// Every type role's value now.
const currentType = (): NonNullable<Theme["type"]> =>
  Object.fromEntries(
    Object.entries(TYPE_ROLES).flatMap(([role, name]) => {
      const value = effectiveValue(ROOT, name);
      return value === null ? [] : [[role, value]];
    }),
  );

// Shows the first theme whose every value is in effect, so it stays right after a reload, an
// undo or a hand edit.
function showActiveTheme(): void {
  for (const kit of kits) {
    const active = themes.find(
      (t) => ofKind(t, kit.kind) && inEffect(kindValues(t, kit.kind)).every(Boolean),
    );
    kit.picker.value = active?.name ?? "";
    kit.remove.disabled = active === undefined;
  }
}

// Lists the plugin's themes in the picker, keeping only those that parse here too.
async function loadThemes(): Promise<void> {
  const reply: unknown = await (await fetch(THEMES_ENDPOINT)).json();
  const listed = prop(reply, "themes");
  themes = (Array.isArray(listed) ? listed : [])
    .map((t) => parseTheme(JSON.stringify(t)))
    .filter((t): t is Theme => typeof t !== "string");
  for (const kit of kits) {
    kit.picker.replaceChildren(
      element("option", { value: "" }, "None"),
      ...themes
        .filter((t) => ofKind(t, kit.kind))
        .map((t) => element("option", { value: t.name }, t.name.replaceAll("-", " "))),
    );
  }
  showActiveTheme();
}

function buildColours(values: unknown): void {
  if (colourRows.length > 0) return;
  colourRows = entries(values).map(([name, token]) => {
    const editable = prop(token, "editable") === true;
    const picker = element("input", {
      type: "color",
      ariaLabel: `Pick ${name}`,
      disabled: !editable,
    });
    const input = element("input", {
      id: `colour-${name}`,
      ariaLabel: `${name} hex`,
      readOnly: !editable,
      autocomplete: "off",
      spellcheck: false,
    });
    const clear = element(
      "button",
      { type: "button", className: "reset", ariaLabel: `Reset ${name}` },
      "Reset",
    );
    clear.hidden = !editable;
    const ratios = element("div", { className: "contrast" });
    const row = { name, picker, input, reset: clear, ratios, editable };
    colourList.append(
      element(
        "div",
        { className: "colour-row" },
        element("label", { htmlFor: input.id }, `${name}${editable ? "" : " · Read-only"}`),
        element("div", { className: "colour-inputs" }, picker, input, clear),
        ratios,
      ),
    );
    if (editable) {
      for (const control of [picker, input]) {
        control.addEventListener("focus", () => beginColour(row));
        control.addEventListener("input", () => {
          beginColour(row);
          const valid = HEX.test(control.value);
          input.setAttribute("aria-invalid", String(!valid));
          if (valid) previewColour(row, control.value);
        });
        control.addEventListener("keydown", (event) => {
          if (event.key !== "Escape" && event.key !== "Enter") return;
          event.preventDefault();
          event.stopPropagation();
          finishColour(event.key === "Enter" && HEX.test(control.value));
        });
        control.addEventListener("blur", () => finishColour(HEX.test(control.value)));
      }
      picker.addEventListener("change", () => finishColour(true));
      picker.addEventListener("cancel", () => finishColour(false));
      clear.addEventListener("click", () => {
        finishColour(false);
        const root = doc()?.documentElement;
        if (root !== undefined)
          saveValue(
            root,
            canvasMode.value === "dark" ? COLOUR_ROOT.dark : COLOUR_ROOT.light,
            name,
            null,
          );
      });
    }
    return row;
  });
}

function showColour(row: ColourRow, values: Map<string, string>, selector: string): void {
  const value = values.get(row.name) ?? "";
  const hex = colourHex(value);
  if (colourEdit?.row !== row) {
    row.picker.value = hex;
    row.input.value = row.editable ? hex : value;
  }
  row.input.title = value;
  row.reset.disabled = was(selector, row.name) === null;
  row.ratios.replaceChildren(
    ...(CONTRAST[row.name] ?? []).map((surface) => {
      const background = colourHex(values.get(surface) ?? "#ffffff");
      const ratio = contrast(colourHex(value, background), background);
      const low = ratio < 4.5;
      const reading = element(
        "div",
        {},
        `${low ? "Low · " : ""}${ratio.toFixed(2)}:1 on ${surface}`,
      );
      reading.dataset.low = String(low);
      return reading;
    }),
  );
}

function trackColours(): void {
  const root = doc()?.documentElement;
  if (root === undefined || colourRows.length === 0) return;
  const theme = root.dataset.theme === "dark" ? "dark" : "light";
  const selector = COLOUR_ROOT[theme];
  const computed = style(root);
  frame.parentElement?.style.setProperty("background-color", computed.getPropertyValue("--paper"));
  const values = new Map(
    colourRows.map(({ name }) => [name, computed.getPropertyValue(name).trim()]),
  );
  const key = JSON.stringify([theme, [...values], [...(files.get(selector) ?? [])]]);
  if (key === colourKey) return;
  colourKey = key;
  canvasMode.value = theme;
  const themeLabel = theme === "dark" ? "Dark" : "Light";
  modeLabel.textContent = `Editing ${themeLabel} mode · Other values apply to both modes`;
  colourHeading.textContent = `Colours · ${themeLabel}`;
  for (const row of colourRows) showColour(row, values, selector);
}

function track(): void {
  trackComponent();
  trackColours();
  trackRadius();
  trackSelection();
  trackFields();
  trackType();
  trackRootFonts();
  trackScale();
  trackEase();
  trackSide();
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
      element(
        "div",
        { className: "mode-row" },
        element("label", { htmlFor: "theme" }, "Canvas"),
        canvasMode,
      ),
      modeLabel,
      element(
        "div",
        { className: "history-tools", ariaLabel: "Edit history", role: "group" },
        undo,
        redo,
        discard,
      ),
      element("div", { className: "commit-row" }, checkCommit, exportButton, openButton),
      projectFile,
      projectDialog,
      message,
      componentNotice,
      selectionPanel,
      typePanel,
      element(
        "details",
        { ariaLabel: "Window", open: true },
        element("summary", {}, element("h2", {}, "Window · Both modes")),
        element("div", { className: "row" }, label, field, reset),
      ),
      element(
        "details",
        { ariaLabel: "Layout", open: true },
        element("summary", {}, element("h2", {}, "Layout · Both modes")),
        element(
          "div",
          { className: "row layout-row" },
          element("span", {}, "Rail side"),
          shellSide.cell,
        ),
      ),
      element(
        "details",
        { ariaLabel: "Motion", open: true },
        element("summary", {}, element("h2", {}, "Motion · Both modes")),
        motionField.row,
        easeEditor,
        scrubRow,
      ),
      colourPanel,
      scalePanel,
      unmatchedPanel,
    ),
  ),
);
document.body.append(stepList, fontPicker, basics, commitDialog);
// Each category folds away to save space, and stays folded across reloads.
const folded = new Set(localStorage.getItem("workbench-folded")?.split("|"));
for (const panel of document.querySelectorAll<HTMLDetailsElement>(".inspector > details")) {
  panel.open = !folded.has(panel.ariaLabel ?? "");
  panel.addEventListener("toggle", () => {
    if (panel.open) folded.delete(panel.ariaLabel ?? "");
    else folded.add(panel.ariaLabel ?? "");
    localStorage.setItem("workbench-folded", [...folded].join("|"));
  });
}
paddingLayer.append(...paddingBars.flatMap((b) => [b.el, b.space]));
sizeLayer.append(...sizeBars.map((b) => b.el));
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
// A spacing readout's x: beside the selected box rather than on its content, and past the
// width handle that sits outside the right edge.
function pillBeside(name: string | null, bounds: DOMRect): number {
  if (name === "padding-left") return Math.max(0, bounds.left - 14 - pill.offsetWidth);
  const past = name === "width" ? SIZE_OUT + 10 : 0;
  return Math.min(bounds.right + past + 14, overlay.clientWidth - pill.offsetWidth);
}
overlay.addEventListener("pointermove", (event) => {
  const spacingBar = event.target instanceof HTMLElement ? event.target.closest(".bar") : null;
  const bounds = selection?.node.getBoundingClientRect();
  const origin = overlay.getBoundingClientRect();
  const pointerX = event.clientX - origin.left;
  const pointerY = event.clientY - origin.top;
  const x =
    spacingBar === null || bounds === undefined
      ? Math.min(pointerX + 14, overlay.clientWidth - pill.offsetWidth)
      : pillBeside(spacingBar.getAttribute("data-name"), bounds);
  const y = spacingBar === null ? pointerY + 14 : pointerY - pill.offsetHeight / 2;
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
// Applies a theme as one history step, so one undo takes all of it back. A theme for one mode
// shows that mode, or applying it would change nothing on the canvas.
for (const kit of kits) {
  // Applies the kit's part of a theme as one history step. A theme for one colour mode shows that
  // mode, or applying it would change nothing on the canvas. `input`, not `change`: keyboard
  // typeahead on a closed select does not fire `change` in Chromium.
  kit.picker.addEventListener("input", () => {
    const theme = themes.find((t) => t.name === kit.picker.value);
    if (theme === undefined) {
      showActiveTheme();
      return;
    }
    const values = kindValues(theme, kit.kind);
    const modes = new Set(values.map((v) => v.selector));
    for (const mode of ["light", "dark"] as const) {
      if (modes.size === 1 && modes.has(COLOUR_ROOT[mode]) && canvasMode.value !== mode) {
        canvasMode.value = mode;
        canvasMode.dispatchEvent(new Event("change"));
      }
    }
    enqueue(async () => {
      const now = inEffect(values);
      // A value already in effect, even as the baseline, is not written as an override.
      const changes = values
        .filter((_, i) => now[i] !== true)
        .map((v) => ({ ...v, before: was(v.selector, v.name), after: v.value }));
      if (changes.length === 0 || !(await writeChanges(changes))) return;
      settleChanges(changes);
      await load();
    });
  });
  // Removes the shown theme's values from the override file as one history step, so each
  // returns to its baseline (story feature 2, criterion 3).
  kit.remove.addEventListener("click", () => {
    const theme = themes.find((t) => t.name === kit.picker.value);
    if (theme === undefined) return;
    enqueue(async () => {
      const changes = kindValues(theme, kit.kind)
        .map((v) => ({ ...v, before: was(v.selector, v.name), after: null }))
        .filter((c) => c.before !== null);
      if (changes.length === 0 || !(await writeChanges(changes))) return;
      settleChanges(changes);
      await load();
    });
  });
  kit.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = kit.name.value;
    const body = JSON.stringify({
      format: "design-workshop/theme",
      version: 1,
      name,
      [kit.kind]: kit.kind === "colours" ? currentColours() : currentType(),
    });
    enqueue(async () => {
      const response = await fetch(THEMES_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const reply: unknown = await response.json();
      if (!response.ok) {
        showMessage(`Not saved: ${text(prop(reply, "error")) ?? response.statusText}`, true);
        return;
      }
      showMessage(`Saved ${kit.noun} ${name}.`);
      kit.name.value = "";
      await loadThemes();
    });
  });
}
canvasMode.addEventListener("change", () => {
  finishColour(false);
  const root = doc()?.documentElement;
  for (const row of colourRows) root?.style.removeProperty(row.name);
  if (root !== undefined) root.dataset.theme = canvasMode.value;
  const appRoot = appDoc()?.documentElement;
  if (appRoot !== undefined) appRoot.dataset.theme = canvasMode.value;
  localStorage.setItem("theme", canvasMode.value);
  modeLabel.textContent = `Editing ${canvasMode.value === "dark" ? "Dark" : "Light"} mode · Other values apply to both modes`;
});
reset.addEventListener("click", () => {
  show(baseline);
  save(null);
});
// Downloads the project file the plugin builds (ETH-125). The browser saves it; nothing in the
// repo is written. A manifest that breaks the contract is reported instead (ADR-029).
exportButton.addEventListener("click", () => {
  exportButton.disabled = true;
  exportButton.textContent = "Exporting…";
  void (async () => {
    try {
      const reply: unknown = await (await fetch("/__workbench/project")).json();
      const failures = prop(reply, "failures");
      if (!Array.isArray(failures) || failures.length > 0) {
        const codes = Array.isArray(failures) ? failures.map((f) => text(prop(f, "code"))) : [];
        showMessage(
          `Not exported: ${codes.join(", ") || text(prop(reply, "error")) || "no reply"}`,
          true,
        );
        return;
      }
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(prop(reply, "project"), null, 2)}\n`], {
          type: "application/json",
        }),
      );
      element("a", { href: url, download: "design-workshop.project.json" }).click();
      URL.revokeObjectURL(url);
      showMessage("Exported design-workshop.project.json.");
    } finally {
      exportButton.disabled = false;
      exportButton.textContent = "Export";
    }
  })();
});
// Shows a chosen project file's checklist (ETH-126). Reading it writes nothing; the decision is
// the contract's checkProject alone, the same list `pnpm workbench check-project` prints.
openButton.addEventListener("click", () => projectFile.click());
projectFile.addEventListener("change", () => {
  const file = projectFile.files?.[0];
  projectFile.value = "";
  if (file === undefined) return;
  void (async () => {
    const source = await file.text();
    const items = checkProject(source);
    const failed = items.filter((i) => i.failure !== undefined).length;
    const data: unknown = failed === 0 ? JSON.parse(source) : null;
    projectLook =
      data === null
        ? null
        : {
            name: file.name,
            overrides: new Map(
              entries(prop(data, "overrides")).map(
                ([selector, rule]): [string, Map<string, string>] => [
                  selector,
                  new Map(
                    entries(rule).flatMap(([n, v]) => (typeof v === "string" ? [[n, v]] : [])),
                  ),
                ],
              ),
            ),
          };
    projectLoad.disabled = projectLook === null;
    projectVerdict.textContent =
      failed === 0
        ? `${file.name} fits this Template.`
        : `${file.name} cannot be loaded: ${failed} of ${items.length} items fail.`;
    projectList.replaceChildren(
      ...items.map(({ path, failure }) =>
        element(
          "li",
          { className: failure === undefined ? "passed" : "failed" },
          element(
            "span",
            { ariaLabel: failure === undefined ? "Passed" : "Failed" },
            failure === undefined ? "✓" : "✕",
          ),
          element("code", {}, path || "file"),
          ...(failure === undefined
            ? []
            : [element("span", {}, `${failure.code}: ${failure.message}`)]),
        ),
      ),
    );
    projectDialog.showModal();
  })();
});
projectClose.addEventListener("click", () => projectDialog.close());
// Loads a checked file as one release through the save path, so one undo restores the old look
// (ETH-127). Values whose selectors match nothing stay listed by trackUnmatched (ADR-012).
projectLoad.addEventListener("click", () => {
  const look = projectLook;
  if (look === null) return;
  projectDialog.close();
  enqueue(async () => {
    await load();
    const changes = replaceLook(files, look.overrides);
    if (changes.length === 0) {
      showMessage(`${look.name} is already the current look.`);
      return;
    }
    if (!(await writeChanges(changes))) return;
    settleChanges(changes);
    storeHistory();
    await load();
    showMessage(`Loaded ${look.name}.`);
  });
});
undo.addEventListener("click", () => replay(-1));
redo.addEventListener("click", () => replay(1));
checkCommit.addEventListener("click", () => enqueue(runCommit));
commitClose.addEventListener("click", () => {
  if (commitController !== null) void cancelCommit();
  else commitDialog.close();
});
commitDialog.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    (commitClose.disabled ? commitDialog : commitClose).focus();
  }
});
commitDialog.addEventListener("cancel", (event) => {
  if (commitClose.disabled || commitController !== null) {
    event.preventDefault();
    if (commitController !== null) void cancelCommit();
  }
});
discard.addEventListener("click", () => {
  if (!confirm("Discard all saved values since the last commit? This cannot be undone.")) return;
  enqueue(async () => {
    const response = await fetch("/__workbench/discard", { method: "POST" });
    if (!response.ok) {
      showMessage("Could not discard saved values. Nothing was cleared.", true);
      return;
    }
    history = { steps: [], cursor: 0 };
    showMessage("Saved values discarded.");
    const previous = [...files].flatMap(([selector, values]) =>
      [...values.keys()].map((name) => ({ selector, name })),
    );
    await load();
    settleChanges(previous.map((c) => ({ ...c, after: was(c.selector, c.name) })));
  });
});
document.addEventListener("keydown", keyDown);
window.addEventListener("focus", () => enqueue(refreshStatus));
import.meta.hot?.on("workbench:values", () => enqueue(refreshStatus));

// The override stylesheet the proxy links into the app (ETH-148): fetched again when the file
// changes, the new sheet replacing the old once it loads, so nothing flashes unstyled.
import.meta.hot?.on("workbench:values", () => {
  const old = frame.contentDocument?.querySelector<HTMLLinkElement>(
    "link[data-workbench-overrides]",
  );
  if (old === null || old === undefined) return;
  const next = document.createElement("link");
  next.rel = "stylesheet";
  next.dataset.workbenchOverrides = "";
  next.href = `/__workbench/overrides.css?t=${Date.now()}`;
  next.addEventListener("load", () => old.remove(), { once: true });
  old.after(next);
});
frame.addEventListener("load", () => {
  canvasMode.value = doc()?.documentElement.dataset.theme === "dark" ? "dark" : "light";
  modeLabel.textContent = `Editing ${canvasMode.value === "dark" ? "Dark" : "Light"} mode · Other values apply to both modes`;
  void load();
  void loadThemes();
});
requestAnimationFrame(track);
