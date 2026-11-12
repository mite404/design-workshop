// oxlint-disable no-await-in-loop -- a lever drives one step at a time
// The type scale lever (ETH-109): drives the Workbench's Type panel at /__workbench/ in headless
// Chromium. At the baseline it checks the nine readouts and the sizes and line heights the frame
// renders; then Up twice in base size, a typed ratio of 1.25 and a typed leading of 1.4, which
// puts the 20px sm step's line exactly on the 4px grid, then Up once past it, each against values
// worked out by hand below. A drag on the Leading label saves on release, the values survive a
// reload, a size set on one heading in pixels holds while the steps around it move, Escape drops
// an unsaved change or a scrub in progress, malformed or out-of-range typed values are refused,
// a typed ratio of 1.001 saves as typed, and each Reset puts the app's own
// value back. Screenshots go to .artifacts/scale/. Exits 1 when any step fails. It writes the
// real override file and leaves it empty, so start from an empty one.
//
//   node apps/web/scripts/scale-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/scale"));
const OVERRIDES = path.join(ROOT, "packages/catalog/src/overrides.css");
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
const STEPS = ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"];
// [size, line height] per step, worked out by hand: base × ratio^(n - 1) rounded down to even,
// then size × leading rounded up to 4px.
const BASELINE = [10, 12, 14, 16, 20, 24, 28, 34, 42].map((s, i) => [
  s,
  [16, 16, 20, 24, 28, 32, 40, 48, 56][i],
]);
// Base 16, ratio 1.25: 12.8, 16, 20, 25, 31.25, 39.06, 48.83, 61.04 and 76.29 round down.
const SIZES = [12, 16, 20, 24, 30, 38, 48, 60, 76];
const AT_1_3 = [16, 24, 28, 32, 40, 52, 64, 80, 100]; // 15.6, 20.8, 26, 31.2, 39, 49.4, ...
const AT_1_4 = [20, 24, 28, 36, 44, 56, 68, 84, 108]; // sm: 20 × 1.4 = 28, on the grid
const AT_1_45 = [20, 24, 32, 36, 44, 56, 72, 88, 112]; // sm: 29 rounds up to 32
const AT_1_5 = [20, 24, 32, 36, 48, 60, 72, 92, 116];
const zip = (sizes, lines) => sizes.map((s, i) => [s, lines[i]]);

mkdirSync(out, { recursive: true });
assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "the override file starts empty");

const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const field = (name) => page.locator(`#wb-type-${name}`);
const file = (decls) => EMPTY.replace("}", decls.map((d) => `  ${d};\n`).join("") + "}");

// The readouts, and probes in the frame set to each step, rendered: [size, line box height].
async function scale() {
  const readouts = await page
    .locator(".scale-step")
    .evaluateAll((rows) =>
      rows.map((r) =>
        [...r.querySelectorAll("span:not(.times)")].map((s) => Number(s.textContent)),
      ),
    );
  const rendered = await frame.locator("body").evaluate((body, steps) => {
    const probes = steps.map((s) => {
      const p = body.ownerDocument.createElement("div");
      p.style.cssText = `position:absolute;font-size:var(--text-${s});line-height:var(--text-${s}--line-height)`;
      p.textContent = "Ag";
      body.append(p);
      return p;
    });
    const sizes = probes.map((p) => [
      Number.parseFloat(getComputedStyle(p).fontSize),
      p.getBoundingClientRect().height,
    ]);
    for (const p of probes) p.remove();
    return sizes;
  }, STEPS);
  return { readouts, rendered };
}
async function expectScale(want, decls) {
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8") !== file(decls); i++) {
    await page.waitForTimeout(100);
  }
  assert.equal(readFileSync(OVERRIDES, "utf8"), file(decls), "the override file");
  let got = await scale();
  for (
    let i = 0;
    i < 50 && JSON.stringify(got) !== JSON.stringify({ readouts: want, rendered: want });
    i++
  ) {
    await page.waitForTimeout(100);
    got = await scale();
  }
  assert.deepEqual(got.readouts, want, "the readouts");
  assert.deepEqual(got.rendered, want, "the rendered steps");
}
const expectField = (name, want) =>
  page.waitForFunction(
    ([n, w]) => document.querySelector(`#wb-type-${n}`)?.value === w,
    [name, want],
  );
async function type(name, value) {
  await field(name).click();
  await field(name).fill(value);
  await page.keyboard.press("Enter");
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

await step("at the baseline the nine steps are 10 to 42px, and render so", async () => {
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
  await expectField("base", "12");
  await expectField("ratio", "1.2");
  await expectField("leading", "1.3");
  await expectScale(BASELINE, []);
  await page.locator("details[aria-label=Type]").screenshot({ path: `${out}/baseline.png` });
});

await step("Up twice in base size previews 16px, and Enter saves it", async () => {
  await field("base").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "nothing saved while previewing");
  assert.equal((await scale()).rendered[1][0], 16, "xs previews at the new base");
  await page.keyboard.press("Enter");
  // 13.33, 16, 19.2, 23.04, 27.65, 33.18, 39.81, 47.78 and 57.33 round down; then × 1.3.
  const sizes = [12, 16, 18, 22, 26, 32, 38, 46, 56];
  await expectScale(zip(sizes, [16, 24, 24, 32, 36, 44, 52, 60, 76]), ["--type-base: 16px"]);
});

await step("a typed ratio of 1.25 saves, and every step follows", async () => {
  await type("ratio", "1.25");
  await expectScale(zip(SIZES, AT_1_3), ["--type-base: 16px", "--type-ratio: 1.25"]);
});

await step("leading 1.4 keeps sm's 28px line; Up to 1.45 rounds it up to 32px", async () => {
  await type("leading", "1.4");
  const saved = ["--type-base: 16px", "--type-ratio: 1.25", "--type-leading: 1.4"];
  await expectScale(zip(SIZES, AT_1_4), saved);
  await field("leading").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  await expectScale(zip(SIZES, AT_1_45), [...saved.slice(0, 2), "--type-leading: 1.45"]);
});

await step("a drag on the Leading label previews, and saves 1.5 on release", async () => {
  const label = page.locator("label[for=wb-type-leading]");
  const b = await label.boundingBox();
  await page.mouse.move(b.x + 10, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 14, b.y + b.height / 2, { steps: 4 });
  assert.equal((await scale()).rendered[4][1], 48, "previews 1.5's lg line (30 × 1.5) mid-drag");
  assert.match(readFileSync(OVERRIDES, "utf8"), /--type-leading: 1.45;/, "not saved mid-drag");
  await page.mouse.up();
  await expectScale(zip(SIZES, AT_1_5), [
    "--type-base: 16px",
    "--type-ratio: 1.25",
    "--type-leading: 1.5",
  ]);
  await expectField("leading", "1.5");
});

await step("the saved scale survives a reload and reaches the app", async () => {
  await page.reload();
  await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
  await expectField("base", "16");
  await expectField("ratio", "1.25");
  await expectField("leading", "1.5");
  assert.deepEqual((await scale()).readouts, zip(SIZES, AT_1_5));
  await page.screenshot({ path: `${out}/changed.png` });
});

await step("a heading's own pixel size holds while the steps move", async () => {
  await page.locator(".tool").click();
  await page.frames()[1].goto(`${base}/t/demo-brief`);
  const heading = frame.locator("h2").first();
  await heading.waitFor({ timeout: 30_000 });
  await heading.scrollIntoViewIfNeeded();
  await page.locator(".tool").click();
  const selects = () =>
    page.evaluate(() => {
      const s = document.querySelector(".selector")?.textContent ?? "";
      const h = document.querySelector("iframe").contentDocument.querySelector("h2");
      return s !== "" && document.querySelector("iframe").contentDocument.querySelector(s) === h;
    });
  for (let i = 0; i < 40 && !(await selects()); i++) {
    const b = await heading.boundingBox();
    await page.mouse.click(b.x + 30, b.y + b.height / 2);
    await page.waitForTimeout(35);
  }
  assert.ok(
    await selects(),
    `the heading is selected, not ${await page.locator(".selector").textContent()}`,
  );
  await page.locator("#wb-font-size").fill("15");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 50 && !readFileSync(OVERRIDES, "utf8").includes("font-size: 15px"); i++) {
    await page.waitForTimeout(100);
  }
  await type("base", "14");
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector("iframe").contentDocument.documentElement,
      ).getPropertyValue("--text-xs") === "14px",
  );
  assert.equal(await heading.evaluate((h) => getComputedStyle(h).fontSize), "15px");
  await page.getByRole("button", { name: "Reset size" }).click();
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8").includes("font-size"); i++) {
    await page.waitForTimeout(100);
  }
  assert.ok(!readFileSync(OVERRIDES, "utf8").includes("font-size"), "the size reset");
});

await step("Escape drops an unsaved change, and a value off the scale is refused", async () => {
  const saved = ["--type-base: 14px", "--type-ratio: 1.25", "--type-leading: 1.5"];
  await field("ratio").focus();
  await page.keyboard.press("ArrowUp");
  await expectField("ratio", "1.333");
  await page.keyboard.press("Escape");
  await expectField("ratio", "1.25");
  for (const value of ["abc", "-2", "0", "1.333", "1.45x"]) await type("leading", value);
  for (const value of ["1.5garbage", "1.2.3", "1e1", "0x2", "Infinity", "1.5 x", "1.0005"]) {
    await type("ratio", value);
  }
  assert.match(await page.locator(".message").textContent(), /^Not a ratio: 1\.0005$/);
  await type("base", "15"); // rounds down to 14, the value saved
  await page.waitForTimeout(300);
  assert.equal(readFileSync(OVERRIDES, "utf8"), file(saved));
  await expectField("base", "14");
  await expectField("ratio", "1.25");
  await expectField("leading", "1.5");
});

await step("Escape held mid-scrub cancels it, and the release saves nothing", async () => {
  const label = page.locator("label[for=wb-type-leading]");
  const b = await label.boundingBox();
  await page.mouse.move(b.x + 10, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 18, b.y + b.height / 2, { steps: 4 });
  await expectField("leading", "1.6");
  await page.keyboard.press("Escape");
  await expectField("leading", "1.5");
  await page.mouse.move(b.x + 30, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.equal(
    readFileSync(OVERRIDES, "utf8"),
    file(["--type-base: 14px", "--type-ratio: 1.25", "--type-leading: 1.5"]),
  );
  await expectField("leading", "1.5");
  assert.equal(await label.getAttribute("data-dragging"), null);
});

await step("a typed ratio of 1.001 saves as typed", async () => {
  await type("ratio", "1.001");
  for (let i = 0; i < 50 && !readFileSync(OVERRIDES, "utf8").includes("1.001;"); i++) {
    await page.waitForTimeout(100);
  }
  assert.equal(
    readFileSync(OVERRIDES, "utf8"),
    file(["--type-base: 14px", "--type-ratio: 1.001", "--type-leading: 1.5"]),
  );
  await expectField("ratio", "1.001");
});

await step("each Reset removes its value, and the app's own scale returns", async () => {
  for (const name of ["base size", "ratio", "leading"]) {
    await page.getByRole("button", { name: `Reset ${name}` }).click();
  }
  await expectScale(BASELINE, []);
  await expectField("base", "12");
  await page.getByRole("button", { name: "Reset leading", disabled: true }).waitFor();
});

await browser.close();
report(results, errors, out);
