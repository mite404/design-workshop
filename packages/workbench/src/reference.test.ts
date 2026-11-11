import { expect, test } from "vitest";
import { holds, labelOf } from "./reference";

const button = { left: 100, top: 100, width: 80, height: 24 };

test("the highlight holds near its edge, but not for a child or a clear move away", () => {
  expect(holds(button, { x: 184, y: 110 }, false)).toBe(true); // 4px past the right edge
  expect(holds(button, { x: 100, y: 95 }, false)).toBe(true); // 5px above
  expect(holds(button, { x: 188, y: 110 }, false)).toBe(false); // 8px past: the neighbour
  expect(holds(button, { x: 140, y: 110 }, true)).toBe(false); // into a child
});

test("a label names the tag and the start of the element's text", () => {
  expect(labelOf("button", "  Start with a\n refund workflow ")).toBe(
    "button · Start with a refund workflow",
  );
  expect(labelOf("p", "Leading with the longest-open cases, as you asked, rather")).toBe(
    "p · Leading with the longest-open cases, as…",
  );
  expect(labelOf("svg", " ")).toBe("svg");
});
