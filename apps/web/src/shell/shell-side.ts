import { useEffect, useState } from "react";

/** The side of the shell the rail and its drawer sit on (ETH-142, Ethan: left or right only). */
export type ShellSide = "left" | "right";

// The `--shell-side` layout value as a side: anything but `right` is the default, left.
const shellSideOf = (value: string): ShellSide => (value.trim() === "right" ? "right" : "left");

/**
 * The shell's side as `:root`'s `--shell-side` gives it, kept as `data-shell-side` on the root
 * for index.css to mirror the shell by. It is read again whenever a stylesheet changes (the
 * override file's hot reload) or the root's own style does (the Workbench's live preview).
 */
export function useShellSide(): ShellSide {
  const [side, setSide] = useState<ShellSide>("left");
  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      setSide(shellSideOf(getComputedStyle(root).getPropertyValue("--shell-side")));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    observer.observe(root, { attributes: true, attributeFilter: ["style"] });
    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.shellSide = side;
  }, [side]);
  return side;
}
