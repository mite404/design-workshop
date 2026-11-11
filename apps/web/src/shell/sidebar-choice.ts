// The visitor's choices for the projects panel (the sidebar), kept on the device: docked or
// closed, and the width its edge was dragged to. Both are read before the first paint, so the
// panel and the tabs never jump, and both reach the page as the CSS the panel and the title bar
// read.
import { cssVars } from "@yaklabs/ui/lib/utils";
import { useState, type CSSProperties } from "react";
import { env } from "../env";
import { useVisitor } from "../session";
import type { SidebarWidth } from "./sidebar";
import { handFocusToToggle } from "./peek-page";
import { parseStoredWidth, SIDEBAR_DEFAULT_PX, widthValue } from "./sidebar-width";

// The visitor's own choice of an open or a collapsed sidebar.
const SIDEBAR_KEY = "kay.sidebar";
// The width the visitor dragged the sidebar to, in CSS px.
const WIDTH_KEY = "kay.sidebar-width";
// A window this wide opens with the sidebar open, until the visitor chooses.
const WIDE_PX = 1280;

// The guide temporarily expands the panel separately; this is only the visitor's own choice.
function readSidebarOpen(key: string): boolean {
  try {
    const stored = localStorage.getItem(key); // → "open" | "closed" | null
    if (stored === "open" || stored === "closed") return stored === "open";
  } catch {
    // Private windows may refuse storage.
  }
  return window.innerWidth >= WIDE_PX;
}

function rememberSidebar(key: string, open: boolean): void {
  try {
    localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    // The choice holds for this visit.
  }
}

function readSidebarWidth(): number {
  try {
    const kept = parseStoredWidth(localStorage.getItem(WIDTH_KEY)); // → px | null
    if (kept !== null) return kept;
  } catch {
    // Private windows may refuse storage.
  }
  return SIDEBAR_DEFAULT_PX;
}

/**
 * Whether the sidebar is open, as the visitor last chose, and the way to choose again. Closing
 * it first hands keyboard focus on what it hides to the title bar's toggle.
 */
export function useSidebarOpen(): {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} {
  const visitor = useVisitor();
  const key = env.auth.kind === "workos" ? `${SIDEBAR_KEY}:${visitor}` : SIDEBAR_KEY;
  const [choice, setChoice] = useState(() => ({ visitor, open: readSidebarOpen(key) }));
  if (choice.visitor !== visitor) {
    setChoice({ visitor, open: readSidebarOpen(key) });
  }
  return {
    open: choice.open,
    onOpenChange: (next) => {
      if (!next) handFocusToToggle();
      setChoice({ ...choice, visitor, open: next });
      rememberSidebar(key, next);
    },
  };
}

/** The sidebar's width as the visitor last dragged it, and the way to keep a new one. */
export function useSidebarWidth(): SidebarWidth {
  const [width, setWidth] = useState(readSidebarWidth);
  return {
    width,
    onWidth: (px) => {
      setWidth(px);
      try {
        localStorage.setItem(WIDTH_KEY, String(px));
      } catch {
        // The width holds for this visit.
      }
    },
  };
}

/**
 * The rail's and the panel's sizes as the CSS the wrapper carries, read by both and by the title
 * bar, whose tabs start at the panel's edge.
 * @param width The panel's kept width, in CSS px.
 */
export function sidebarVars(width: number): CSSProperties {
  return cssVars({
    "--sidebar-width": widthValue(width),
    "--rail-width": "3.5rem",
    // On a phone the drawer takes most of the width and leaves the page's edge in view.
    "--sidebar-width-mobile": "min(85vw, 20rem)",
  });
}
