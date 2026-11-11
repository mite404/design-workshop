import {
  sidebarTree,
  type Located,
  type ProjectNode,
  type ThreadId,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@yaklabs/ui/components/sidebar";
import { Plus } from "lucide-react";
import { SidebarSection } from "@yaklabs/ui/components/sidebar-section";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { QuietButton } from "../components/quiet-button";
import { useRestart, useRuntimeState } from "../runtime";
import { useShell, type Shell } from "./model";
import { ThreadRowItem } from "./thread-row-menu";
import { ProjectButton, ThreadRow } from "./tree-rows";

// Fixed widths, so a loading screenshot is the same every time.
const SKELETON_WIDTHS = [168, 132, 150];

// The shelves below the projects, in display order. A main carries one mark at most
// (applyMark); if old data has both, Archived holds it.
type ShelfName = "Snoozed" | "Archived";
const SHELF_NAMES: ShelfName[] = ["Snoozed", "Archived"];

type Main = ProjectNode["mains"][number];

// Ids folded by hand: projects, and mains with their children. Nothing is folded at first.
type Folds = { folded: Set<string>; toggle: (id: string) => void };

// The clicked row and its stable tree container, retained until the action removes its button.
type RowAction = {
  button: HTMLButtonElement;
  tree: HTMLElement;
  href: string;
  controller: AbortController;
};

function useFolds(): Folds {
  const [folded, setFolded] = useState<Set<string>>(new Set());
  return {
    folded,
    toggle: (id) => {
      setFolded((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      });
    },
  };
}

// The shelf a main sits on, or null while it stays in its project.
function shelfOf(main: ThreadSummary): ShelfName | null {
  if (main.archivedAt !== null) return "Archived";
  if (main.snoozedUntil !== null) return "Snoozed";
  return null;
}

// The tree without its shelved mains, and each shelf's mains in project order, not by date.
function shelve(tree: ProjectNode[]): {
  live: ProjectNode[];
  shelves: { name: ShelfName; mains: Main[] }[];
} {
  const live = tree.map((node) => ({
    ...node,
    mains: node.mains.filter((each) => shelfOf(each.main) === null),
  })); // → ProjectNode[]
  const all = tree.flatMap((node) => node.mains); // → Main[]
  const shelves = SHELF_NAMES.map((name) => ({
    name,
    mains: all.filter((each) => shelfOf(each.main) === name),
  })); // → { name, mains }[]
  return { live, shelves };
}

// The thread the address names: a child, else its main.
function threadOn(active: Located | null): ThreadId | null {
  return active === null ? null : (active.focus ?? active.main);
}

// New project leaves with the empty tree it sat in, taking focus with it; once the thread it
// starts is open, its row takes focus, unless something else has taken it meanwhile. Returns
// what arms that hand-off.
function useHandOff(tree: RefObject<HTMLElement | null>, shell: Shell | null): () => void {
  const armed = useRef(false);
  const at = shell === null ? null : threadOn(shell.active); // → ThreadId | null
  useEffect(() => {
    if (!armed.current || at === null) return;
    armed.current = false;
    const row = tree.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (document.activeElement === document.body) row?.focus();
  }, [tree, at]);
  return () => {
    armed.current = true;
  };
}

// Only the clicked keyboard-focused action can request a hand-off, not another focused button.
function focusedAction(target: EventTarget): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLButtonElement>("button[data-thread-action]:focus-visible");
}

// Restore the row when visible, otherwise its destination's folded header.
function actionFocusTarget(action: RowAction, workspace: Workspace): HTMLElement | null {
  const row = Array.from(action.tree.querySelectorAll<HTMLAnchorElement>("a")).find(
    (link) => link.href === action.href,
  );
  const thread = workspace.threads.find((each) => each.id === action.button.dataset.threadAction);
  const section = thread === undefined ? "Projects" : (shelfOf(thread) ?? "Projects");
  const header = action.tree.querySelector<HTMLButtonElement>(`button[aria-label^="${section},"]`);
  return row ?? header;
}

// A row action can remove its own button or move its whole main to another shelf. Any
// intervening input cancels the hand-off, so a slow workspace update cannot steal focus back.
function useActionFocus(shell: Shell | null) {
  const workspace = shell?.workspace;
  const pending = useRef<RowAction | null>(null);
  const cancel = useCallback(() => {
    pending.current?.controller.abort();
    pending.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  useLayoutEffect(() => {
    const action = pending.current;
    if (action === null || workspace === undefined || action.button.isConnected) return;
    cancel();
    actionFocusTarget(action, workspace)?.focus();
  }, [cancel, workspace]);
  return (event: MouseEvent<HTMLElement>) => {
    const button = focusedAction(event.target);
    if (button === null) return;
    const link = button
      .closest('[data-sidebar="menu-item"]')
      ?.querySelector<HTMLAnchorElement>("a");
    if (!link) return;
    cancel();
    const controller = new AbortController();
    pending.current = { button, tree: event.currentTarget, href: link.href, controller };
    for (const type of ["pointerdown", "keydown", "focusin"]) {
      document.addEventListener(type, cancel, { capture: true, signal: controller.signal });
    }
  };
}

// A main thread and the children below it, folded by its own row's arrow when it has any. `at`
// is the thread the address names, which is marked.
function MainRows({
  node,
  at,
  folds,
  shell,
}: {
  node: Main;
  at: ThreadId | null;
  folds: Folds;
  shell: Shell;
}) {
  const { main, children } = node;
  const open = !folds.folded.has(main.id);
  const hasChildren = children.length > 0;
  return (
    <>
      <ThreadRowItem shell={shell} thread={main}>
        <ThreadRow
          thread={main}
          active={at === main.id}
          kind="main"
          fold={
            hasChildren
              ? {
                  open,
                  count: children.length,
                  onToggle: () => {
                    folds.toggle(main.id);
                  },
                }
              : undefined
          }
        />
      </ThreadRowItem>
      {open &&
        children.map((thread) => (
          <ThreadRowItem key={thread.id} shell={shell} thread={thread}>
            <ThreadRow thread={thread} active={at === thread.id} kind="child" />
          </ThreadRowItem>
        ))}
    </>
  );
}

// A project and its main threads; the "+" at its right starts a main thread in it.
function ProjectRows({ node, shell, folds }: { node: ProjectNode; shell: Shell; folds: Folds }) {
  const { project, mains } = node;
  const open = !folds.folded.has(project.id);
  return (
    <SidebarMenuItem data-guide-target={project.id}>
      <ProjectButton
        name={project.name}
        open={open}
        onToggle={() => {
          folds.toggle(project.id);
        }}
      />
      <SidebarMenuAction
        aria-label={`New thread in ${project.name}`}
        className="top-1.5 rounded-[var(--radius)] text-soft-ink hover:text-ink"
        onClick={() => {
          shell.newThread(project.id);
        }}
      >
        <Plus />
      </SidebarMenuAction>
      {open && (
        <SidebarMenu className="mt-0.5">
          {mains.map((each) => (
            <MainRows
              key={each.main.id}
              node={each}
              at={threadOn(shell.active)}
              folds={folds}
              shell={shell}
            />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  );
}

// What the tree says before the workspace arrives: rows on their way, another tab that has
// them, or a failed start.
function Unready() {
  const state = useRuntimeState();
  const restart = useRestart();
  if (state.kind === "held") {
    return <p className="px-2 py-1 text-sm text-soft-ink">Open in another tab.</p>;
  }
  if (state.kind !== "broken") {
    return SKELETON_WIDTHS.map((width) => <SidebarMenuSkeleton key={width} width={width} />);
  }
  return (
    <div className="flex flex-col items-start gap-2 px-2 py-1 text-sm">
      <p className="text-soft-ink">Your threads could not be opened.</p>
      {restart && <QuietButton onClick={restart}>Try again</QuietButton>}
    </div>
  );
}

// What the tree says while there is no tree: why the workspace has not arrived, or nothing yet.
function TreeState({ shell, onNewProject }: { shell: Shell | null; onNewProject: () => void }) {
  if (shell === null) return <Unready />;
  return (
    <div className="flex flex-col items-start gap-2 px-2 py-1 text-sm">
      <p className="text-soft-ink">No projects yet</p>
      <QuietButton
        onClick={() => {
          onNewProject();
          shell.newProject();
        }}
      >
        New project
      </QuietButton>
    </div>
  );
}

/**
 * The projects, their main threads and each main's children (ADR-092, ADR-093), newest main
 * first and each main's children newest first, both by creation (ADR-125). Rows open threads by
 * address; the URL's thread is marked. Snoozed and archived mains leave their projects for the
 * Snoozed and Archived shelves below them; Projects and each shelf fold as a
 * {@link SidebarSection}. It fills the projects panel beside the rail (ADR-144).
 */
export function ProjectTree() {
  const shell = useShell();
  const folds = useFolds();
  const group = useRef<HTMLDivElement>(null);
  const handOff = useHandOff(group, shell);
  const actionFocus = useActionFocus(shell);
  const tree = shell === null ? [] : sidebarTree(shell.workspace);
  const { live, shelves } = shelve(tree);
  return (
    <SidebarGroup ref={group} onClickCapture={actionFocus}>
      {shell === null || tree.length === 0 ? (
        <SidebarSection label="Projects" count={0} defaultOpen>
          <TreeState shell={shell} onNewProject={handOff} />
        </SidebarSection>
      ) : (
        <>
          <SidebarSection label="Projects" count={live.length} defaultOpen>
            <SidebarMenu className="gap-2">
              {live.map((node) => (
                <ProjectRows key={node.project.id} node={node} shell={shell} folds={folds} />
              ))}
            </SidebarMenu>
          </SidebarSection>
          {shelves.map(({ name, mains }) => (
            <SidebarSection key={name} label={name} count={mains.length} className="mt-2">
              <SidebarMenu>
                {mains.map((each) => (
                  <MainRows
                    key={each.main.id}
                    node={each}
                    at={threadOn(shell.active)}
                    folds={folds}
                    shell={shell}
                  />
                ))}
              </SidebarMenu>
            </SidebarSection>
          ))}
        </>
      )}
    </SidebarGroup>
  );
}
