import { describe, expect, test } from "vitest";
import { dragRadius, handleMoved, handlePoint, maxRadius } from "./radius";

const BOX = { left: 16, top: 16, width: 1248, height: 867 };

describe("dragRadius", () => {
  test("adds the distance moved, snapped to the step", () => {
    expect(dragRadius(12, 7, 2, BOX)).toBe(20); // 19 → 20
    expect(dragRadius(12, -3, 2, BOX)).toBe(10); // 9 → 10, rounding half up
    expect(dragRadius(13, 0, 2, BOX)).toBe(14); // a typed odd value lands on the rhythm
    expect(dragRadius(12, 23, 10, BOX)).toBe(40); // 35 → 40 with Shift
  });

  test("stays between 0 and half the window's shorter side", () => {
    expect(maxRadius(BOX)).toBe(433);
    expect(dragRadius(12, -50, 2, BOX)).toBe(0);
    expect(dragRadius(12, 900, 2, BOX)).toBe(433);
    expect(dragRadius(12, 900, 2, { ...BOX, width: 300 })).toBe(150);
  });
});

describe("handles", () => {
  test("a drag towards the centre raises the radius from every corner", () => {
    expect(handleMoved("nw", 10, 6)).toBe(8);
    expect(handleMoved("ne", -10, 6)).toBe(8);
    expect(handleMoved("se", -10, -6)).toBe(8);
    expect(handleMoved("sw", 10, -6)).toBe(8);
    expect(handleMoved("se", 10, 6)).toBe(-8);
  });

  test("a handle sits inset along its diagonal by the radius", () => {
    expect(handlePoint("nw", BOX, 20, 8)).toEqual({ x: 36, y: 36 });
    expect(handlePoint("ne", BOX, 20, 8)).toEqual({ x: 1244, y: 36 });
    expect(handlePoint("se", BOX, 20, 8)).toEqual({ x: 1244, y: 863 });
    expect(handlePoint("sw", BOX, 0, 8)).toEqual({ x: 24, y: 875 });
  });

  test("a handle stays under a pointer dragged along the diagonal", () => {
    const from = handlePoint("se", BOX, 20, 8);
    const radius = 20 + handleMoved("se", -30, -30);
    expect(handlePoint("se", BOX, radius, 8)).toEqual({ x: from.x - 30, y: from.y - 30 });
  });
});
