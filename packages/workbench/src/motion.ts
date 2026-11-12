// The easing curve's maths: a cubic-bezier's four numbers, read from and written to CSS.

/** A cubic-bezier's control points: x1, y1, x2, y2. */
export type Bezier = [number, number, number, number];

/** The hover easing token, shared by every control's hover (ADR-038). */
export const EASE = "--motion-hover-ease";

// x stays in 0..1, as CSS requires; y may overshoot for a spring-like settle, within reason.
const Y_MIN = -0.6;
const Y_MAX = 1.6; // takes the common back-out ease, cubic-bezier(0.34, 1.56, 0.64, 1)
const NUMBER = String.raw`(-?\d(?:\.\d{1,3})?)`;
const FORM = new RegExp(
  String.raw`^cubic-bezier\(${Array(4)
    .fill(NUMBER)
    .join(String.raw`,\s*`)}\)$`,
);

const round = (n: number): number => Math.round(n * 1000) / 1000;
const inX = (x: number): boolean => x >= 0 && x <= 1;
const inY = (y: number): boolean => y >= Y_MIN && y <= Y_MAX;
const fitX = (n: number): number => round(Math.min(Math.max(n, 0), 1));
const fitY = (n: number): number => round(Math.min(Math.max(n, Y_MIN), Y_MAX));
// One coordinate of a cubic bezier from 0 to 1 through control values a and b, at parameter s.
const along = (a: number, b: number, s: number): number =>
  3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;

/** `value` as a curve, or null unless it is a `cubic-bezier()` the Workbench may save. */
export function parseBezier(value: string): Bezier | null {
  const m = FORM.exec(value.trim());
  if (m === null) return null;
  const [x1, y1, x2, y2] = [m[1], m[2], m[3], m[4]].map(Number);
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return null;
  return inX(x1) && inX(x2) && inY(y1) && inY(y2) ? [x1, y1, x2, y2] : null;
}

/** `curve` as the CSS the Workbench saves, each number kept in range and to 3 places. */
export function formatBezier([x1, y1, x2, y2]: Bezier): string {
  return `cubic-bezier(${fitX(x1)}, ${fitY(y1)}, ${fitX(x2)}, ${fitY(y2)})`;
}

/** How far along `curve` an animation is at `time` (both 0..1), found by bisection on the curve. */
export function progressAt([x1, y1, x2, y2]: Bezier, time: number): number {
  let [low, high] = [0, 1];
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (along(x1, x2, mid) < time) low = mid;
    else high = mid;
  }
  return along(y1, y2, (low + high) / 2);
}
