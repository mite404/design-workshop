import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@yaklabs/ui/components/sidebar";
import { FoldChevron, SidebarSection } from "@yaklabs/ui/components/sidebar-section";
import { componentTree, DRAWER, TREE_EVENT, type ComponentNode } from "@yaklabs/workbench/tree";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShell } from "./model";
import StoryTree from "./story-tree";

const NAMED = "[data-wb]";
const ids = new WeakMap<Element, number>();
let nextId = 0;

function keyOf(element: Element): number {
  let id = ids.get(element);
  if (id === undefined) {
    id = nextId++;
    ids.set(element, id);
  }
  return id;
}

function announce(type: string, element: Element | null): void {
  document.dispatchEvent(new CustomEvent(type, { detail: element }));
}

function focusRow(row: HTMLElement | null | undefined): void {
  row?.focus({ preventScroll: true });
  row?.querySelector("[data-label]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function hasRow(nodes: ComponentNode[], element: Element | null): boolean {
  return nodes.some((node) => node.element === element || hasRow(node.children, element));
}

/** The development-only drawer tree, read from the canvas document rather than React internals. */
export default function ComponentTree() {
  const shell = useShell();
  const [nodes, setNodes] = useState(() =>
    componentTree(document.body, document.querySelector(DRAWER)),
  );
  const [selected, setSelected] = useState<Element | null>(null);
  const [focused, setFocused] = useState<Element | null>(null);
  // Rows the user opened or shut; others show only the top-level groups open.
  const [choices, setChoices] = useState(new Map<Element, boolean>());
  const tree = useRef<HTMLUListElement>(null);
  const rows = useRef(new Map<Element, HTMLLIElement>());
  const { open, openMobile, isMobile } = useSidebar();
  const visible = isMobile ? openMobile : open;

  useEffect(() => {
    const rebuild = () => {
      setNodes(componentTree(document.body, document.querySelector(DRAWER)));
    };
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) => {
          const element =
            record.target instanceof Element ? record.target : record.target.parentElement;
          return !element?.closest(DRAWER);
        })
      )
        rebuild();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-wb", "inert", "hidden", "class", "style", "open"],
    });
    window.addEventListener("resize", rebuild);
    const follow = (event: Event) => {
      if (!("detail" in event)) return;
      const element: unknown = event.detail;
      if (element === null || element instanceof Element) {
        const component = element?.closest(NAMED) ?? null;
        setSelected(component);
        setChoices((current) => {
          const next = new Map(current);
          for (
            let a = component?.parentElement?.closest(NAMED);
            a;
            a = a.parentElement?.closest(NAMED)
          )
            next.set(a, true);
          return next;
        });
      }
    };
    document.addEventListener(TREE_EVENT.selected, follow);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", rebuild);
      document.removeEventListener(TREE_EVENT.selected, follow);
      announce(TREE_EVENT.hover, null);
    };
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (visible && selected !== null)
        rows.current
          .get(selected)
          ?.querySelector("[data-label]")
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selected, visible]);

  const isOpen = (element: Element, depth: number) => choices.get(element) ?? depth === 0;

  function toggle(element: Element, expanded: boolean): void {
    setChoices((current) => new Map(current).set(element, !expanded));
  }

  function choose(element: Element): void {
    announce(TREE_EVENT.select, element);
    if (shell?.active) shell.setMode(shell.active.main, "component");
  }

  function branchKey(key: string, node: ComponentNode, row: HTMLLIElement, expanded: boolean) {
    if (key === "ArrowRight") {
      if (node.children.length === 0) return;
      if (!expanded) toggle(node.element, expanded);
      else focusRow(row.querySelector<HTMLLIElement>('[role="treeitem"]'));
    } else if (node.children.length > 0 && expanded) toggle(node.element, expanded);
    else focusRow(row.parentElement?.closest<HTMLElement>('[role="treeitem"]'));
  }

  function keys(event: KeyboardEvent<HTMLLIElement>, node: ComponentNode, expanded: boolean): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const row = event.currentTarget;
    const all = [...(tree.current?.querySelectorAll<HTMLLIElement>('[role="treeitem"]') ?? [])];
    const index = all.indexOf(row);
    const positions: Partial<Record<string, number>> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: all.length - 1,
    };
    const position = positions[event.key];
    if (position === undefined && !["ArrowRight", "ArrowLeft", "Enter", " "].includes(event.key))
      return;
    event.stopPropagation();
    event.preventDefault();
    if (position !== undefined) {
      focusRow(all[position]);
      return;
    }
    if (["ArrowRight", "ArrowLeft"].includes(event.key)) {
      branchKey(event.key, node, row, expanded);
    } else {
      choose(node.element);
    }
  }

  const tabStop = hasRow(nodes, focused) ? focused : nodes[0]?.element;

  function renderNodes(items: ComponentNode[], depth = 0) {
    return items.map((node) => {
      const expanded = isOpen(node.element, depth);
      const active = selected === node.element;
      return (
        <SidebarMenuItem
          key={keyOf(node.element)}
          ref={(row) => {
            if (row) rows.current.set(node.element, row);
            else rows.current.delete(node.element);
          }}
          role="treeitem"
          aria-label={node.name}
          aria-selected={active}
          aria-expanded={node.children.length > 0 ? expanded : undefined}
          tabIndex={tabStop === node.element ? 0 : -1}
          className="outline-hidden"
          onKeyDown={(event) => keys(event, node, expanded)}
          onFocus={(event) => {
            if (event.target === event.currentTarget) setFocused(node.element);
          }}
        >
          <SidebarMenuButton
            render={<div />}
            isActive={active}
            className="group/fold h-8 rounded-[var(--radius)] text-sm text-ink [li:focus-visible>&]:ring-2 [li:focus-visible>&]:ring-inset [li:focus-visible>&]:ring-sidebar-ring"
            style={{ paddingLeft: 8 + depth * 16, minWidth: 168 + depth * 16 }}
            onClick={() => {
              focusRow(rows.current.get(node.element));
              choose(node.element);
            }}
            onPointerEnter={() => announce(TREE_EVENT.hover, node.element)}
            onPointerLeave={() => announce(TREE_EVENT.hover, null)}
          >
            <span data-label="" title={node.name} className="mr-auto min-w-0 truncate">
              {node.name}
            </span>
            {node.children.length > 0 && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius)] border-0 bg-transparent p-0 text-soft-ink hover:bg-sidebar-accent"
                onClick={(event) => {
                  event.stopPropagation();
                  focusRow(rows.current.get(node.element));
                  toggle(node.element, expanded);
                }}
              >
                <FoldChevron open={expanded} />
              </button>
            )}
          </SidebarMenuButton>
          {expanded && node.children.length > 0 && (
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ARIA tree children require a group inside their treeitem, not a fieldset or details
            <SidebarMenu role="group">{renderNodes(node.children, depth + 1)}</SidebarMenu>
          )}
        </SidebarMenuItem>
      );
    });
  }

  return (
    <>
      <SidebarGroup>
        <SidebarSection label="Components" count={0} defaultOpen>
          <SidebarMenu ref={tree} role="tree" aria-label="Components">
            {renderNodes(nodes)}
          </SidebarMenu>
        </SidebarSection>
      </SidebarGroup>
      <StoryTree />
    </>
  );
}
