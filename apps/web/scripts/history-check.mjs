// oxlint-disable no-await-in-loop, no-console -- sequential browser actions against one override file
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/history"));
const file = path.join(ROOT, "packages/catalog/src/overrides.css");
const starting = readFileSync(file, "utf8");
const browser = await launch();
const { page, context, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const card = frame.locator("section.card.state").first();
const button = (name) => page.getByRole("button", { name, exact: true });
// The toolbar follows history a frame later, so a disabled button is waited for, not read.
const off = (name) => page.getByRole("button", { name, exact: true, disabled: true }).waitFor();
const state = () =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("workbench-history")).history);
const disk = () => readFileSync(file, "utf8");
mkdirSync(out, { recursive: true });

async function expectFile(want) {
  for (let i = 0; i < 100 && disk() !== want; i++) await page.waitForTimeout(50);
  assert.equal(disk(), want, await page.locator(".message").textContent());
}

async function cursor(want) {
  await page.waitForFunction(
    (n) => JSON.parse(sessionStorage.getItem("workbench-history")).history.cursor === n,
    want,
  );
}

async function select(locator, padding = false) {
  await locator.scrollIntoViewIfNeeded();
  for (let i = 0; i < 40; i++) {
    const selected = await page.locator(".selector").textContent();
    if (await locator.evaluate((el, s) => s && el.ownerDocument.querySelector(s) === el, selected))
      return;
    const b = await locator.boundingBox();
    await page.mouse.click(b.x + (padding ? 60 : 30), b.y + (padding ? 6 : b.height / 2));
    await page.waitForTimeout(40);
  }
  assert.fail("could not select element");
}

async function drag(locator, dx, dy, alt = false) {
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  if (alt) await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
  if (alt) await page.keyboard.up("Alt");
}

async function type(id, value) {
  await page.locator(id).fill(value);
  await page.locator(id).press("Enter");
}

async function roundTrip(action, verify = async () => {}) {
  const before = disk();
  const n = (await state()).cursor;
  await action();
  await cursor(n + 1);
  const after = disk();
  assert.notEqual(after, before);
  await verify();
  await button("Undo").click();
  await cursor(n);
  await expectFile(before);
  await button("Redo").click();
  await cursor(n + 1);
  await expectFile(after);
  await verify();
}

try {
  await context.route(/api\.fontsource\.org|cdn\.jsdelivr\.net/, (route) => route.abort());
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor();
  await page.waitForFunction(() => document.querySelector("#radius").value === "12");
  await off("Undo");
  await off("Redo");
  await off("Discard");
  await page.locator(".tool").click();
  await page.frames()[1].goto(`${base}/t/demo-brief`);
  await card.waitFor();
  await card.scrollIntoViewIfNeeded();
  await page.locator(".tool").click();
  await select(frame.locator("[data-slot=window]"));
  await page.screenshot({ path: `${out}/disabled.png` });
  await drag(page.locator('label[for="radius"]'), 8, 0);
  await cursor(1);
  const radius = disk();
  await select(card, true);
  await drag(page.locator('.bar[data-name="padding-left"]:not([hidden])'), 8, 0, true);
  await cursor(2);
  const padding = disk();
  assert.equal((await state()).steps[1].length, 2, "Alt-drag is one mirrored-side release");
  await select(card.locator("h2, h3, h4").first());
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("ArrowRight");
  await cursor(3);
  const nudged = disk();
  for (const [i, expected] of [
    [2, padding],
    [1, radius],
    [0, starting],
  ]) {
    await button("Undo").click();
    await cursor(i);
    await expectFile(expected);
    if (i === 2) await page.screenshot({ path: `${out}/enabled.png` });
  }
  for (const [i, expected] of [
    [1, radius],
    [2, padding],
    [3, nudged],
  ]) {
    await button("Redo").click();
    await cursor(i);
    await expectFile(expected);
  }
  console.log("ok radius drag, Alt-padding and nudge undo/redo byte for byte");

  await page.reload();
  await frame.locator("[data-slot=window]").waitFor();
  await cursor(3);
  await button("Undo").focus();
  await page.keyboard.press("Meta+z");
  await cursor(2);
  await page.keyboard.press("Meta+Shift+z");
  await cursor(3);
  await page
    .frames()[1]
    .locator("body")
    .evaluate((b) => {
      b.tabIndex = 0;
      b.focus();
    });
  await page.keyboard.press("Control+z");
  await cursor(2);
  await page.keyboard.press("Control+y");
  await cursor(3);
  await expectFile(nudged);
  await page.locator("#radius").focus();
  await page.keyboard.press("Control+z");
  assert.equal((await state()).cursor, 3, "input keeps native undo");
  await page
    .frames()[1]
    .locator("body")
    .evaluate((b) => {
      const input = b.ownerDocument.createElement("textarea");
      b.append(input);
      input.focus();
    });
  await page.keyboard.press("Control+z");
  assert.equal((await state()).cursor, 3, "frame textarea keeps native undo");
  console.log("ok reload, Mac/Windows shortcuts, frame focus and native text undo");

  await page.frames()[1].goto(`${base}/t/demo-brief`);
  await frame.locator("h2").first().waitFor();
  await select(frame.locator("h2").first());
  await roundTrip(
    () => type("#wb-font-size", "15"),
    async () => {
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector("iframe").contentDocument.querySelector("h2"))
            .fontSize === "15px",
      );
    },
  );
  await roundTrip(() => page.locator("#wb-style").selectOption("700i"));
  assert.equal((await state()).steps.at(-1).length, 2, "weight and italic are one step");
  await roundTrip(() => button("Reset style").click());
  await roundTrip(() => type("#wb-type-base", "14"));
  await roundTrip(() => type("#wb-type-ratio", "1.25"));
  await roundTrip(() => type("#wb-type-leading", "1.4"));
  await roundTrip(async () => {
    await button("Text font").click();
    await page.getByRole("combobox", { name: "Search fonts" }).fill("Newsreader");
    await page.getByRole("option", { name: /Newsreader Variable/ }).click();
  });
  console.log("ok type size, grouped style/reset, base, ratio, leading and root font");

  const beforeUndo = (await state()).cursor;
  await button("Undo").click();
  await cursor(beforeUndo - 1);
  await type("#wb-type-base", "18");
  await cursor(beforeUndo);
  await off("Redo");
  const expectedHistory = await state();
  const external = disk().replace("--type-base: 18px", "--type-base: 20px");
  writeFileSync(file, external);
  await button("Undo").click();
  await page.waitForFunction(() =>
    document.querySelector(".message").textContent.includes("changed on disk"),
  );
  assert.equal(
    await page.locator(".message").evaluate((node) => getComputedStyle(node).color),
    "rgb(184, 67, 44)",
    "save failures retain the error colour",
  );
  assert.deepEqual(await state(), expectedHistory);
  await expectFile(external);
  await page.screenshot({ path: `${out}/conflict.png` });
  console.log("ok redo branch invalidation and external conflict leaves history/file untouched");

  await page.frames()[1].goto(`${base}/`);
  await frame.locator("[data-slot=window]").waitFor();
  await page.locator(".unmatched button").first().waitFor();
  await roundTrip(() => page.locator(".unmatched button").first().click());
  const beforeDiscard = disk();
  console.log("ok unmatched deletion restores the property's exact file position");

  page.once("dialog", (dialog) => dialog.dismiss());
  await button("Discard").click();
  await expectFile(beforeDiscard);
  page.once("dialog", (dialog) => dialog.accept());
  await button("Discard").click();
  await expectFile(starting);
  await cursor(0);
  await off("Redo");
  await off("Discard");
  assert.equal(
    await page.locator(".message").evaluate((node) => getComputedStyle(node).color),
    await page.locator("html").evaluate((node) => getComputedStyle(node).color),
    "successful discard notice uses normal ink",
  );
  await page.reload();
  await frame.locator("[data-slot=window]").waitFor();
  await cursor(0);
  await off("Undo");
  console.log("ok discard confirmation, HEAD restore, disabled state and cleared session history");
  writeFileSync(file, starting.replace(":root {\n", ":root {\n  --window-radius: 18px;\n"));
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find((b) => b.textContent === "Discard").disabled,
  );
  await off("Undo");
  page.once("dialog", (dialog) => dialog.accept());
  await button("Discard").click();
  await expectFile(starting);
  // Discard turns itself off once the Workbench has reloaded its values; typing before that
  // races the reload, which puts the field back to 12.
  await off("Discard");
  await page.waitForFunction(() => document.querySelector("#radius").value === "12");
  console.log("ok external edits enable Discard without a reload");

  const { promise: gate, resolve: release } = Promise.withResolvers();
  let held = false;
  await page.route("**/__workbench/values", async (route) => {
    if (route.request().method() !== "POST" || held) {
      await route.continue();
      return;
    }
    held = true;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await type("#radius", "16");
  await expectFile(starting.replace(":root {\n", ":root {\n  --window-radius: 16px;\n"));
  const label = await page.locator('label[for="radius"]').boundingBox();
  await page.mouse.move(label.x + 15, label.y + label.height / 2);
  await page.mouse.down();
  await page.mouse.move(label.x + 23, label.y + label.height / 2, { steps: 4 });
  release();
  await cursor(1);
  await page.waitForTimeout(100);
  assert.equal(
    await frame
      .locator("[data-slot=window]")
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
    "24px",
    "an older response must not remove the newer preview",
  );
  await page.mouse.up();
  await cursor(2);
  await expectFile(starting.replace(":root {\n", ":root {\n  --window-radius: 24px;\n"));
  page.once("dialog", (dialog) => dialog.accept());
  await button("Discard").click();
  await expectFile(starting);
  console.log("ok delayed save response preserves the next radius drag's preview");
  assert.deepEqual(errors, []);
} catch (error) {
  console.error(await state(), disk(), await page.locator(".message").textContent());
  throw error;
} finally {
  writeFileSync(file, starting);
  await browser.close();
}
