import type { ThreadId } from "@yaklabs/runtime";
import { ToggleGroup, ToggleGroupItem } from "@yaklabs/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { LAYOUTS, PANES, paneAfterPress } from "./layouts";
import type { Shell } from "./model";
import { viewOf, type PaneKind } from "./state";

// The tab on screen and what sits beside its thread, or null with no tab on screen.
function shownPane(shell: Shell): { main: ThreadId; pane: PaneKind } | null {
  if (shell.active === null) return null;
  const { main } = shell.active;
  const view = viewOf(shell.doc, main);
  return {
    main,
    pane: view.mode === "component" ? "browser" : "thread",
  };
}

/**
 * Live mode or Component mode. The browser glyph selects the component
 * preview, not the legacy simulated browser pane. Nothing to switch with no tab. On a
 * phone it is the bar's second row, each view named in words, and it scrolls when they overflow
 * (ADR-116).
 */
export function LayoutSwitch({ shell }: { shell: Shell | null }) {
  const shown = shell === null ? null : shownPane(shell);
  return (
    <ToggleGroup
      aria-label="Layout"
      spacing={0.5}
      value={shown === null ? [] : [shown.pane]}
      disabled={shown === null}
      onValueChange={
        shown === null
          ? undefined
          : (values: unknown[]) => {
              const next = paneAfterPress(values); // → PaneKind
              shell?.setMode(shown.main, next === "browser" ? "component" : "live");
            }
      }
      className="rounded-[var(--radius)] border border-hairline p-0.5 max-md:no-scrollbar max-md:col-span-full max-md:row-start-2 max-md:w-full max-md:justify-start max-md:gap-1 max-md:overflow-x-auto max-md:border-0 max-md:p-0"
    >
      {PANES.map((each) => {
        const { label, Icon } = LAYOUTS[each];
        return (
          <Tooltip key={each}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={each}
                  aria-label={label}
                  className="size-7 min-w-7 rounded-[3px] px-0 text-soft-ink hover:text-ink max-md:h-8 max-md:w-auto max-md:shrink-0 max-md:gap-1.5 max-md:rounded-[var(--radius)] max-md:px-3 max-md:text-xs"
                />
              }
            >
              <Icon aria-hidden="true" />
              <span className="md:hidden">{label}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
