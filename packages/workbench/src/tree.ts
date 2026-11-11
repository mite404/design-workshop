// Named DOM roots, retaining instance identity rather than treating a name as a unique key.
export type ComponentNode = { element: Element; name: string; children: ComponentNode[] };

/** The Template's drawer, excluded from its own component tree. */
export const DRAWER = '[data-slot="sidebar"]';

/** Same-origin document events shared by the Template and Workbench. */
export const TREE_EVENT = {
  select: "workbench:select",
  selected: "workbench:selected",
  hover: "workbench:hover",
} as const;

/** Component roots in page order, omitting the drawer and the app's retained off-screen panes. */
export function componentTree(root: Element, skip: Element | null = null): ComponentNode[] {
  if (root === skip || root.matches("[data-retain][inert]")) return [];
  const children = [...root.children].flatMap((child) => componentTree(child, skip));
  const name = root.getAttribute("data-wb");
  return name ? [{ element: root, name, children }] : children;
}
