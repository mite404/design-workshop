import { SidebarProvider } from "@yaklabs/ui/components/sidebar";
import { TREE_EVENT } from "@yaklabs/workbench/tree";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import ComponentTree from "./component-tree";

function press(key: string, options: KeyboardEventInit = {}) {
  flushSync(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...options }),
    );
  });
}

test("tracks live instances, folds with keys and follows canvas selection", async () => {
  const canvas = document.createElement("main");
  canvas.innerHTML =
    '<section data-wb="Card"><div data-slot="title"><h2 data-wb="Heading"></h2></div></section>';
  const drawer = document.createElement("aside");
  drawer.dataset.slot = "sidebar";
  document.body.append(canvas, drawer);
  const root = createRoot(drawer);
  const rows = () => [...drawer.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  try {
    flushSync(() =>
      root.render(
        <SidebarProvider>
          <ComponentTree />
        </SidebarProvider>,
      ),
    );
    expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual(["Card", "Heading"]);
    rows()[0]?.focus();
    const unhandled: string[] = [];
    const receive = (event: KeyboardEvent) => {
      unhandled.push(event.key);
    };
    document.addEventListener("keydown", receive);
    try {
      press("Escape");
      press("b", { ctrlKey: true });
      press("z", { metaKey: true });
      expect(unhandled).toEqual(["Escape", "b", "z"]);
    } finally {
      document.removeEventListener("keydown", receive);
    }
    press("ArrowLeft");
    expect(rows()).toHaveLength(1);
    press("ArrowRight");
    press("ArrowDown");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Heading");
    const chosen: Element[] = [];
    const choose = (event: Event) => {
      if (event instanceof CustomEvent && event.detail instanceof Element)
        chosen.push(event.detail);
    };
    document.addEventListener(TREE_EVENT.select, choose, { once: true });
    press("Enter");
    expect(chosen).toEqual([canvas.querySelector("h2")]);
    press("ArrowLeft");
    press("ArrowLeft");
    flushSync(() =>
      document.dispatchEvent(
        new CustomEvent(TREE_EVENT.selected, {
          detail: canvas.querySelector('[data-slot="title"]'),
        }),
      ),
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.getAttribute("aria-selected")).toBe("true");
    flushSync(() =>
      document.dispatchEvent(
        new CustomEvent(TREE_EVENT.selected, {
          detail: canvas.querySelector("h2"),
        }),
      ),
    );
    expect(rows()).toHaveLength(2);
    expect(rows()[1]?.getAttribute("aria-selected")).toBe("true");
    canvas.insertAdjacentHTML("beforeend", '<section data-wb="Card"></section>');
    await expect.poll(() => rows()).toHaveLength(3);
    canvas.firstElementChild?.setAttribute("data-retain", "");
    canvas.firstElementChild?.setAttribute("inert", "");
    await expect.poll(() => rows()).toHaveLength(1);
    expect(rows()[0]?.tabIndex).toBe(0);
    canvas.firstElementChild?.removeAttribute("inert");
    await expect.poll(() => rows()).toHaveLength(3);
    canvas.firstElementChild?.remove();
    await expect.poll(() => rows().map((row) => row.getAttribute("aria-label"))).toEqual(["Card"]);
  } finally {
    root.unmount();
    canvas.remove();
    drawer.remove();
  }
});
