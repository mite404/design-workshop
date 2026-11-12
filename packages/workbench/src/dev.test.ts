import { expect, test } from "vitest";
import { withOverrides } from "./dev";

const LINK = '<link rel="stylesheet" href="/__workbench/overrides.css" data-workbench-overrides>';

test("the override stylesheet is linked last in the head, once", () => {
  const html = '<html><head><link rel="stylesheet" href="/app.css"></HEAD><body></body></html>';
  expect(withOverrides(html)).toBe(
    `<html><head><link rel="stylesheet" href="/app.css">${LINK}</HEAD><body></body></html>`,
  );
});

test("a page with no head still gets the stylesheet", () => {
  expect(withOverrides("<p>hi</p>")).toBe(`${LINK}<p>hi</p>`);
});
