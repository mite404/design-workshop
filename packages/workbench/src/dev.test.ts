import { expect, test } from "vitest";
import { fontFile, withOverrides } from "./dev";

const LINK =
  '<link rel="stylesheet" href="/__workbench/fonts.css" data-workbench-fonts>' +
  '<link rel="stylesheet" href="/__workbench/overrides.css" data-workbench-overrides>';

test("the override stylesheet is linked last in the head, once", () => {
  const html = '<html><head><link rel="stylesheet" href="/app.css"></HEAD><body></body></html>';
  expect(withOverrides(html)).toBe(
    `<html><head><link rel="stylesheet" href="/app.css">${LINK}</HEAD><body></body></html>`,
  );
});

test("a page with no head still gets the stylesheet", () => {
  expect(withOverrides("<p>hi</p>")).toBe(`${LINK}<p>hi</p>`);
});

test("only an installed font's woff2 files are served, from the host's fonts folder", () => {
  expect(fontFile("/host/.workbench", "/__workbench/fonts/inter/latin-wght-normal.woff2?v=1")).toBe(
    "/host/.workbench/fonts/inter/latin-wght-normal.woff2",
  );
  for (const url of [
    "/__workbench/fonts",
    "/__workbench/fonts/inter/LICENSE",
    "/__workbench/fonts/../config.json",
    "/__workbench/fonts/%2e%2e/x.woff2",
    "/__workbench/fonts/inter/../../x.woff2",
    "/__workbench/fonts/Inter/latin.woff2",
  ])
    expect(fontFile("/host/.workbench", url)).toBeNull();
});
