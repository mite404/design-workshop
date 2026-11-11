// Named DOM roots, retaining instance identity rather than treating a name as a unique key.
export type ComponentNode = { element: Element; name: string; children: ComponentNode[] };

// Title segments are branches; only a story leaf can be opened.
export type StoryNode =
  | { kind: "branch"; name: string; children: StoryNode[] }
  | { kind: "story"; name: string; id: string };

type StoryIndex = {
  entries: Record<string, { type: "story" | "docs"; id: string; title: string; name: string }>;
};

/** The Template's drawer, excluded from its own component tree. */
export const DRAWER = '[data-slot="sidebar"]';

/** Same-origin document events shared by the Template and Workbench. */
export const TREE_EVENT = {
  select: "workbench:select",
  selected: "workbench:selected",
  hover: "workbench:hover",
  focus: "workbench:component-view-changed",
  story: "workbench:open-story",
} as const;

/** The story retained by this app route, or null outside a Workbench story view. */
export function storyView(): string | null {
  if (window.self === window.top) return null;
  const params = new URL(window.parent.location.href).searchParams;
  if (params.get("path") !== location.pathname + location.search) return null;
  const story = params.get("story");
  return story !== null && /^[a-z0-9][a-z0-9-]*$/.test(story) ? story : null;
}

/** Which retained workspace owns the open component, held by the Workbench URL. */
export function componentView(): "none" | "live" | "thread" | "preview" {
  if (window.self === window.top) return "none";
  const params = new URL(window.parent.location.href).searchParams;
  if (!params.has("component")) return "none";
  if (params.get("path") !== location.pathname + location.search) return "none";
  const view = params.get("component-view");
  return view === "thread" || view === "preview" ? view : "live";
}

/** Subscribes the app to openings without navigating or replacing its document. */
export function watchComponentView(changed: () => void): () => void {
  document.addEventListener(TREE_EVENT.focus, changed);
  return () => {
    document.removeEventListener(TREE_EVENT.focus, changed);
  };
}

/** Rendered component roots in page order, including those reached by scrolling, not hidden panes. */
export function componentTree(root: Element, skip: Element | null = null): ComponentNode[] {
  if (root === skip || root.matches("[data-retain][inert]")) return [];
  const children = [...root.children].flatMap((child) => componentTree(child, skip));
  const name = root.getAttribute("data-wb");
  return name && root.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    ? [{ element: root, name, children }]
    : children;
}

/** Groups Storybook's index by title, retaining its labels and order and omitting docs. */
export function storyTree(index: StoryIndex): StoryNode[] {
  const roots: StoryNode[] = [];
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== "story") continue;
    let children = roots;
    for (const name of entry.title.split("/")) {
      let branch = children.find((node) => node.kind === "branch" && node.name === name);
      if (branch === undefined) {
        branch = { kind: "branch", name, children: [] };
        children.push(branch);
      }
      if (branch.kind === "branch") children = branch.children;
    }
    children.push({ kind: "story", id: entry.id, name: entry.name });
  }
  return roots;
}
