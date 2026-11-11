import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@yaklabs/ui/components/resizable";
import { useIsMobile } from "@yaklabs/ui/hooks/use-mobile";
import { componentView, watchComponentView } from "@yaklabs/workbench/tree";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { trackHintLine } from "../components/divider";
import { MainCanvas } from "../components/main-canvas";
import { MockThread } from "../components/mock-thread";
import { ThreadPane } from "../components/thread-pane";
import { Welcome } from "../components/welcome";
import { BrowserPane } from "./browser-pane";
import { useShell, type Shell } from "./model";
import { SPLIT, viewOf, type PaneKind, type View } from "./state";

// The panel group's imperative handle, named through the ui primitive's own props so the app
// needs no direct dependency on the panel library.
type GroupRef = NonNullable<ComponentProps<typeof ResizablePanelGroup>["groupRef"]>;
type GroupHandle = GroupRef extends Ref<infer Handle> ? NonNullable<Handle> : never;

// The panels' shares for a pane. The thread alone fills the width; on a wide screen the browser
// or the canvas shares it with the thread, and on a phone it fills the width alone.
function layoutFor(pane: PaneKind, split: number, narrow: boolean): Record<string, number> {
  if (pane === "thread") return { thread: 100, side: 0 };
  return narrow ? { thread: 0, side: 100 } : { thread: split, side: 100 - split };
}

// The thread's share a drag left behind, or null when the drag closed either pane at its edge,
// which only the layout switch may do.
function keptSplit(layout: Record<string, number>): number | null {
  const sizes = new Map(Object.entries(layout)); // → Map<panel id, percent>
  const thread = sizes.get("thread");
  return thread === undefined || thread === 0 || sizes.get("side") === 0 ? null : thread;
}

/** The id of the tab panel that holds a main thread's workspace, for the tab that controls it. */
export function panelId(main: ThreadId): string {
  return `panel-${main}`;
}

// Whether something has been on screen at least once.
function useSeen(shown: boolean): boolean {
  const [seen, setSeen] = useState(shown);
  if (shown && !seen) setSeen(true);
  return seen || shown;
}

// Mounts its children the first time it is shown and keeps them until it goes. Hidden, they
// keep their state, scroll and running replies, take no input (inert), and skip rendering
// (content-visibility, from [data-retain][inert] in index.css), which keeps what display: none
// drops.
function Retain({
  shown,
  children,
  ...rest
}: { shown: boolean; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const seen = useSeen(shown);
  if (!seen) return null;
  return (
    <div {...rest} inert={!shown} data-retain="" className="min-h-0 min-w-0 [grid-area:1/1]">
      {children}
    </div>
  );
}

// The live thread has no frame of its own. Hidden on a phone while a side pane fills the
// width, it stays mounted but inert so replies and drafts survive the layout change.
function MainPane({
  thread,
  hidden,
  view,
}: {
  thread: ThreadSummary;
  hidden: boolean;
  view: View;
}) {
  const preview = view.mode !== undefined && view.pane === "thread";
  return (
    <div
      inert={hidden}
      data-retain=""
      className="grid h-full min-w-0"
      style={{ ["--thread-height" as string]: "100%" }}
    >
      <Retain shown={preview}>
        <MockThread />
      </Retain>
      <Retain shown={!preview} data-wb-live-thread={import.meta.env.DEV ? "" : undefined}>
        <ThreadPane key={thread.id} thread={thread} bare />
      </Retain>
    </div>
  );
}

// What a tab shows beside its thread.
type Beside = { shell: Shell; thread: ThreadSummary; view: View; focus: ThreadId | null };

// The browser and the canvas, each retained so a layout switch never stops a lane's reply.
function SidePanes({ shell, thread, view, focus }: Beside) {
  return (
    <>
      <Retain shown={view.pane === "browser"}>
        <BrowserPane shell={shell} main={thread.id} browser={view.browser} />
      </Retain>
      <Retain shown={view.pane === "canvas"}>
        <MainCanvas
          main={thread.id}
          workspace={shell.workspace}
          focus={focus}
          visit={shell.visitKey}
        />
      </Retain>
    </>
  );
}

// The panel group's handle, whether the screen is a phone's, and the step that lays the panels
// out as the view says; it runs whenever the view or the screen changes.
function usePlacement(view: View) {
  const group = useRef<GroupHandle>(null);
  const narrow = useIsMobile();
  const place = useCallback(() => {
    group.current?.setLayout(layoutFor(view.pane, view.split, narrow));
  }, [view.pane, view.split, narrow]);
  useEffect(() => {
    place();
  }, [place]);
  return {
    group,
    narrow,
    place,
    single: view.pane === "thread" || narrow,
    hideThread: narrow && view.pane !== "thread",
  };
}

// One tab's panes: the main thread, then a panel holding the browser and the canvas. The
// thread alone collapses that panel; the split is kept on release. On a phone one pane has the
// whole width, the one the layout switch names, and the other collapses. The panels' limits
// never change: the library takes new limits a render late, so a panel made collapsible in the
// render that collapses it refused to close and left a fifth of the tab blank. A drag can only
// close a pane by reaching its edge, and then the view's layout comes back, since the layout
// switch alone decides what is on screen.
function Workspace(beside: Beside) {
  const { shell, thread } = beside;
  const view: View = beside.focus === null ? { ...beside.view, pane: "thread" } : beside.view;
  const { group, narrow, place, single, hideThread } = usePlacement(view);
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full"
      groupRef={group}
      defaultLayout={layoutFor(view.pane, view.split, narrow)}
      onLayoutChanged={(layout, { isUserInteraction }) => {
        if (!isUserInteraction) return;
        const split = keptSplit(layout);
        if (split === null) place();
        else shell.setSplit(thread.id, split);
      }}
    >
      {/* Strings are percentages to the panel library; a bare number would be pixels. */}
      <ResizablePanel
        id="thread"
        minSize={`${SPLIT.min}`}
        collapsible
        collapsedSize="0"
        collapsedThreshold={`${SPLIT.min}`}
      >
        <MainPane thread={thread} hidden={hideThread} view={view} />
      </ResizablePanel>
      {/* Above the panes, so nothing positioned in them can cover its hit area. */}
      <ResizableHandle
        aria-label="Resize the thread and the pane beside it"
        disabled={single}
        className={single ? "hidden" : "drag-hint z-10"}
        onPointerMove={trackHintLine}
      />
      <ResizablePanel
        id="side"
        minSize={`${100 - SPLIT.max}`}
        collapsible
        collapsedSize="0"
        collapsedThreshold={`${100 - SPLIT.max}`}
        className="grid"
      >
        <SidePanes {...beside} view={view} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

// Product mode is separate from pane layout. Retaining both keeps mock edits and live drafts
// intact when switching, without writing synthetic messages into the device's thread history.
const noComponentView = () => "none" as const;
const subscribeComponent = import.meta.env.DEV ? watchComponentView : () => () => {};
const readComponent = import.meta.env.DEV ? componentView : noComponentView;

function useComponentView(props: Beside) {
  const { thread, view } = props;
  const opened = useSyncExternalStore(subscribeComponent, readComponent, noComponentView);
  const active = props.shell.active?.main;
  useEffect(() => {
    if (import.meta.env.DEV && active === thread.id)
      document.documentElement.dataset.wbMode = view.mode ?? "live";
  }, [active, thread.id, view.mode]);
  return {
    component: { none: view.mode === "component", preview: true, live: false, thread: false }[
      opened
    ],
    view: opened === "thread" ? { ...view, mode: undefined } : view,
  };
}

function DesignWorkspace(props: Beside) {
  const { thread, view } = props;
  const opened = useComponentView(props);
  if (view.mode === undefined && view.pane === "thread" && thread.turnCount === 0)
    return <Welcome thread={thread} />;
  return (
    <div className="grid h-full min-h-0" style={{ ["--thread-height" as string]: "100%" }}>
      <Retain shown={!opened.component}>
        <Workspace {...props} view={opened.view} />
      </Retain>
      <Retain shown={opened.component}>
        <section aria-label="Component mode" className="h-full min-h-0">
          <MockThread component />
        </section>
      </Retain>
    </div>
  );
}

/**
 * The open tabs, stacked in one grid cell: each is a tab panel named by its thread, mounted
 * the first time it is shown and kept until its tab closes, so replies, drafts and scroll
 * survive a switch. Only the URL's tab is on screen; the rest are inert.
 */
export function Deck() {
  const shell = useShell();
  if (shell === null) return null;
  const { active } = shell;
  return shell.tabs.map((thread) => {
    const shown = active?.main === thread.id;
    return (
      <Retain
        key={thread.id}
        shown={shown}
        id={panelId(thread.id)}
        role="tabpanel"
        aria-label={thread.title}
      >
        <DesignWorkspace
          shell={shell}
          thread={thread}
          view={viewOf(shell.doc, thread.id)}
          focus={shown ? active.focus : null}
        />
      </Retain>
    );
  });
}
