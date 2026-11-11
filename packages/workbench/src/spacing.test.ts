import { describe, expect, test } from "vitest";
import { dragSpace, gapSpaces, paddingMoved, paddingSides, paddingSpace } from "./spacing";

const BOX = { left: 100, top: 50, width: 300, height: 80 };

describe("dragSpace", () => {
  test("adds the distance moved, snapped to 2px, or 10px with Shift", () => {
    expect(dragSpace(14, 7, 2)).toBe(22); // 21 → 22, rounding half up
    expect(dragSpace(14, 6, 2)).toBe(20);
    expect(dragSpace(13, 0, 2)).toBe(14); // a typed odd value lands on the rhythm
    expect(dragSpace(14, 13, 10)).toBe(30);
  });

  test("never goes below 0", () => {
    expect(dragSpace(14, -40, 2)).toBe(0);
    expect(dragSpace(0, -1, 10)).toBe(0);
  });
});

describe("padding", () => {
  test("dragging inwards widens each side's padding", () => {
    expect(paddingMoved("top", 3, 7)).toBe(7);
    expect(paddingMoved("right", -5, 2)).toBe(5);
    expect(paddingMoved("bottom", 3, -7)).toBe(7);
    expect(paddingMoved("left", 5, 2)).toBe(5);
  });

  test("Alt adds the opposite side, Alt and Shift all four", () => {
    expect(paddingSides("left", false, true)).toEqual(["left"]);
    expect(paddingSides("left", true, false)).toEqual(["left", "right"]);
    expect(paddingSides("bottom", true, false)).toEqual(["bottom", "top"]);
    expect(paddingSides("top", true, true)).toEqual(["top", "right", "bottom", "left"]);
  });

  test("each side's band sits inside its edge", () => {
    const padding = { top: 12, right: 8, bottom: 4, left: 16 };
    expect(paddingSpace("top", BOX, padding)).toEqual({
      left: 100,
      top: 50,
      width: 300,
      height: 12,
    });
    expect(paddingSpace("right", BOX, padding)).toEqual({
      left: 392,
      top: 50,
      width: 8,
      height: 80,
    });
    expect(paddingSpace("bottom", BOX, padding)).toEqual({
      left: 100,
      top: 126,
      width: 300,
      height: 4,
    });
    expect(paddingSpace("left", BOX, padding)).toEqual({
      left: 100,
      top: 50,
      width: 16,
      height: 80,
    });
  });
});

describe("gapSpaces", () => {
  test("a row has one space between each pair of children, across the content box", () => {
    const children = [
      { left: 100, top: 60, width: 50, height: 20 },
      { left: 164, top: 50, width: 50, height: 40 },
      { left: 228, top: 70, width: 50, height: 10 },
    ];
    expect(gapSpaces(BOX, children)).toEqual([
      { axis: "x", box: { left: 150, top: 50, width: 14, height: 80 } },
      { axis: "x", box: { left: 214, top: 50, width: 14, height: 80 } },
    ]);
  });

  test("a column, a reversed row and a wrap", () => {
    const top = { left: 100, top: 50, width: 300, height: 20 };
    const below = { left: 100, top: 86, width: 300, height: 20 };
    expect(gapSpaces(BOX, [top, below])).toEqual([
      { axis: "y", box: { left: 100, top: 70, width: 300, height: 16 } },
    ]);
    const right = { left: 300, top: 50, width: 100, height: 20 };
    const left = { left: 180, top: 50, width: 100, height: 20 };
    expect(gapSpaces(BOX, [right, left])[0]?.box).toEqual({
      left: 280,
      top: 50,
      width: 20,
      height: 80,
    });
    const wrapped = { left: 100, top: 60, width: 250, height: 20 };
    expect(gapSpaces(BOX, [{ left: 100, top: 30, width: 250, height: 40 }, wrapped])).toEqual([]);
  });
});
