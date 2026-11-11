// oxlint-disable no-await-in-loop, no-console -- a lever drives one step at a time and reports on stdout
// The corner radius lever (ETH-101): drives the Workbench at /__workbench/ in headless Chromium
// through the story: type a value, scrub the label, drag a handle by an uneven amount, Escape
// mid-drag, reset. Each step checks the window's computed radius, the field and the override
// file. Screenshots go to .artifacts/corner-radius/. Exits 1 when any step fails. It writes the
// real override file and leaves it empty, so start from an empty one.
//
//   node apps/web/scripts/corner-radius-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/corner-radius"));
const OVERRIDES = path.join(ROOT, "packages/catalog/src/overrides.css");
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
const saved = (px) => EMPTY.replace(":root {\n", `:root {\n  --window-radius: ${px}px;\n`);
mkdirSync(out, { recursive: true });
assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "the override file starts empty");

const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const field = page.locator("#radius");
const radius = () =>
  frame
    .locator("[data-slot=window]")
    // oxlint-disable-next-line prefer-number-coercion -- Number("12px") is NaN
    .evaluate((w) => Number.parseFloat(getComputedStyle(w).borderTopLeftRadius));
const handle = (corner) => page.locator(`.handle[data-corner=${corner}]`);
const center = async (locator) => {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

// The window's radius, the field and the file all agree on `px`, the file once it lands.
async function expectRadius(px, file) {
  await page.waitForFunction(
    (want) => document.querySelector("#radius").value === String(want),
    px,
  );
  assert.equal(await radius(), px, "window radius");
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8") !== file; i++) {
    await page.waitForTimeout(100);
  }
  assert.equal(readFileSync(OVERRIDES, "utf8"), file, "override file");
}

const results = [];
const step = async (name, run) => {
  try {
    results.push({ name, ok: true, detail: (await run()) ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};

await step("the Workbench frames the app; clicking the window selects it", async () => {
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
  await expectRadius(12, EMPTY);
  await frame.locator("[data-slot=window-body]").click({ position: { x: 600, y: 300 } });
  await page.locator(".overlay[data-selected=true]").waitFor();
  assert.equal(await page.locator(".handle:visible").count(), 4);
  await page.screenshot({ path: `${out}/01-selected.png` });
});

await step("typing 24 and Enter saves it; arrows step by 1 and Shift by 10", async () => {
  await field.fill("24");
  await field.press("Enter");
  await expectRadius(24, saved(24));
  await field.press("ArrowUp");
  await field.press("Shift+ArrowUp");
  assert.equal(await field.inputValue(), "35");
  await field.press("Enter");
  await expectRadius(35, saved(35));
  await field.fill("abc");
  await field.press("Enter");
  await expectRadius(35, saved(35));
  await field.fill("9999");
  await field.press("Enter");
  await expectRadius(35, saved(35));
});

await step("scrubbing the label right raises the value in 2px steps", async () => {
  const label = page.locator("label[for=radius]");
  assert.equal(await label.evaluate((l) => getComputedStyle(l).cursor), "ew-resize");
  const from = await center(label);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 15, from.y, { steps: 5 });
  assert.equal(await field.inputValue(), "50"); // 35 + 15 = 50, snapped to 2
  await page.mouse.up();
  await expectRadius(50, saved(50));
});

await step("dragging a handle towards the centre by an uneven amount", async () => {
  const se = handle("se");
  const from = await center(se);
  const nwFrom = await center(handle("nw"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 13, from.y - 9, { steps: 6 }); // (13 + 9) / 2 = 11 → 50 + 11 = 61 → 62
  assert.equal(await field.inputValue(), "62");
  assert.equal(await radius(), 62, "live while dragging");
  assert.equal(await page.locator(".pill").textContent(), "Radius 62");
  assert.equal(await page.locator(".pill").evaluate((p) => getComputedStyle(p).opacity), "1");
  const moved = await center(se);
  assert.ok(Math.abs(moved.x - (from.x - 12)) <= 1 && Math.abs(moved.y - (from.y - 12)) <= 1);
  const nw = await center(handle("nw"));
  assert.ok(Math.abs(nw.x - (nwFrom.x + 12)) <= 1 && Math.abs(nw.y - (nwFrom.y + 12)) <= 1);
  await page.screenshot({ path: `${out}/02-mid-drag.png` });
  await page.mouse.up();
  await expectRadius(62, saved(62));
});

await step("Escape mid-drag restores the value from before the drag", async () => {
  const nw = handle("nw");
  const from = await center(nw);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 40, { steps: 5 });
  assert.equal(await field.inputValue(), "102");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expectRadius(62, saved(62));
});

await step("a write over a file changed on disk is refused with a message", async () => {
  writeFileSync(OVERRIDES, saved(40));
  await field.fill("30");
  await field.press("Enter");
  await page.locator(".message").filter({ hasText: "changed on disk" }).waitFor();
  await expectRadius(40, saved(40));
});

await step("Reset removes the value and the baseline 12px returns", async () => {
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expectRadius(12, EMPTY);
  assert.equal(await page.getByRole("button", { name: "Reset", exact: true }).isDisabled(), true);
  await page.mouse.move(700, 450);
  await page.screenshot({ path: `${out}/03-after-reset.png` });
});

await browser.close();
report(results, errors, out);
