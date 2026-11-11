// Gap and padding's maths (ETH-102): the value a drag sets, which sides it sets, and where the
// spaces they control sit on the canvas.
import type { Box } from "./radius";

/** A side of an element's padding box. */
export type Side = "top" | "right" | "bottom" | "left";

/** The spacing properties the Workbench sets on an element. */
export type Spacing = "gap" | `padding-${Side}`;

/** The sides, clockwise from the top. */
export const SIDES: Side[] = ["top", "right", "bottom", "left"];

/** Every spacing property, in the inspector's order. */
export const SPACING: Spacing[] = ["gap", ...SIDES.map((s): Spacing => `padding-${s}`)];

/** A space a handle controls, and the axis it is dragged along. */
export type Space = { axis: "x" | "y"; box: Box };

const OPPOSITE: Record<Side, Side> = { top: "bottom", right: "left", bottom: "top", left: "right" };

// Each side's inward direction: how far a pointer moved by dx, dy goes into the element.
const INWARD: Record<Side, (dx: number, dy: number) => number> = {
  top: (_, dy) => dy,
  right: (dx) => -dx,
  bottom: (_, dy) => -dy,
  left: (dx) => dx,
};

/**
 * The value a drag sets: the value it started from plus the distance moved, snapped to `step`
 * (2px, or 10px with Shift, ADR-010) and never below 0.
 */
export const dragSpace = (from: number, moved: number, step: number): number =>
  Math.max(Math.round((from + moved) / step) * step, 0);

/** How far a pointer moved by `dx`, `dy` drags `side`'s padding inwards, which widens it. */
export const paddingMoved = (side: Side, dx: number, dy: number): number => INWARD[side](dx, dy);

/** The sides a padding drag on `side` sets: Alt adds the opposite side, Alt and Shift all four
 * (Figma's auto layout). */
export function paddingSides(side: Side, alt: boolean, shift: boolean): Side[] {
  if (alt && shift) return SIDES;
  return alt ? [side, OPPOSITE[side]] : [side];
}

/** The band `side`'s padding fills inside the element's border box `box`. */
export function paddingSpace(side: Side, box: Box, padding: Record<Side, number>): Box {
  const width = side === "left" || side === "right" ? padding[side] : box.width;
  const height = side === "top" || side === "bottom" ? padding[side] : box.height;
  return {
    left: side === "right" ? box.left + box.width - width : box.left,
    top: side === "bottom" ? box.top + box.height - height : box.top,
    width,
    height,
  };
}

// The space between two boxes along one axis, as [start, end], or null where they overlap on it.
function between(a: Box, b: Box, axis: "x" | "y"): [number, number] | null {
  const [start, size] = axis === "x" ? (["left", "width"] as const) : (["top", "height"] as const);
  if (b[start] >= a[start] + a[size] - 0.5) return [a[start] + a[size], b[start]];
  if (a[start] >= b[start] + b[size] - 0.5) return [b[start] + b[size], a[start]];
  return null;
}

/**
 * The spaces between each pair of neighbouring `children` of a flex or grid container whose
 * content box is `content`: across the content box, between the two children along the axis
 * they sit apart on. Pairs that are not apart on one axis, such as a wrap, have none.
 */
export function gapSpaces(content: Box, children: Box[]): Space[] {
  return children.slice(1).flatMap((b, i): Space[] => {
    const a = children[i];
    if (a === undefined) return [];
    const x = between(a, b, "x");
    const y = x === null ? between(a, b, "y") : null;
    if (x !== null) {
      const box = { left: x[0], top: content.top, width: x[1] - x[0], height: content.height };
      return [{ axis: "x", box }];
    }
    if (y !== null) {
      const box = { left: content.left, top: y[0], width: content.width, height: y[1] - y[0] };
      return [{ axis: "y", box }];
    }
    return [];
  });
}
