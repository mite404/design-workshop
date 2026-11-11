import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import { AgentTree } from "@yaklabs/catalog";
import { ChildThreadIcon } from "@yaklabs/catalog/icons";
import { SidebarMenuButton } from "@yaklabs/ui/components/sidebar";
import { FoldChevron } from "@yaklabs/ui/components/sidebar-section";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { Archive, ArchiveRestore, Pin, PinOff, type LucideIcon } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import { usePaths, useRuntimeState } from "../runtime";
import { useShell } from "./model";
import { rowLook, type Mark, type RowLook } from "./row-marks";
import { useLabelCut } from "./label-cut";
import { isWorking } from "./working";

// A row: the hover fill stays inside the sidebar's padding, with the site's 4px corners.
const ROW = "h-8 rounded-[var(--radius)] text-sm";

// A project's threads sit one step in under its name, so the name reads as the label of the
// group below it. The fill still spans the row; only the words move in. A child's branch icon
// stands where its main's title starts, and its own title one step further in. The right keeps the
// 8px every row has, so a long title or a fold arrow stops short of the fill's edge. `relative`
// is what the row's marks hang from.
const THREAD_ROW = `${ROW} relative pl-6 pr-2`;

// shadcn leaves room at a row's right end when its item holds an action. The project's "+"
// shares its item with the project's threads, so that room reaches every thread row, though
// none of them holds an action of its own; each takes it back for its title.
const NO_ACTION = "group-has-data-[sidebar=menu-action]/menu-item:pr-2";

// Only a pin occupies the left gutter; archive and snooze remain in the row's spoken status.
const MARKS = "absolute inset-y-0 left-1 flex w-3.5 flex-col items-center justify-center";

/** The pinned marker at the row's left; other marks remain screen-reader status only. */
export function Marks({ marks }: { marks: Mark[] }) {
  if (!marks.includes("pinned")) return null;
  return (
    <span
      aria-hidden="true"
      className={`${MARKS} group-hover/thread:opacity-0 group-has-focus-visible/thread:opacity-0`}
    >
      <Pin data-mark="pinned" className="size-3.5! shrink-0" />
    </span>
  );
}

// How many threads a fold holds, as its button names them: "2 threads", "1 thread".
const threadCount = (count: number): string => `${count} ${count === 1 ? "thread" : "threads"}`;

// A row's own title, cut to whatever room its row leaves it and faded out at the cut (index.css,
// `useLabelCut`). `block` matters here: as a flex item's child it would otherwise stay inline
// and ignore that width.
const LABEL = "block overflow-hidden whitespace-nowrap";

// Whether the row's label is cut short, so its tooltip has something to add.
function isCut(row: Element | undefined): boolean {
  const label = row?.querySelector("[data-label]") ?? null;
  return label !== null && label.scrollWidth > label.clientWidth;
}

// A row whose label may be cut short: the whole name shows beside it, and only when it is cut,
// unless `always` (a snoozed row, whose tooltip says when it wakes). The cut is measured as the
// tooltip asks to open, so the first hover and a keyboard focus count as much as a second hover.
function Named({
  name,
  row,
  always = false,
}: {
  name: string;
  row: ReactElement;
  always?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next, { trigger }) => {
        setOpen(next && (always || isCut(trigger)));
      }}
    >
      <TooltipTrigger render={row} />
      <TooltipContent side="right" className="max-w-80 whitespace-normal wrap-anywhere">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

/** A child's branch, where its main's title starts; the row's title names it. */
export function ChildIcon(): ReactElement {
  return (
    <span data-slot="child-icon" aria-hidden="true" className="flex shrink-0 text-soft-ink">
      <ChildThreadIcon />
    </span>
  );
}

// Whether a thread's row shows the working glyph, read from the runtime's own live state.
function useWorking(threadId: ThreadId): boolean {
  return isWorking(useRuntimeState(), threadId);
}

// A row's words after a child's branch icon: its marks (which hang in the gutter, out of the
// flow), the working glyph while its reply is in flight, its title, and the marks as a screen
// reader hears them.
function RowWords({ thread, look }: { thread: ThreadSummary; look: RowLook }): ReactElement {
  const working = useWorking(thread.id);
  const label = useLabelCut();
  return (
    <>
      <Marks marks={look.marks} />
      {working && <AgentTree label={`${thread.title} is working`} />}
      <span ref={label} data-label="" className={LABEL}>
        {thread.title}
      </span>
      <span className="sr-only">{look.spoken}</span>
    </>
  );
}

// The fold arrow's own button on a main's row, named by how many threads it hides or shows.
// `relative z-10` lifts it over the row's stretched link, so it still receives its own clicks.
function FoldButton({
  open,
  count,
  title,
  onToggle,
}: {
  open: boolean;
  count: number;
  title: string;
  onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} the ${threadCount(count)} in ${title}`}
      onClick={onToggle}
      className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius)] border-0 bg-transparent p-0 text-soft-ink outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
    >
      <FoldChevron open={open} />
    </button>
  );
}

function ThreadAction({
  thread,
  label,
  Icon,
  onClick,
  className,
}: {
  thread: ThreadSummary;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  className: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`${label} ${thread.title}`}
            data-thread-action={thread.id}
            onClick={onClick}
            className={`flex shrink-0 items-center justify-center rounded-[var(--radius)] border-0 bg-transparent p-0 text-soft-ink outline-hidden ring-sidebar-ring hover:text-ink focus-visible:ring-2 ${className}`}
          />
        }
      >
        <Icon className="size-3.5! shrink-0" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top">{label} thread</TooltipContent>
    </Tooltip>
  );
}

// Hover actions belong to this row, not the open thread. Keyboard focus reveals them too;
// touch keeps the existing context menu rather than showing permanent buttons.
function ThreadButtons({ thread, inline = false }: { thread: ThreadSummary; inline?: boolean }) {
  const shell = useShell();
  if (shell === null) return null;
  const pinned = thread.pinnedAt !== null;
  const archived = thread.archivedAt !== null;
  return (
    <>
      {pinned && (
        <ThreadAction
          thread={thread}
          label="Unpin"
          Icon={PinOff}
          onClick={() => {
            shell.pin(thread.id, false);
          }}
          className="pointer-events-none absolute inset-y-0 left-1 z-10 w-3.5 opacity-0 after:absolute after:inset-y-1 after:-inset-x-1.5 group-hover/thread:pointer-events-auto group-hover/thread:opacity-100 group-has-focus-visible/thread:pointer-events-auto group-has-focus-visible/thread:opacity-100"
        />
      )}
      <div
        data-slot="thread-buttons"
        className={`${inline ? `relative w-0 shrink-0 ${pinned ? "group-hover/thread:w-6 group-has-focus-visible/thread:w-6" : "group-hover/thread:w-12 group-has-focus-visible/thread:w-12"}` : "absolute top-1 right-1"} pointer-events-none z-10 flex opacity-0 group-hover/thread:pointer-events-auto group-hover/thread:opacity-100 group-has-focus-visible/thread:pointer-events-auto group-has-focus-visible/thread:opacity-100`}
      >
        {!pinned && (
          <ThreadAction
            thread={thread}
            label="Pin"
            Icon={Pin}
            onClick={() => {
              shell.pin(thread.id, true);
            }}
            className="size-6 hover:bg-paper-deep"
          />
        )}
        <ThreadAction
          thread={thread}
          label={archived ? "Unarchive" : "Archive"}
          Icon={archived ? ArchiveRestore : Archive}
          onClick={() => {
            shell.archive(thread.id, !archived);
          }}
          className="size-6 hover:bg-paper-deep"
        />
      </div>
    </>
  );
}

/**
 * A main thread with sub-threads: the stretched-link pattern (Bootstrap's recipe), so a click
 * anywhere on the row still opens the thread while a separate button folds the children, and
 * the number of children sits at the row's far right, read only, since the button names it. The
 * link stays un-positioned and sized to its title; its `::after` is what stretches, to the
 * row's own edges, since that is the nearest positioned ancestor. The button sits after the
 * title in flow, lifted above that layer by its own stacking context (`relative z-10`) so it
 * still receives its own clicks.
 */
function FoldableMainRow({
  thread,
  active,
  open,
  count,
  onToggle,
}: {
  thread: ThreadSummary;
  active: boolean;
  open: boolean;
  count: number;
  onToggle: () => void;
}): ReactElement {
  const { pathTo } = usePaths();
  const look = rowLook(thread);
  return (
    <Named
      name={look.tooltip}
      always={look.alwaysTip}
      row={
        <div
          data-slot="thread-row"
          data-active={active || undefined}
          className={`${THREAD_ROW} group/fold flex items-center gap-2 ${look.ink} hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-ink`}
        >
          <Link
            to={pathTo(thread.id)}
            aria-current={active ? "page" : undefined}
            data-thread="main"
            className="flex min-w-0 flex-1 items-center gap-2 text-inherit outline-hidden after:absolute after:inset-0 after:rounded-[var(--radius)] focus-visible:after:ring-2 focus-visible:after:ring-sidebar-ring"
          >
            <RowWords thread={thread} look={look} />
          </Link>
          <ThreadButtons thread={thread} inline />
          <FoldButton open={open} count={count} title={thread.title} onToggle={onToggle} />
          <span
            data-slot="thread-count"
            aria-hidden="true"
            className="ml-auto shrink-0 text-xs text-soft-ink tabular-nums"
          >
            {count}
          </span>
        </div>
      }
    />
  );
}

/**
 * A thread row: a link named by its title, indented under its project. A main with sub-threads
 * takes `fold`, with how many it holds, and becomes a {@link FoldableMainRow} instead; a child
 * shows a branch icon before its title, one step further in than its main. Only pinned threads
 * get a left-gutter marker, which becomes Unpin on hover or keyboard focus. Unpinned rows offer
 * Pin at the right, beside Archive/Unarchive. Archived rows stay dimmed until open.
 */
export function ThreadRow({
  thread,
  active,
  kind,
  fold,
}: {
  thread: ThreadSummary;
  active: boolean;
  kind: "main" | "child";
  fold?: { open: boolean; count: number; onToggle: () => void };
}): ReactElement {
  const { pathTo } = usePaths();
  if (fold) {
    return (
      <FoldableMainRow
        thread={thread}
        active={active}
        open={fold.open}
        count={fold.count}
        onToggle={fold.onToggle}
      />
    );
  }
  const look = rowLook(thread);
  return (
    <>
      <Named
        name={look.tooltip}
        always={look.alwaysTip}
        row={
          <SidebarMenuButton
            render={<Link to={pathTo(thread.id)} />}
            isActive={active}
            aria-current={active ? "page" : undefined}
            data-thread={kind}
            className={`${THREAD_ROW} ${NO_ACTION} ${look.ink} data-active:text-ink group-hover/thread:pr-14! group-has-focus-visible/thread:pr-14!`}
          >
            {kind === "child" && <ChildIcon />}
            <RowWords thread={thread} look={look} />
          </SidebarMenuButton>
        }
      />
      <ThreadButtons thread={thread} />
    </>
  );
}

/**
 * The project's own row, the label of the group below it: "name >" folded; open, no chevron at
 * rest and a down chevron while the pointer is on the row.
 */
export function ProjectButton({
  name,
  open,
  onToggle,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const label = useLabelCut();
  return (
    <Named
      name={name}
      row={
        <SidebarMenuButton
          aria-expanded={open}
          className={`${ROW} group/fold text-ink`}
          onClick={onToggle}
        >
          <span ref={label} data-label="" className="min-w-0 overflow-hidden whitespace-nowrap">
            {name}
          </span>
          <FoldChevron open={open} />
        </SidebarMenuButton>
      }
    />
  );
}
