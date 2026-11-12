import { expect, test } from "vitest";
import { formatBezier, parseBezier, progressAt } from "./motion";

test("parseBezier reads a curve in range and refuses anything else", () => {
  expect(parseBezier("cubic-bezier(0.25, 0.1, 0.25, 1)")).toEqual([0.25, 0.1, 0.25, 1]);
  expect(parseBezier("cubic-bezier(0.3,-0.5,0.7,1.6)")).toEqual([0.3, -0.5, 0.7, 1.6]);
  for (const bad of [
    "ease",
    "cubic-bezier(1.2, 0, 0, 1)", // x past 1 is not valid CSS
    "cubic-bezier(0, 1.7, 0, 1)", // y past the range the editor shows
    "cubic-bezier(0, 0, 0)",
    "cubic-bezier(0, 0, 0, 1); color: red",
  ]) {
    expect(parseBezier(bad)).toBeNull();
  }
});

test("formatBezier clamps a dragged point into range and rounds to 3 places", () => {
  expect(formatBezier([-0.2, 2.6, 0.33333, 1])).toBe("cubic-bezier(0, 1.6, 0.333, 1)");
  expect(parseBezier(formatBezier([0.123456, -1.4, 1.3, 0.5]))).toEqual([0.123, -0.6, 1, 0.5]);
});

test("progressAt follows the curve: linear is identity, ease-out runs ahead early", () => {
  expect(progressAt([0, 0, 1, 1], 0.3)).toBeCloseTo(0.3, 4);
  expect(progressAt([0.25, 0.1, 0.25, 1], 0)).toBeCloseTo(0, 4);
  expect(progressAt([0.25, 0.1, 0.25, 1], 1)).toBeCloseTo(1, 4);
  // ease-out (0, 0, 0.58, 1) is past halfway at a quarter of the time, ease-in far behind
  expect(progressAt([0, 0, 0.58, 1], 0.25)).toBeGreaterThan(0.35);
  expect(progressAt([0.42, 0, 1, 1], 0.25)).toBeLessThan(0.1);
});
