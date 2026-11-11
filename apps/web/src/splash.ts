import { useSyncExternalStore } from "react";

/** The painting behind a new thread's welcome (ADR-136), with a switch to look through the others. */
export type SplashStyle = "landscape" | "abstract" | "vitruvian";

type SplashLook = { id: SplashStyle; label: string };

/** The looks the switch offers, in its order. */
export const SPLASH_LOOKS: readonly SplashLook[] = [
  { id: "abstract", label: "Abstract" },
  { id: "landscape", label: "Landscape" },
  { id: "vitruvian", label: "Vitruvian" },
];

// Set once a welcome has been on screen, so only a visitor's very first welcome is sure to be
// abstract (Ethan).
const SEEN_KEY = "kay.splash.seen";
// Keys earlier builds kept, read by nothing now and cleared: the switch's last pick, and the
// visit cycle's place.
const RETIRED_KEYS = ["kay.splash", "kay.splash.turn"];
const PARAM = "splash";

// The look on screen, held above any remount. Null until the first read decides it.
let current: SplashStyle | null = null;
// The look a `?splash=` asked for, which holds for the whole visit.
let asked: SplashStyle | null = null;
// The thread whose welcome last showed, so a remount of the same welcome keeps its look.
let shownFor: string | null = null;
const listeners = new Set<() => void>();

/** The look a string names, or null for anything else. */
export const splashStyleOf = (value: string | null): SplashStyle | null =>
  SPLASH_LOOKS.find((look) => look.id === value)?.id ?? null;

/**
 * The look a welcome opens with: the one the address asks for, else abstract for a visitor who
 * has never seen a welcome, else the look `roll` lands on, each of the three equally likely.
 * @param roll A number in [0, 1), such as `Math.random()`.
 */
export function pickLook(
  fromUrl: SplashStyle | null,
  firstEver: boolean,
  roll: number,
): SplashStyle {
  if (fromUrl !== null) return fromUrl;
  if (firstEver) return "abstract";
  return SPLASH_LOOKS[Math.min(Math.floor(roll * SPLASH_LOOKS.length), SPLASH_LOOKS.length - 1)].id;
}

// The painting reaches the CSS as an attribute on <html>, as the title bar's look does: index.css
// draws the landscape and the abstract strokes off `data-splash`.
function apply(style: SplashStyle): void {
  document.documentElement.dataset.splash = style;
}

// Whether a welcome has been on screen in an earlier visit; true when storage is refused, as in
// a private window, so such a visitor still gets the random pick.
function seenBefore(): boolean {
  try {
    for (const key of RETIRED_KEYS) localStorage.removeItem(key);
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

// A `?splash=` in the address, which a screenshot run passes, so the same page can be shot in
// each look. It holds for the visit, as a choice from the switch does.
function fromAddress(): SplashStyle | null {
  try {
    return splashStyleOf(new URL(location.href).searchParams.get(PARAM));
  } catch {
    return null;
  }
}

function decide(): SplashStyle {
  asked = fromAddress();
  return pickLook(asked, !seenBefore(), Math.random());
}

// Decided on the first read, which is before the welcome's first paint, so the picture never
// flips from one look to another.
function snapshot(): SplashStyle {
  if (current === null) {
    current = decide();
    apply(current);
  }
  return current;
}

// Read as the module loads rather than at the first welcome: the app drops a `?splash=` from the
// address as it lands on a thread, before any welcome has been drawn. The prerender has no
// document to mark.
if (typeof document !== "undefined") snapshot();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Until the next new thread's welcome: kept, the choice would stand in for every draw after it.
function choose(next: SplashStyle): void {
  if (splashStyleOf(next) === null || next === current) return;
  current = next;
  apply(next);
  for (const listener of listeners) listener();
}

/**
 * Marks a thread's welcome as on screen. The visit's first welcome keeps the look decided as the
 * app loaded; a later thread's welcome rolls a new one (Ethan), unless the address chose it.
 * Remounting the same thread's welcome keeps its look. Call it before the welcome paints.
 */
export function showSplashFor(threadId: string): void {
  if (shownFor === threadId) return;
  const later = shownFor !== null;
  shownFor = threadId;
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage refused: the next visit counts as a first one again.
  }
  if (later) choose(pickLook(asked, false, Math.random()));
}

/**
 * The welcome's painting and how to change it for this visit. Every caller reads the one store,
 * so the welcome and its switch agree with no prop between them.
 */
export function useSplash(): { style: SplashStyle; choose: (next: SplashStyle) => void } {
  const style = useSyncExternalStore(subscribe, snapshot, () => "abstract" as const); // → SplashStyle
  return { style, choose };
}
