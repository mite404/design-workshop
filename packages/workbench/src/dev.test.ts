import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { fontFile, startDev, withOverrides } from "./dev";

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

test("a page the app streams in chunks reaches the browser whole, with the links", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "dev-host-"));
  mkdirSync(path.join(root, ".workbench"));
  writeFileSync(
    path.join(root, ".workbench/config.json"),
    '{ "format": "design-workshop/config", "version": 1, "sources": ["."], "storybook": null }',
  );
  writeFileSync(path.join(root, ".workbench/overrides.css"), ":root {\n}\n");
  // Node frames a response with no length as chunked, as Next's streamed pages are.
  const app = createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.write("<html><head></head>");
    res.end("<body>streamed</body></html>");
  });
  await new Promise<void>((resolve) => {
    app.listen(5195, resolve);
  });
  try {
    await startDev("http://localhost:5195", 5185, root);
    const page = await (await fetch("http://localhost:5185/")).text();
    expect(page).toBe(`<html><head>${LINK}</head><body>streamed</body></html>`);
  } finally {
    app.close();
  }
});
