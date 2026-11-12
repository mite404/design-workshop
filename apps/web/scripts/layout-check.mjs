// oxlint-disable no-await-in-loop -- a lever drives one step at a time
// The shell's side (ETH-142): drives the Workbench's Layout section at /__workbench/ in headless
// Chromium. At the baseline the rail sits left of the workspace. Right puts the rail on the
// window's right edge with the docked panel between it and the workspace, the workspace's inset
// corner at its top right, and the panel's resize handle on its left edge, where a drag 40px to
// the left widens it by 40px. A closed panel peeks out from the rail's edge to the left. Reset
// empties the override file and brings the rail back to the left. Screenshots go to
// .artifacts/layout/. Exits 1 when any step fails. It writes the real override file and leaves it
// empty, so start from an empty one.
//
//   node apps/web/scripts/layout-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/layout"));
const OVERRIDES = path.join(ROOT, "packages/catalog/src/overrides.css");
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
const RIGHT = EMPTY.replace("}", "  --shell-side: right;\n}");

mkdirSync(out, { recursive: true });
assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "the override file starts empty");

const browser = await launch();
const { page, context, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const box = (slot) => frame.locator(`[data-slot="${slot}"]`).first().boundingBox();
const toggle = frame.getByRole("button", { name: "Toggle sidebar" });

async function settle(want) {
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8") !== want; i++) {
    await page.waitForTimeout(100);
  }
  assert.equal(readFileSync(OVERRIDES, "utf8"), want, "the override file");
}
// Waits until the rail is on `side` of the workspace, after the hot reload and the panel's slide.
async function railOn(side) {
  for (let i = 0; i < 50; i++) {
    const [rail, work] = [await box("rail"), await box("workspace")];
    if (side === "right" ? rail.x > work.x : rail.x < work.x) break;
    await page.waitForTimeout(100);
  }
  const [rail, work] = [await box("rail"), await box("workspace")];
  assert.ok(
    side === "right" ? rail.x >= work.x + work.width - 1 : rail.x + rail.width <= work.x + 1,
  );
}
// Docks or closes the panel and waits for the 250ms pin to end.
async function dock(open) {
  if ((await toggle.getAttribute("aria-expanded")) !== String(open)) await toggle.click();
  await page.waitForTimeout(400);
}

const results = [];
const step = async (name, run) => {
  try {
    await run();
    results.push({ name, ok: true, detail: "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};

await step("at the baseline the rail sits left of the workspace", async () => {
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=rail]").waitFor({ timeout: 30_000 });
  await railOn("left");
  assert.equal(
    await page.getByRole("button", { name: "Rail on the left" }).getAttribute("aria-pressed"),
    "true",
  );
});

await step("Right moves the rail and the docked panel to the window's right edge", async () => {
  await page.getByRole("button", { name: "Rail on the right" }).click();
  await settle(RIGHT);
  await dock(true);
  await railOn("right");
  const [rail, panel, work] = [
    await box("rail"),
    await box("sidebar-container"),
    await box("workspace"),
  ];
  assert.ok(Math.abs(panel.x + panel.width - rail.x) <= 1, "the panel docks against the rail");
  assert.ok(Math.abs(work.x + work.width - panel.x) <= 1, "the workspace ends at the panel");
  const corners = await frame.locator('[data-slot="workspace"]').evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderRightWidth];
  });
  assert.equal(corners[0], "0px", "no inset corner on the left");
  assert.notEqual(corners[1], "0px", "the inset corner is at the top right");
  assert.equal(corners[2], "1px", "the border runs down the panel's side");
  await page.screenshot({ path: `${out}/right-docked.png` });
  await page
    .locator("details[aria-label=Layout]")
    .screenshot({ path: `${out}/layout-section.png` });
});

await step("the resize handle is on the panel's left edge; dragging left widens it", async () => {
  const handle = frame.locator('[data-slot="sidebar-resize"]');
  const [h, panel] = [await handle.boundingBox(), await box("sidebar-container")];
  assert.ok(Math.abs(h.x + h.width / 2 - panel.x) <= 2, "the handle is on the left edge");
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 - 40, h.y + h.height / 2, { steps: 6 });
  await page.mouse.up();
  const wider = await box("sidebar-container");
  assert.ok(Math.abs(wider.width - panel.width - 40) <= 2, `40px wider: ${wider.width}`);
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  const narrower = await box("sidebar-container");
  assert.ok(Math.abs(wider.width - narrower.width - 16) <= 2, "Right narrows it by 16px");
  await handle.dblclick();
});

await step("closed, the panel peeks out leftwards from the rail's edge", async () => {
  await dock(false);
  // The Workbench's select overlay takes the canvas's pointer, so the app is opened on its own.
  const app = await context.newPage();
  await app.goto(`${base}/t/demo-brief`);
  const rail = await app.locator('[data-slot="rail"]').boundingBox();
  await app.mouse.move(500, 500);
  await app.mouse.move(rail.x + rail.width / 2, rail.y + rail.height - 120, { steps: 3 });
  await app.waitForFunction(
    () => document.querySelector('[data-slot="sidebar"]').dataset.peek === "open",
  );
  await app.waitForTimeout(400);
  const peeked = await app.locator('[data-slot="sidebar-container"]').boundingBox();
  assert.ok(Math.abs(peeked.x + peeked.width - rail.x) <= 1, "it ends at the rail's edge");
  await app.screenshot({ path: `${out}/right-peek.png` });
  await app.close();
  await dock(true);
});

await step("Reset empties the file and the rail returns to the left", async () => {
  await page.getByRole("button", { name: "Reset shell side" }).click();
  await settle(EMPTY);
  await railOn("left");
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Reset shell side"]').disabled,
  );
});

await browser.close();
report(results, errors, out);
