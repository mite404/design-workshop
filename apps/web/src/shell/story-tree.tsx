import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@yaklabs/ui/components/sidebar";
import { FoldChevron, SidebarSection } from "@yaklabs/ui/components/sidebar-section";
import {
  storyTree,
  storyView,
  TREE_EVENT,
  watchComponentView,
  type StoryNode,
} from "design-workshop/tree";
import { useEffect, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { z } from "zod";
import { useShell } from "./model";

const indexSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      type: z.enum(["story", "docs"]),
      id: z.string(),
      title: z.string(),
      name: z.string(),
    }),
  ),
});
type IndexState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; nodes: StoryNode[] };
const noStory = () => null;
const isComponent = () => document.documentElement.dataset.wbMode === "component";
const notComponent = () => false;

function watchMode(changed: () => void): () => void {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-wb-mode"],
  });
  return () => observer.disconnect();
}

function focus(row: Element | null | undefined): void {
  if (row instanceof HTMLElement) {
    row.focus({ preventScroll: true });
    row.querySelector("[data-label]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function navigate(row: Element, rows: Element[], key: string): void {
  const at = rows.indexOf(row);
  const positions: Record<string, number> = {
    ArrowDown: at + 1,
    ArrowUp: at - 1,
    Home: 0,
    End: rows.length - 1,
  };
  const button = row.querySelector<HTMLElement>('[data-sidebar="menu-button"]');
  if (key in positions) {
    focus(rows[positions[key] ?? -1]);
    return;
  }
  if (key === "ArrowRight") {
    if (row.getAttribute("aria-expanded") === "false") button?.click();
    else focus(row.querySelector('[role="treeitem"]'));
  } else if (key === "ArrowLeft") {
    if (row.getAttribute("aria-expanded") === "true") button?.click();
    else focus(row.parentElement?.closest('[role="treeitem"]'));
  } else button?.click();
}

function keys(event: KeyboardEvent<HTMLUListElement>): void {
  if (
    !["ArrowDown", "ArrowUp", "Home", "End", "ArrowRight", "ArrowLeft", "Enter", " "].includes(
      event.key,
    )
  )
    return;
  const row = event.target instanceof Element ? event.target.closest('[role="treeitem"]') : null;
  if (row === null || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  event.stopPropagation();
  navigate(row, [...event.currentTarget.querySelectorAll('[role="treeitem"]')], event.key);
}

/** Storybook's development-only index, below the rendered component tree. */
export default function StoryTree() {
  const shell = useShell();
  const enabled = useSyncExternalStore(watchMode, isComponent, notComponent);
  const selected = useSyncExternalStore(watchComponentView, storyView, noStory);
  const [index, setIndex] = useState<IndexState>({ kind: "loading" });
  const [expanded, setExpanded] = useState(new Set<string>());
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/__stories/index.json", { signal: controller.signal });
        if (!response.ok) throw new Error("Storybook index unavailable");
        const raw: unknown = await response.json();
        const nodes = storyTree(indexSchema.parse(raw));
        if (!controller.signal.aborted) setIndex({ kind: "ready", nodes });
      } catch {
        if (!controller.signal.aborted) setIndex({ kind: "unavailable" });
      }
    })();
    return () => controller.abort();
  }, [enabled]);

  function activate(node: StoryNode, key: string): void {
    if (node.kind === "branch") {
      setExpanded((current) => {
        const next = new Set(current);
        if (!next.delete(key)) next.add(key);
        return next;
      });
      return;
    }
    document.dispatchEvent(new CustomEvent(TREE_EVENT.story, { detail: node.id }));
    if (shell?.active) shell.setMode(shell.active.main, "component");
  }

  const tabStop = focused ?? (index.kind === "ready" ? `/${index.nodes[0]?.name}` : null);
  function render(nodes: StoryNode[], parent = "", depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const key = `${parent}/${node.name}`;
      const branch = node.kind === "branch";
      const open = expanded.has(key);
      const active = node.kind === "story" && selected === node.id;
      return (
        <SidebarMenuItem
          key={key}
          role="treeitem"
          aria-label={node.name}
          aria-selected={active}
          aria-expanded={branch ? open : undefined}
          tabIndex={tabStop === key ? 0 : -1}
          className="outline-hidden"
          onFocus={(event) => {
            if (event.target === event.currentTarget) setFocused(key);
          }}
        >
          <SidebarMenuButton
            render={<div />}
            isActive={active}
            className="group/fold h-8 rounded-[var(--radius)] text-sm text-ink [li:focus-visible>&]:ring-2 [li:focus-visible>&]:ring-inset [li:focus-visible>&]:ring-sidebar-ring"
            style={{ paddingLeft: 8 + depth * 16, minWidth: 168 + depth * 16 }}
            onClick={(event) => {
              focus(event.currentTarget.closest('[role="treeitem"]'));
              activate(node, key);
            }}
          >
            <span data-label="" title={node.name} className="mr-auto min-w-0 truncate">
              {node.name}
            </span>
            {branch && (
              <span className="flex size-5 shrink-0 items-center justify-center text-soft-ink">
                <FoldChevron open={open} />
              </span>
            )}
          </SidebarMenuButton>
          {branch && open && (
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ARIA tree descendants are a group, not a fieldset
            <SidebarMenu role="group">{render(node.children, key, depth + 1)}</SidebarMenu>
          )}
        </SidebarMenuItem>
      );
    });
  }

  if (!enabled) return null;
  return (
    <SidebarGroup>
      <SidebarSection label="Stories" count={0} defaultOpen>
        {index.kind === "unavailable" ? (
          <output className="px-2 py-1 text-sm text-soft-ink">
            Storybook is not running. Start it with <code>pnpm storybook</code>.
          </output>
        ) : index.kind === "loading" ? (
          <output className="px-2 py-1 text-sm text-soft-ink">Loading stories…</output>
        ) : (
          <SidebarMenu role="tree" aria-label="Stories" onKeyDown={keys}>
            {render(index.nodes)}
          </SidebarMenu>
        )}
      </SidebarSection>
    </SidebarGroup>
  );
}
