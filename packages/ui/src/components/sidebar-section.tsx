import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SidebarGroupLabel } from "@yaklabs/ui/components/sidebar";

// The label row every section shares: 12px soft ink, the sidebar's 8px inset, and 8px between
// the name, the hairline, the count and the arrow.
const LABEL = "gap-2 text-soft-ink";

/**
 * The fold arrow a sidebar row and a section label share: ">" while folded, and open, a "v" that
 * fades in while the pointer is on its `group/fold` and fades out once it leaves. Keyboard focus
 * shows it too, but only `:focus-visible`: a click also leaves focus on the button, and plain
 * `:focus-within` would then hold the "v" up after the pointer has gone. A touch screen, with no
 * hover to reveal it, shows the "v" whenever the fold is open.
 */
export function FoldChevron({ open }: { open: boolean }): React.ReactElement {
  const common = "size-3.5! shrink-0 text-soft-ink";
  return open ? (
    <ChevronDown
      data-slot="fold-chevron"
      aria-hidden="true"
      className={`${common} opacity-0 transition-opacity group-hover/fold:opacity-100 group-has-focus-visible/fold:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none`}
    />
  ) : (
    <ChevronRight data-slot="fold-chevron" aria-hidden="true" className={common} />
  );
}

// The hairline after a section's name, across the rest of the panel.
function Line(): React.ReactElement {
  return <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-hairline" />;
}

/**
 * A titled section of the sidebar: its name, a hairline across the panel, and while it holds
 * anything, how many and an arrow that folds it. A section holding nothing is its name and line
 * alone, with nothing to fold, so a screen reader hears a label rather than a dead button.
 * @param count How many items the section holds; 0 shows the empty label.
 * @param defaultOpen Whether the section starts open; it remembers its own fold after that.
 * @param className Extra classes on the label row, such as the space above it.
 */
export function SidebarSection({
  label,
  count,
  defaultOpen = false,
  className = "",
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  className?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen);
  if (count === 0) {
    return (
      <>
        <SidebarGroupLabel className={`${LABEL} ${className}`}>
          {label}
          <Line />
        </SidebarGroupLabel>
        {children}
      </>
    );
  }
  return (
    <>
      <SidebarGroupLabel
        render={<button type="button" aria-expanded={open} aria-label={`${label}, ${count}`} />}
        className={`group/fold ${LABEL} rounded-[var(--radius)] transition-colors duration-150 ease-[ease] hover:text-ink motion-reduce:transition-none ${className}`}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {label}
        <Line />
        <span aria-hidden="true" className="tabular-nums">
          {count}
        </span>
        <FoldChevron open={open} />
      </SidebarGroupLabel>
      {open && children}
    </>
  );
}
