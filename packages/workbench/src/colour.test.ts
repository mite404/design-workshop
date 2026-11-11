import { expect, test } from "vitest";
import { contrast, colourTokens } from "./colour";

test("WCAG contrast follows the documented inks and the 4.5 boundary", () => {
  expect(contrast("#000000", "#ffffff")).toBe(21);
  expect(contrast("#f0efea", "#f0efea")).toBe(1);
  expect(contrast("#252524", "#f0efea")).toBeCloseTo(13.3, 1);
  expect(contrast("#565650", "#f0efea")).toBeCloseTo(6.4, 1);
  expect(contrast("#767676", "#ffffff")).toBeGreaterThan(4.5);
  expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
});

test("colour tokens merge the dark baseline without losing light aliases or shared colours", () => {
  const tokens = colourTokens(`:root {
  --paper: #eeeeee;
  --ink: #111111;
  --bg: var(--paper);
  --rule: rgba(0, 0, 0, 0.5);
  --space: 24px;
}
:root[data-theme="dark"] {
  --paper: #222222;
  --bg: #333333;
}
`);
  expect(tokens).toEqual({
    "--paper": { light: "#eeeeee", dark: "#222222", editable: true },
    "--ink": { light: "#111111", dark: "#111111", editable: true },
    "--bg": { light: "var(--paper)", dark: "#333333", editable: true },
    "--rule": { light: "rgba(0, 0, 0, 0.5)", dark: "rgba(0, 0, 0, 0.5)", editable: false },
  });
});
