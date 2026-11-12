// The Workbench's chat (ETH-110): a bottom-right dock whose chat button opens a mocked chat panel
// above it, and whose arrow button alone starts choosing an element of the framed app to reference.
// While choosing, a filled highlight glides between the visible units under the pointer; a click
// or Enter selects the element it shows, never activating it, and Add to chat puts a removable
// reference in the draft. A sent message keeps each reference's selector (ADR-012), preview, and
// the file and line of the component it sits in, and its current values (R12).
// Nothing leaves the page: no model is called.
import { chain, element, place, selectorOf, style, type Styled } from "./dom";
import { chatKeyOf, parseMessages, storedRef, type Message } from "./chatStore";
import { currentValues, holds, labelOf, sourceOf } from "./reference";
import { SPACING } from "./spacing";
import { TYPE } from "./type";

// One element a draft or message refers to: the element, and its identity when it was chosen.
// A reference restored from storage starts without its element and finds it by its selector.
type Ref = {
  node: Styled | null;
  label: string;
  selector: string;
  preview: string;
  source: string;
  values: string[]; // as rendered when chosen: what the Live-mode inspector shows
};
type Point = { x: number; y: number };

const GLIDE = 160; // ms the highlight eases between targets, a little longer than its transition
const KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"]);

function svg(path: string): HTMLElement {
  const span = element("span", { className: "icon", ariaHidden: "true" });
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16"><path d="${path}"/></svg>`;
  return span;
}

const targetLabel = element("span", { className: "target-label" });
const highlight = element("div", { className: "target", hidden: true }, targetLabel);
const stageLabel = element("span", { className: "stage-label" });
const add = element("button", { type: "button", className: "primary" }, "Add to chat");
const cancel = element("button", { type: "button" }, "Cancel");
const stage = element(
  "div",
  { className: "stage", role: "group", ariaLabel: "Selected element", hidden: true },
  stageLabel,
  add,
  cancel,
);
const announce = element("span", { className: "visually-hidden", role: "status" });
const hint = element(
  "p",
  { className: "ref-hint", hidden: true },
  "Click an element to reference it · ↑ ↓ ← → refine · Enter selects · Esc cancels",
  announce,
);
const arrow = element(
  "button",
  { type: "button", ariaLabel: "Reference an element", title: "Reference an element" },
  svg("M3.5 2.5 12.5 7 8.25 8.25 7 12.5Z"),
);
const chatButton = element(
  "button",
  { type: "button", ariaLabel: "Chat", title: "Chat" },
  svg("M2.5 3.5h11v7.5H7.5l-3 2.5V11h-2Z"),
);
const dock = element("div", { className: "dock" }, arrow, chatButton);
const log = element("ol", { className: "chat-log", ariaLabel: "Messages" });
const chips = element("ul", { className: "chips", ariaLabel: "References" });
const draft = element("textarea", {
  className: "chat-draft",
  rows: 3,
  placeholder: "Describe the change",
  ariaLabel: "Message",
});
const send = element("button", { type: "button", className: "primary" }, "Send");
const panel = element(
  "section",
  { className: "chat", id: "wb-chat", ariaLabel: "Chat", inert: true },
  element(
    "header",
    {},
    element("h2", {}, "Chat"),
    element("span", { className: "chat-mock" }, "Mocked · nothing is sent to a model"),
  ),
  log,
  element(
    "div",
    { className: "composer" },
    chips,
    draft,
    element("div", { className: "composer-row" }, element("span", {}, "Enter to send"), send),
  ),
);

/** What the page adds to its canvas, over the frame and its overlay. */
export const chatLayer = [highlight, stage, hint, dock, panel];

let frame: HTMLIFrameElement | null = null;
const watchedDocuments = new WeakSet<Document>();
let choosing = false;
let hover: Styled | null = null; // the element the highlight shows
let picked: Styled | null = null; // the element chosen, awaiting Add to chat
let path: Styled[] = []; // the elements under the pointer, outermost first
let pointer: Point | null = null; // in the frame's coordinates
let replacing: Ref | null = null; // the unresolved reference a new choice replaces
let glideTimer = 0;
const references: Ref[] = []; // the draft's
const shown = new Map<HTMLElement, Ref>(); // every reference on screen, to mark unresolved
let sources: Promise<unknown> = Promise.resolve(null); // JSON: data-wb name → path:line
// The component whose chat shows (R19), or null for Live mode's, which is not kept.
let chatName: string | null = null;
let messages: Message[] = [];
let liveLog: Node[] = [];

/** Whether an element is being chosen, so the page's own selection stands aside. */
export const referencing = (): boolean => choosing;

const doc = (): Document | null => frame?.contentDocument ?? null;
const eligible = (e: Element): e is Styled => chain(e).at(-1) === e;
// The visible unit containing an element: inline spans, links and SVG shapes count as the text
// or icon they sit in, so the paragraph is one target. Arrow keys still reach them.
const unit = (under: Styled[]): Styled | null =>
  under.findLast((e) => style(e).display !== "inline") ?? under.at(-1) ?? null;

function cursor(on: boolean): void {
  const d = doc();
  d?.querySelector("style[data-wb-reference]")?.remove();
  if (!on || d === null) return;
  const sheet = d.createElement("style");
  sheet.dataset.wbReference = "";
  sheet.textContent = "* { cursor: crosshair !important; }";
  d.head.append(sheet);
}

function show(node: Styled | null): void {
  if (node === hover) return;
  hover = node;
  highlight.dataset.glide = "";
  clearTimeout(glideTimer);
  glideTimer = window.setTimeout(() => {
    delete highlight.dataset.glide;
  }, GLIDE);
  targetLabel.textContent = node === null ? "" : name(node);
}

// Its accessible name when it has one, else the text it shows; an SVG's labels are not a name.
function name(node: Styled): string {
  const text = "innerText" in node && typeof node.innerText === "string" ? node.innerText : "";
  return labelOf(node.localName, node.getAttribute("aria-label") ?? text);
}

// Moves the highlight to the unit under `point`, unless a small slip should keep it.
function aim(point: Point): void {
  pointer = point;
  const d = doc();
  if (d === null || picked !== null) return;
  path = chain(d.elementFromPoint(point.x, point.y));
  const next = unit(path);
  if (
    hover !== null &&
    next !== hover &&
    hover.isConnected &&
    holds(hover.getBoundingClientRect(), point, next !== null && hover.contains(next))
  )
    return;
  show(next);
}

function start(): void {
  // Read afresh each time, so lines follow edits; a reference then waits for it (R12).
  sources = fetch("/__workbench/sources")
    .then((r): Promise<unknown> | null => (r.ok ? r.json() : null))
    .catch(() => null);
  choosing = true;
  arrow.ariaPressed = "true";
  hint.hidden = false;
  document.body.dataset.referencing = "";
  cursor(true);
  if (pointer !== null) aim(pointer);
}

function stop(): void {
  choosing = false;
  picked = null;
  replacing = null;
  show(null);
  arrow.ariaPressed = "false";
  hint.hidden = true;
  stage.hidden = true;
  delete document.body.dataset.referencing;
  cursor(false);
}

function pick(): void {
  if (hover === null) return;
  picked = hover;
  // Land the highlight on the chosen element now, so a press mid-glide never shows another.
  clearTimeout(glideTimer);
  delete highlight.dataset.glide;
  for (const glide of highlight.getAnimations()) glide.cancel(); // Chromium keeps it running
  place(highlight, picked.getBoundingClientRect());
  stageLabel.textContent = name(picked);
  stage.hidden = false;
  add.focus();
}

// The next target from `from` by an arrow key: its container, a child (toward the pointer when
// it is over one), or a sibling.
function refine(from: Styled, key: string): Styled | null {
  const parent = chain(from).at(-2) ?? null;
  if (key === "ArrowUp") return parent;
  const kids = (of: Element | null): Styled[] =>
    // ponytail: checks every descendant per key press; index the tree if large pages lag.
    [...(of ?? from.ownerDocument.body).querySelectorAll("*")].filter(
      (e): e is Styled => eligible(e) && (chain(e).at(-2) ?? null) === of,
    );
  if (key === "ArrowDown") return path[path.indexOf(from) + 1] ?? kids(from)[0] ?? null;
  const siblings = kids(parent);
  return siblings[siblings.indexOf(from) + (key === "ArrowRight" ? 1 : -1)] ?? null;
}

function previewOf(node: Element): string {
  const where = node.ownerDocument.location;
  const mode = node.closest('[aria-label="Component mode"]') === null ? "Live" : "Component";
  return `${mode} · ${where.pathname}${where.search}`;
}

// Whether `ref` still names the element it was chosen as: it is on the page, and its selector
// is still its own. Otherwise it is unresolved and is never moved to another element.
function resolved(ref: Ref): boolean {
  const found = ref.node ?? doc()?.querySelector(ref.selector) ?? null;
  if (found === null || !eligible(found)) return false;
  ref.node = found;
  return found.isConnected && found.ownerDocument === doc() && selectorOf(found) === ref.selector;
}

function refItem(ref: Ref, removable: boolean): HTMLLIElement {
  const item = element("li", {
    className: "chip",
    title: [ref.preview, ref.source, ref.selector, ...ref.values].join("\n"),
  });
  item.dataset.selector = ref.selector;
  item.dataset.preview = ref.preview;
  item.append(element("span", { className: "chip-label" }, ref.label));
  // A draft chip is replaced in place; a sent one stays as sent and the new choice joins the draft.
  const reselect = element("button", { type: "button", className: "reselect" }, "Reselect");
  reselect.ariaLabel = `Reselect ${ref.label}`;
  reselect.addEventListener("click", () => {
    replacing = removable ? ref : null;
    start();
    arrow.focus();
  });
  item.append(reselect);
  if (removable) {
    const remove = element("button", { type: "button", className: "remove" }, "×");
    remove.ariaLabel = `Remove ${ref.label}`;
    remove.addEventListener("click", () => {
      references.splice(references.indexOf(ref), 1);
      renderChips();
      draft.focus();
    });
    item.append(remove);
  } else {
    item.append(
      element("code", {}, ref.preview),
      element("code", {}, ref.source),
      element(
        "details",
        { className: "values" },
        element("summary", {}, "Current values"),
        element("pre", {}, ref.values.join("\n")),
      ),
    );
  }
  shown.set(item, ref);
  return item;
}

function renderChips(): void {
  for (const item of chips.children) if (item instanceof HTMLElement) shown.delete(item);
  chips.replaceChildren(...references.map((ref) => refItem(ref, true)));
  chips.hidden = references.length === 0;
}

function open(isOpen: boolean): void {
  panel.dataset.open = String(isOpen);
  panel.inert = !isOpen;
  chatButton.ariaExpanded = String(isOpen);
  if (isOpen) draft.focus();
}

async function attach(): Promise<void> {
  if (picked === null) return;
  const [node, old] = [picked, replacing];
  const known = await sources; // → { ComposeBox: "packages/catalog/src/ComposeBox.tsx:193", … }
  if (!choosing) return; // cancelled while the sources loaded
  const rendered = style(node);
  const ref = {
    node,
    label: name(node),
    selector: selectorOf(node),
    preview: previewOf(node),
    source: sourceOf(node.closest<HTMLElement>("[data-wb]")?.dataset.wb ?? null, known),
    values: currentValues([...SPACING, ...TYPE], (prop) => rendered.getPropertyValue(prop)),
  };
  const at = old === null ? -1 : references.indexOf(old);
  if (at !== -1) references[at] = ref;
  else if (!references.some((r) => r.node === ref.node)) references.push(ref);
  stop();
  renderChips();
  open(true);
}

const messageItem = (text: string, refs: Ref[]): HTMLLIElement =>
  element(
    "li",
    { className: "chat-message" },
    element("ul", { className: "chips" }, ...refs.map((r) => refItem(r, false))),
    element("p", {}, text),
  );

/**
 * Shows the chat of `component`, a `data-wb` name (R19), kept in localStorage, or Live mode's unsaved
 * chat for null. Cheap to call every frame: it acts only when the name changes.
 */
export function showChatFor(component: string | null): void {
  if (component === chatName) return;
  if (chatName === null) liveLog = [...log.childNodes];
  chatName = component;
  messages = component === null ? [] : parseMessages(localStorage.getItem(chatKeyOf(component)));
  log.replaceChildren(
    ...(component === null
      ? liveLog
      : messages.map((m) =>
          messageItem(
            m.text,
            m.refs.map((r) => ({ ...r, node: null })),
          ),
        )),
  );
}

function submit(): void {
  const text = draft.value.trim();
  if (text === "" && references.length === 0) return;
  log.append(messageItem(text, references));
  log.lastElementChild?.scrollIntoView({ block: "end" });
  if (chatName !== null) {
    messages.push({ text, refs: references.map((r) => storedRef(r)) });
    localStorage.setItem(chatKeyOf(chatName), JSON.stringify(messages));
  }
  references.length = 0;
  draft.value = "";
  renderChips();
}

// The unit at the middle of the frame, where the keyboard starts when nothing is highlighted.
function middle(): Styled | null {
  const root = doc()?.documentElement;
  if (root === undefined) return null;
  return unit(
    chain(root.ownerDocument.elementFromPoint(root.clientWidth / 2, root.clientHeight / 2)),
  );
}

// Moves the highlight, and a chosen element with it, by an arrow key.
function steer(key: string): void {
  const from = picked ?? hover ?? middle();
  if (from === null) return;
  const next = refine(from, key) ?? from;
  show(next);
  if (picked !== null) {
    picked = next;
    stageLabel.textContent = name(next);
  }
  announce.textContent = name(next);
}

// Escape in the panel closes it, keeping the draft. Every key there is the panel's own.
function panelKey(event: KeyboardEvent, target: Node | null): boolean {
  if (target === null || !panel.contains(target)) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    open(false);
    chatButton.focus();
  }
  return true;
}

// Whether a key is left to the element with focus while choosing: the draft's caret keys, and
// Enter on a button of the stage or panel.
const ownKey = (key: string, target: Node | null): boolean =>
  (target === draft && key !== "Escape") ||
  (key === "Enter" && (stage.contains(target) || panel.contains(target)));

/**
 * Handles a key for the chat: the arrow keys, Enter and Escape while choosing, and Escape in the
 * panel, which closes it. True when the page should not handle the key too.
 */
export function chatKey(event: KeyboardEvent): boolean {
  const target = event.target instanceof Node ? event.target : null;
  if (!choosing) return panelKey(event, target);
  if (!KEYS.has(event.key)) return false;
  if (ownKey(event.key, target)) return true;
  event.preventDefault();
  if (event.key === "Escape") {
    stop();
    arrow.focus();
  } else if (event.key === "Enter") pick();
  else steer(event.key);
  return true;
}

/**
 * Follows the frame's document across reloads. Call before the page's own listeners: while
 * choosing, a press selects the highlighted element and goes no further.
 */
export function watchReference(view: Window, from: HTMLIFrameElement): void {
  frame = from;
  hover = null;
  picked = null;
  stage.hidden = true;
  if (choosing) cursor(true);
  if (watchedDocuments.has(view.document)) return;
  watchedDocuments.add(view.document);
  view.addEventListener("pointermove", (event) => {
    if (frame !== from) return;
    if (choosing) aim({ x: event.clientX, y: event.clientY });
    else pointer = { x: event.clientX, y: event.clientY };
  });
  view.addEventListener(
    "scroll",
    () => {
      if (frame !== from) return;
      if (choosing && pointer !== null) aim(pointer);
    },
    true,
  );
  view.addEventListener(
    "pointerdown",
    (event) => {
      if (frame !== from) return;
      if (!choosing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.button !== 0) return;
      const point = { x: event.clientX, y: event.clientY };
      if (picked !== null) {
        picked = null;
        stage.hidden = true;
      }
      aim(point);
      pick();
    },
    true,
  );
}

function referenceBox(node: Styled): DOMRect {
  const box = node.getBoundingClientRect();
  const offset = frame?.ownerDocument === document ? null : frame?.getBoundingClientRect();
  return new DOMRect(
    box.left + (offset?.left ?? 0),
    box.top + (offset?.top ?? 0),
    box.width,
    box.height,
  );
}

/** Each frame: places the highlight and the stage, and marks references gone or ambiguous. */
export function trackChat(): void {
  const node = picked ?? hover;
  highlight.hidden = !choosing || node === null || !node.isConnected;
  if (node !== null && !highlight.hidden) {
    const rect = referenceBox(node);
    place(highlight, rect);
    highlight.style.borderRadius = style(node).borderTopLeftRadius;
    highlight.dataset.picked = String(picked !== null);
    if (picked !== null) {
      // Below the element, or above it when the dock would cover it, inside the canvas.
      const canvas = stage.parentElement ?? document.body;
      const room = rect.bottom + 8 + stage.offsetHeight <= canvas.clientHeight - 64;
      const top = room ? rect.bottom + 8 : Math.max(rect.top - stage.offsetHeight - 8, 8);
      const left = Math.min(Math.max(rect.left, 8), canvas.clientWidth - stage.offsetWidth - 8);
      stage.style.translate = `${left}px ${top}px`;
    }
  }
  for (const [item, ref] of shown) {
    if (item.isConnected) item.dataset.unresolved = String(!resolved(ref));
    else shown.delete(item);
  }
}

arrow.ariaPressed = "false";
chatButton.ariaExpanded = "false";
chatButton.setAttribute("aria-controls", panel.id);
chips.hidden = true;
open(false);
arrow.addEventListener("click", () => {
  if (choosing) stop();
  else start();
});
chatButton.addEventListener("click", () => {
  open(panel.dataset.open !== "true");
});
add.addEventListener("click", () => void attach());
cancel.addEventListener("click", () => {
  stop();
  arrow.focus();
});
send.addEventListener("click", submit);
draft.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  submit();
});
