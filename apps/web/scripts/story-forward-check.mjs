import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT } from "./harness.mjs";

// Run in a disposable checkout with both servers running. Restored even on a failed check.
const base = arg("--base", "http://localhost:5173");
const stylesheet = path.join(ROOT, "packages/catalog/src/tokens.css");
const original = readFileSync(stylesheet, "utf8");
const browser = await launch();
const page = await browser.newPage();
const errors = [];
/** @type {string[]} */
const sockets = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("websocket", (socket) => sockets.push(socket.url()));

try {
  const response = await page.request.get(`${base}/__stories/index.json`);
  assert.equal(response.status(), 200);
  const index = await response.json();
  assert.equal(index.entries["motion-agent-tree--default"].type, "story");
  await page.goto(`${base}/__stories/iframe.html?id=motion-agent-tree--default&viewMode=story`);
  await page.locator("#storybook-root [data-wb]").first().waitFor();
  await page.waitForLoadState("networkidle");
  const documentId = await page.evaluate(() => {
    window.forwardCheckDocument = crypto.randomUUID();
    return window.forwardCheckDocument;
  });
  assert.ok(sockets.some((url) => url.startsWith(base.replace(/^http/, "ws") + "/__stories/")));
  writeFileSync(stylesheet, `${original}\n:root { --forward-check: 118; }\n`);
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue("--forward-check").trim() ===
      "118",
  );
  assert.ok(sockets.every((url) => new URL(url).origin === base.replace(/^http/, "ws")));
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.initiatorType === "script")
      .map((entry) => new URL(entry.name).origin),
  );
  assert.ok(scripts.length > 0);
  assert.deepEqual([...new Set(scripts)], [new URL(base).origin]);
  assert.equal(await page.evaluate(() => window.forwardCheckDocument), documentId);
  assert.deepEqual(errors, []);
  // oxlint-disable-next-line no-console -- a browser lever reports its result
  console.log(
    "Story index, same-origin scripts and WebSocket, and stylesheet HMR passed without reloading.",
  );
} finally {
  writeFileSync(stylesheet, original);
  await browser.close();
}
