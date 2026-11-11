import type { ThreadSummary } from "@yaklabs/runtime";
import { ContextMenu, ContextMenuTrigger } from "@yaklabs/ui/components/context-menu";
import { SidebarMenuItem } from "@yaklabs/ui/components/sidebar";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { inBackground, useRuntime } from "../runtime";
import type { Shell } from "./model";
import { ThreadActionsContent } from "./thread-actions-menu";
import { rowLook } from "./row-marks";
import { ChildIcon, Marks } from "./tree-rows";

// A row whose right-click menu is open keeps its hover fill, so the menu shows which thread it
// acts on. The fill goes on a plain row's button, or on a foldable main's own row.
const MENU_OPEN =
  "[&[data-popup-open]_:is([data-sidebar=menu-button],[data-slot=thread-row])]:bg-sidebar-accent [&[data-popup-open]_:is([data-sidebar=menu-button],[data-slot=thread-row])]:text-sidebar-accent-foreground";

// The title in place, in the row's own box, keeping the row's marks and a child's branch. Enter
// or leaving the field keeps what was typed, and Escape keeps the old title. Every way out goes
// through the blur, so the field is never torn down inside the key event that closed it.
function RowTitleField({
  thread,
  field,
  onDone,
}: {
  thread: ThreadSummary;
  field: RefObject<HTMLInputElement | null>;
  onDone: (typed: string | null, byKey: boolean) => void;
}) {
  const exit = useRef<"blur" | "enter" | "escape">("blur");
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, [field]);
  const child = thread.place.kind === "child";
  return (
    <div className="relative flex items-center">
      <Marks marks={rowLook(thread).marks} />
      {child && (
        <span className="pointer-events-none absolute left-6 [&_svg]:size-4">
          <ChildIcon />
        </span>
      )}
      <input
        ref={field}
        aria-label="Thread title"
        defaultValue={thread.title}
        className={`h-8 w-full rounded-[var(--radius)] border-0 bg-sidebar-accent pr-2 text-sm text-ink focus:outline-2 focus:-outline-offset-2 focus:outline-[var(--focus)] ${child ? "pl-12" : "pl-6"}`}
        onBlur={(event) => {
          const { current } = exit;
          onDone(current === "escape" ? null : event.currentTarget.value, current !== "blur");
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key !== "Enter" && event.key !== "Escape") return;
          exit.current = event.key === "Enter" ? "enter" : "escape";
          event.currentTarget.blur();
        }}
      />
    </div>
  );
}

// A name that is empty or the one the thread has changes nothing. Leaving the field by a key
// puts the focus back on the row's link once the field has gone, instead of on the page.
function useRowRename(thread: ThreadSummary) {
  const runtime = useRuntime();
  const [renaming, setRenaming] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const item = useRef<HTMLLIElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (renaming || !refocus.current) return;
    refocus.current = false;
    item.current?.querySelector<HTMLElement>("a")?.focus();
  }, [renaming]);
  const done = (typed: string | null, byKey: boolean) => {
    const title = typed?.trim() ?? ""; // → the new name, "" when dropped
    if (title !== "" && title !== thread.title) {
      inBackground(runtime.rename({ kind: "thread", id: thread.id }, title), "Renaming");
    }
    refocus.current = byKey;
    setRenaming(false);
  };
  const start = () => {
    setRenaming(true);
  };
  return { renaming, start, field, item, done };
}

/**
 * A sidebar thread row's list item. A right-click on it opens the thread menu at the pointer,
 * the same menu as the thread's "⋯" (ADR-126). Rename opens the row's title as a field, and the
 * menu hands its focus to that field. Snooze opens the thread first, where its card shows.
 */
export function ThreadRowItem({
  shell,
  thread,
  children,
}: {
  shell: Shell;
  thread: ThreadSummary;
  children: ReactNode;
}) {
  const { renaming, start, field, item, done } = useRowRename(thread);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<SidebarMenuItem ref={item} className={`group/thread ${MENU_OPEN}`} />}
      >
        {renaming ? <RowTitleField thread={thread} field={field} onDone={done} /> : children}
      </ContextMenuTrigger>
      <ThreadActionsContent
        shell={shell}
        thread={thread}
        align="start"
        finalFocus={() => field.current ?? true}
        onRename={start}
        beforeSnooze={() => {
          shell.open(thread.id);
        }}
      />
    </ContextMenu>
  );
}
