import { expect, test } from "vitest";
import {
  historyDirection,
  move,
  push,
  readChanges,
  readHistory,
  replaceLook,
  type History,
} from "./history";

test("releases stay grouped, undo reaches the start, and a new edit drops redo", () => {
  const first = [{ selector: ":root", name: "--window-radius", before: null, after: "18px" }];
  const second = ["padding-top", "padding-bottom"].map((name) => ({
    selector: "body",
    name,
    before: null,
    after: "6px",
  }));
  let h: History = { steps: [], cursor: 0 };
  h = push(push(h, first), second);
  expect(h.cursor).toBe(2);
  expect(h.steps[1]).toEqual(second);
  h = move(move(h, -1), -1);
  expect(h.cursor).toBe(0);
  h = move(h, 1);
  expect(h.cursor).toBe(1);
  expect(push(h, first).steps).toEqual([first, first]);
  expect(
    push(h, [{ selector: ":root", name: "--window-radius", before: "18px", after: "18px" }]),
  ).toEqual(h);
  expect(readHistory(JSON.stringify({ head: "commit", history: h }))).toEqual({
    head: "commit",
    history: h,
  });
  expect(readChanges([{ ...first[0], at: [2, 0] }])).toEqual([{ ...first[0], at: [2, 0] }]);
  expect(readChanges([{ ...first[0], at: [2, -1] }])).toBeNull();
  for (const raw of ["{", "null", '{"head":"x","history":{"steps":[[{}]],"cursor":1}}']) {
    expect(readHistory(raw)).toBeNull();
  }
});

test.each([
  ["z", true, false, false, false, -1],
  ["Z", true, false, false, true, 1],
  ["z", false, true, false, false, -1],
  ["y", false, true, false, false, 1],
  ["y", true, false, false, false, null],
  ["z", false, true, true, false, null],
  ["z", false, false, false, false, null],
] as const)(
  "history shortcut %s meta=%s ctrl=%s alt=%s shift=%s gives %s",
  (key, metaKey, ctrlKey, altKey, shiftKey, direction) => {
    expect(historyDirection({ key, metaKey, ctrlKey, altKey, shiftKey })).toBe(direction);
  },
);

const look = (o: Record<string, Record<string, string>>) =>
  new Map(Object.entries(o).map(([s, r]) => [s, new Map(Object.entries(r))]));

test("loading a look removes what it lacks, keeps what matches and sets the rest", () => {
  const from = look({
    ":root": { "--a": "1px", "--b": "2px" },
    "[data-slot=card]": { gap: "4px" },
  });
  const to = look({ ":root": { "--b": "2px", "--c": "3px" }, "[data-slot=card]": { gap: "8px" } });
  expect(replaceLook(from, to)).toEqual([
    { selector: ":root", name: "--a", before: "1px", after: null },
    { selector: ":root", name: "--c", before: null, after: "3px" },
    { selector: "[data-slot=card]", name: "gap", before: "4px", after: "8px" },
  ]);
  expect(replaceLook(to, to)).toEqual([]);
});
