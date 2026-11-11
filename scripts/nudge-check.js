// oxlint-disable no-await-in-loop, no-console -- browser steps run in order
// Run against the dev server. Writes the real override file and restores it even on failure.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT } from "../apps/web/scripts/harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/nudge"));
const file = path.join(ROOT, "packages/catalog/src/overrides.css");
const original = readFileSync(file, "utf8");
const browser = await launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const frame = page.frameLocator("iframe");
const card = frame.locator("section.card.state").first();
const heading = card.locator("h2, h3, h4").first();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
mkdirSync(out, { recursive: true });

const center = async (locator) => {
  const b = await locator.boundingBox();
  assert.ok(b, "element has a box");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const selects = async (locator) =>
  locator.evaluate(
    (el, selector) => {
      return selector !== "" && el.ownerDocument.querySelector(selector) === el;
    },
    await page.locator(".selector").textContent(),
  );
// The handles and fields follow the selection on the next frame; a click before it lands on a
// stale handle.
const frameDone = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
const select = async (locator) => {
  for (let i = 0; i < 30 && !(await selects(locator)); i++) {
    await frameDone();
    const at = await center(locator);
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(35);
  }
  await frameDone(); // the fields show the new selection
  assert.ok(await selects(locator), "clicks select the target");
};
const offset = () => heading.evaluate((el) => getComputedStyle(el).translate);
const expectOffset = async (x, y) => {
  await page.waitForFunction(
    ([wantX, wantY]) =>
      document.querySelector("#wb-x").value === String(wantX) &&
      document.querySelector("#wb-y").value === String(wantY),
    [x, y],
  );
  const selector = await page.locator(".selector").textContent();
  const value = x === 0 && y === 0 ? null : `${x}px ${y}px`;
  for (let i = 0; i < 100; i++) {
    const saved = await page.evaluate(
      async () => (await (await fetch("/__workbench/values")).json()).saved,
    );
    if (
      (saved[selector]?.translate ?? null) === value &&
      (await heading.evaluate((el) => el.style.translate === ""))
    )
      break;
    await page.waitForTimeout(50);
  }
  const saved = await page.evaluate(
    async () => (await (await fetch("/__workbench/values")).json()).saved,
  );
  assert.equal(saved[selector]?.translate ?? null, value, "saved offset");
  assert.equal(
    await heading.evaluate((el) => el.style.translate),
    "",
    "stylesheet replaces inline preview",
  );
  const computed = await offset();
  assert.ok(
    value === null ? computed === "none" : computed === value || (y === 0 && computed === `${x}px`),
    `computed offset ${computed}`,
  );
};
const drag = async (dx, dy, keys = [], during = async () => {}) => {
  const at = await center(heading);
  const bounds = await heading.boundingBox();
  at.x = bounds.x + 40;
  await page.mouse.move(at.x, at.y);
  for (const key of keys) await page.keyboard.down(key);
  await page.mouse.down();
  await page.mouse.move(at.x + dx, at.y + dy, { steps: 10 });
  await during();
  await page.mouse.up();
  for (const key of keys) await page.keyboard.up(key);
};
const type = async (axis, value) => {
  const input = page.locator(`#wb-${axis}`);
  await input.fill(String(value));
  await input.press("Enter");
};

try {
  await page.goto(`${base}/__workbench/?path=%2Ft%2Fdemo-brief`);
  await frame.locator("[data-slot=window]").waitFor();
  assert.equal(await page.locator("iframe").getAttribute("src"), "/t/demo-brief");
  await page.locator(".tool").click();
  await frame.locator("[data-slot=demo-controls], section.card.state").first().waitFor();
  const welcome = frame.locator("[data-slot=welcome]");
  if (await welcome.count())
    await welcome.getByRole("button", { name: "Live mode", exact: true }).click();
  const toolbar = frame.getByRole("toolbar", { name: "Scripted demo" });
  if (await toolbar.count()) {
    await toolbar.getByRole("button", { name: "Fast forward, 2x" }).click();
    await toolbar.getByRole("button", { name: "Play", exact: true }).click();
    await frame
      .locator("[data-slot=demo-status]", { hasText: "Done" })
      .waitFor({ timeout: 90_000 });
  }
  await card.scrollIntoViewIfNeeded();
  await page.locator(".tool").click();
  await select(heading);
  const baseline = await heading.boundingBox();
  const siblings = card.locator(":scope > :not(h2):not(h3):not(h4)");
  const boxes = await siblings.evaluateAll((nodes) =>
    nodes.map((el) => el.getBoundingClientRect().toJSON()),
  );
  await page.screenshot({ path: `${out}/01-selected.png` });
  console.log("ok app path opens the requested conversation; real clicks select its heading");

  await drag(7, 5, [], async () => {
    assert.equal(await page.locator(".pill").textContent(), "X 8  Y 6");
    const live = await heading.boundingBox();
    assert.equal(live.x - baseline.x, 8);
    assert.equal(live.y - baseline.y, 6);
    await page.screenshot({ path: `${out}/02-mid-drag.png` });
  });
  await expectOffset(8, 6);
  assert.deepEqual(
    await siblings.evaluateAll((nodes) => nodes.map((el) => el.getBoundingClientRect().toJSON())),
    boxes,
    "sibling layout remains unchanged",
  );
  console.log("ok uneven pointer drag snaps to 8/6; sibling boxes stay unchanged; save settles");

  const beforeEscape = readFileSync(file, "utf8");
  await drag(-11, 13, [], async () => {
    await page.keyboard.press("Escape");
    assert.equal(await offset(), "8px 6px");
  });
  await expectOffset(8, 6);
  assert.equal(readFileSync(file, "utf8"), beforeEscape);
  console.log("ok Escape restores the earlier offset without writing");

  await drag(-21, 7, ["Shift"]);
  await expectOffset(-10, 10);
  await page.keyboard.press("ArrowRight");
  await expectOffset(-8, 10);
  await page.keyboard.press("Shift+ArrowDown");
  await expectOffset(-8, 20);
  console.log("ok Shift drag and body arrows use 2px/10px grids");

  await drag(2000, 2000);
  const bounded = await heading.boundingBox();
  const parent = await heading.evaluate((el) => {
    const p = el.parentElement;
    const b = p.getBoundingClientRect();
    const s = getComputedStyle(p);
    return {
      right: b.right - parseFloat(s.borderRightWidth),
      bottom: b.bottom - parseFloat(s.borderBottomWidth),
    };
  });
  assert.ok(bounded.x + bounded.width <= parent.right + 0.01);
  assert.ok(bounded.y + bounded.height <= parent.bottom + 0.01);
  assert.ok(parent.right - bounded.x - bounded.width < 2);
  assert.ok(parent.bottom - bounded.y - bounded.height < 2);
  console.log(
    "ok pointer capture continues past the iframe; both axes stop inside the padding edge",
  );

  await type("x", 0);
  await type("y", 0);
  await expectOffset(0, 0);
  assert.deepEqual(await heading.boundingBox(), baseline, "zero returns to the original layout");
  assert.doesNotMatch(readFileSync(file, "utf8"), /translate:/);
  await type("x", -7);
  await expectOffset(-7, 0);
  await type("y", 3);
  await expectOffset(-7, 3);
  for (const invalid of ["abc", "1.5", "9999"]) {
    await type("x", invalid);
    await expectOffset(-7, 3);
  }
  await page.locator("#wb-x").press("ArrowUp");
  await page.locator("#wb-x").press("Shift+ArrowUp");
  await page.locator("#wb-x").press("Enter");
  await expectOffset(4, 3);
  for (const value of [1, 2, 3, 4, 5, 6, 7, 8]) await type("x", value);
  await expectOffset(8, 3);
  await page.getByRole("button", { name: "Reset x", exact: true }).click();
  await page.getByRole("button", { name: "Reset y", exact: true }).click();
  await expectOffset(0, 0);
  console.log("ok signed odd fields save; zero and Reset remove translate from the file");

  for (const property of ["transform", "translate", "rotate", "scale"]) {
    await heading.evaluate(
      (el, name) =>
        el.style.setProperty(
          name,
          name === "transform"
            ? "rotate(2deg)"
            : name === "translate"
              ? "3px 2px"
              : name === "rotate"
                ? "2deg"
                : "0.98",
        ),
      property,
    );
    await page.keyboard.press("Escape");
    await select(heading);
    assert.equal(await page.locator("#wb-x").getAttribute("readonly"), "");
    assert.equal(await page.locator("#wb-y").getAttribute("readonly"), "");
    assert.ok(await page.getByText("Offset is read-only", { exact: false }).isVisible());
    if (property === "transform") await page.screenshot({ path: `${out}/03-native-readonly.png` });
    await heading.evaluate((el, name) => el.style.removeProperty(name), property);
    await page.keyboard.press("Escape");
    await select(heading);
  }
  assert.equal(await page.locator("#wb-x").getAttribute("readonly"), null);
  assert.deepEqual(errors, []);
  console.log("ok native transform/translate/rotate/scale stay read-only; no browser errors");
} catch (error) {
  console.error(
    JSON.stringify(
      await page.evaluate(() => ({
        selection: document.querySelector(".selector").textContent,
        fields: [document.querySelector("#wb-x").value, document.querySelector("#wb-y").value],
        message: document.querySelector(".message").textContent,
        sheets: [...document.querySelector("iframe").contentDocument.styleSheets]
          .filter((s) => s.ownerNode?.dataset?.viteDevId?.endsWith("overrides.css"))
          .map((s) => ({ disabled: s.disabled, rules: [...s.cssRules].map((r) => r.cssText) })),
      })),
      null,
      2,
    ),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
  if (readFileSync(file, "utf8") !== original) writeFileSync(file, original);
  assert.equal(readFileSync(file, "utf8"), original, "override file restored");
}
