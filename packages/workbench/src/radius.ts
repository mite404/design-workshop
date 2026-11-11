// The corner radius's maths: its range, the value a drag sets, and where the canvas handles sit.

/** A rectangle in the canvas's coordinates, as `getBoundingClientRect` gives it. */
export type Box = { left: number; top: number; width: number; height: number };

/** A corner of the window, by compass point. */
export type Corner = "nw" | "ne" | "se" | "sw";

// Each corner's inward direction along its diagonal, towards the centre.
const INWARD: Record<Corner, { x: 1 | -1; y: 1 | -1 }> = {
  nw: { x: 1, y: 1 },
  ne: { x: -1, y: 1 },
  se: { x: -1, y: -1 },
  sw: { x: 1, y: -1 },
};

/** The corners, clockwise from the top left. */
export const CORNERS: Corner[] = ["nw", "ne", "se", "sw"];

/** The largest radius the box takes: half its shorter side, in whole pixels. */
export const maxRadius = (box: Box): number => Math.floor(Math.min(box.width, box.height) / 2);

/** `radius` kept between 0 and the box's `maxRadius`. */
export const clampRadius = (radius: number, box: Box): number =>
  Math.min(Math.max(radius, 0), maxRadius(box));

/**
 * The radius a drag sets: the radius it started from plus the distance moved, snapped to `step`
 * (2px, or 10px with Shift, ADR-010) and clamped to the box.
 */
export const dragRadius = (from: number, moved: number, step: number, box: Box): number =>
  clampRadius(Math.round((from + moved) / step) * step, box);

/**
 * How far a pointer moved by `dx`, `dy` travels along `corner`'s diagonal towards the centre,
 * measured as the radius it adds, so a handle inset by the radius stays under the pointer.
 */
export function handleMoved(corner: Corner, dx: number, dy: number): number {
  const { x, y } = INWARD[corner];
  return (dx * x + dy * y) / 2;
}

/**
 * The centre of `corner`'s handle: inset along the diagonal by the radius, and by at least
 * `least`, so a square corner's handle still sits inside the box.
 */
export function handlePoint(
  corner: Corner,
  box: Box,
  radius: number,
  least: number,
): { x: number; y: number } {
  const { x, y } = INWARD[corner];
  const inset = Math.max(radius, least);
  return {
    x: (x === 1 ? box.left : box.left + box.width) + x * inset,
    y: (y === 1 ? box.top : box.top + box.height) + y * inset,
  };
}
