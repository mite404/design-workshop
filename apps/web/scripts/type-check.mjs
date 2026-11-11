// oxlint-disable no-await-in-loop, no-console -- a lever drives one step at a time and reports on stdout
// The type lever (ETH-105): drives the Workbench at /__workbench/ in headless Chromium through the
// first heading of the scripted demo brief: select it, pick a larger step, type 15, pick Bold
// Italic, set letter spacing to -0.5, press Up twice in line height, align centre, align a taller
// block to the bottom, then reset each. Each step checks the computed style, the control and the
// override file. Screenshots go to .artifacts/type/. Exits 1 when any step fails. It writes the
// real override file and leaves it empty, so start from an empty one.
//
//   node apps/web/scripts/type-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/type"));
const OVERRIDES = path.join(ROOT, "packages/catalog/src/overrides.css");
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
mkdirSync(out, { recursive: true });
assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "the override file starts empty");
const sorted = (list) => list.toSorted((a, b) => a.localeCompare(b));
const changed = () =>
  sorted(
    execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(3)),
  );
const before = changed();

const browser = await launch();
const { context, page, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const heading = frame.locator("h2").first();
const panel = page.locator("section[aria-label=Typography]");
const control = (id) => page.locator(`#wb-${id}`);
const css = (name) => heading.evaluate((el, n) => getComputedStyle(el).getPropertyValue(n), name);
let sel = "";
const file = (decls) =>
  decls.length === 0 ? EMPTY : `${EMPTY}${sel} {\n${decls.map((d) => `  ${d};\n`).join("")}}\n`;

const selects = async (locator) => {
  const text = (await page.locator(".selector").textContent()) ?? "";
  return locator.evaluate(
    (el, s) => s !== "" && el.ownerDocument.querySelectorAll(s)[0] === el,
    text,
  );
};
// Clicks 30px in from the left at mid height: on a 24px tall element the padding handles cover
// its centre and left edge, and a click on one opens its field instead of selecting deeper.
const select = async (locator) => {
  for (let i = 0; i < 40 && !(await selects(locator)); i++) {
    const b = await locator.boundingBox();
    await page.mouse.click(b.x + 30, b.y + b.height / 2);
    await page.waitForTimeout(35);
  }
  assert.ok(await selects(locator), "clicks select the heading");
};

// The file holds `decls`, the heading has no inline value left, and its computed `name` is
// `value` from the file.
async function expectType(decls, name, value) {
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8") !== file(decls); i++) {
    await page.waitForTimeout(100);
  }
  const note = await page.locator(".message").textContent();
  assert.equal(readFileSync(OVERRIDES, "utf8"), file(decls), `override file ${note}`);
  await heading.evaluate(async (el) => {
    for (let i = 0; i < 100 && el.getAttribute("style"); i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  assert.equal((await heading.getAttribute("style")) ?? "", "", "no inline value left behind");
  for (let i = 0; i < 50 && (await css(name)) !== value; i++) await page.waitForTimeout(100);
  assert.equal(await css(name), value, `computed ${name} from the file`);
}
const expectControl = (id, want) =>
  page.waitForFunction(([i, w]) => document.querySelector(`#wb-${i}`)?.value === w, [id, want], {
    timeout: 5000,
  });

const results = [];
const step = async (name, run) => {
  try {
    await run();
    results.push({ name, ok: true, detail: "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};

await step("the demo brief's first heading is selected and the section shows it", async () => {
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
  await page.locator(".tool").click();
  await page.frames()[1].goto(`${base}/t/demo-brief`);
  await heading.waitFor({ timeout: 30_000 });
  await heading.scrollIntoViewIfNeeded();
  await page.locator(".tool").click();
  await select(heading.locator(".."));
  await panel.waitFor({ state: "hidden" });
  await select(heading);
  sel = (await page.locator(".selector").textContent()) ?? "";
  await panel.waitFor();
  assert.equal(await page.locator(".type-family").textContent(), "Inter Variable");
  await expectControl("font-size", "14");
  assert.equal(await page.locator("#wb-font-size + .unit").textContent(), "sm");
  assert.equal(await control("style").inputValue(), "550");
  assert.equal(await control("style").locator("option").first().textContent(), "550");
  assert.ok((await control("style").locator("option").allTextContents()).includes("Bold Italic"));
  assert.equal(await control("line-height").inputValue(), "24");
  assert.equal(await control("letter-spacing").inputValue(), "-1.4");
  assert.equal(
    await page.locator("[aria-label='Align left']").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".type-align").nth(1).isHidden(), true, "one line, no vertical");
  await page.screenshot({ path: `${out}/01-heading-selected.png` });
});

await step("Up in Size moves one step live; the list picks a larger step", async () => {
  await control("font-size").focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await css("font-size"), "16px", "live during the change");
  await page.keyboard.press("Escape");
  assert.equal(await css("font-size"), "14px", "Escape puts it back");
  await page.getByRole("button", { name: "Size steps" }).click();
  await page.locator("#wb-steps").waitFor();
  assert.equal(
    await page.locator("#wb-steps [aria-selected=true] span").first().textContent(),
    "sm",
  );
  assert.equal(await page.locator("#wb-steps [data-step=lg] .unit").textContent(), "20");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/02-size-list.png` });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expectType(["font-size: var(--text-lg)"], "font-size", "20px");
  await expectControl("font-size", "20");
  assert.equal(await page.locator("#wb-font-size + .unit").textContent(), "lg");
  assert.deepEqual(
    changed(),
    sorted([...new Set([...before, "packages/catalog/src/overrides.css"])]),
  );
});

await step("typing 15 saves pixels and marks the size off the scale", async () => {
  await control("font-size").fill("15");
  await control("font-size").press("Enter");
  await expectType(["font-size: 15px"], "font-size", "15px");
  const mark = page.locator("#wb-font-size + .unit");
  assert.equal(await mark.textContent(), "off");
  assert.equal(await control("font-size").inputValue(), "15");
  assert.equal(await mark.getAttribute("data-off"), "true");
  await page.screenshot({ path: `${out}/03-off-scale.png` });
});

await step("Bold Italic sets weight and italic together", async () => {
  await control("style").selectOption({ label: "Bold Italic" });
  await expectType(
    ["font-size: 15px", "font-weight: 700", "font-style: italic"],
    "font-weight",
    "700",
  );
  assert.equal(await css("font-style"), "italic");
  assert.equal(await control("style").inputValue(), "700i");
});

await step("letter spacing -0.5 saves -0.005em", async () => {
  await control("letter-spacing").fill("-0.5");
  await control("letter-spacing").press("Enter");
  const decls = [
    "font-size: 15px",
    "font-weight: 700",
    "font-style: italic",
    "letter-spacing: -0.005em",
  ];
  await expectType(decls, "letter-spacing", "-0.075px");
  await expectControl("letter-spacing", "-0.5");
});

await step("Up twice in line height moves 24 to 32", async () => {
  await control("line-height").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await css("line-height"), "32px", "live during the change");
  await page.keyboard.press("Enter");
  const decls = [
    "font-size: 15px",
    "font-weight: 700",
    "font-style: italic",
    "letter-spacing: -0.005em",
    "line-height: 32px",
  ];
  await expectType(decls, "line-height", "32px");
  await expectControl("line-height", "32");
});

const story = [
  "font-size: 15px",
  "font-weight: 700",
  "font-style: italic",
  "letter-spacing: -0.005em",
  "line-height: 32px",
  "text-align: center",
];

await step("align centre", async () => {
  await page.getByRole("button", { name: "Align center" }).click();
  await expectType(story, "text-align", "center");
  assert.equal(
    await page.getByRole("button", { name: "Align center" }).getAttribute("aria-pressed"),
    "true",
  );
});

await step("a block taller than its text aligns to the bottom", async () => {
  await heading.evaluate((el) => (el.style.minHeight = "80px"));
  const bottom = page.getByRole("button", { name: "Align bottom" });
  await bottom.waitFor();
  const top = await heading.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().top - el.getBoundingClientRect().top;
  });
  await bottom.click();
  for (let i = 0; i < 50 && !readFileSync(OVERRIDES, "utf8").includes("align-content"); i++) {
    await page.waitForTimeout(100);
  }
  assert.ok(readFileSync(OVERRIDES, "utf8").includes("  align-content: end;\n"));
  assert.equal(await css("align-content"), "end");
  const moved = await heading.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().top - el.getBoundingClientRect().top;
  });
  assert.ok(moved > top + 40, `the text moved down: ${top} → ${moved}`);
  await page.getByRole("button", { name: "Reset vertical alignment" }).click();
  await heading.evaluate((el) => el.style.removeProperty("min-height"));
  await expectType(story, "align-content", "normal");
  await page.locator(".type-align").nth(1).waitFor({ state: "hidden" });
});

await step("each reset removes its value and the heading's own value returns", async () => {
  const resets = [
    ["horizontal alignment", "text-align", "start"],
    ["line height", "line-height", "24px"],
    ["letter spacing", "letter-spacing", "-0.2px"],
    ["style", "font-weight", "550"],
    ["size", "font-size", "14px"],
  ];
  let left = story;
  for (const [label, name, value] of resets) {
    await page.getByRole("button", { name: `Reset ${label}` }).click();
    left = left.filter(
      (d) => !d.startsWith(name) && !(label === "style" && d.startsWith("font-style")),
    );
    await expectType(left, name, value);
  }
  assert.equal(await css("font-style"), "normal");
  await expectControl("font-size", "14");
  assert.equal(await page.locator("#wb-font-size + .unit").textContent(), "sm");
  assert.equal(await control("style").inputValue(), "550");
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
});

await step("a type value in the element's own style is read-only", async () => {
  await heading.evaluate((el) => el.style.setProperty("font-size", "18px"));
  await page.keyboard.press("Escape");
  await page.locator("section[aria-label=Typography]:not([hidden])").waitFor({ state: "detached" });
  await select(heading);
  await page.waitForFunction(() => document.querySelector("#wb-font-size").readOnly);
  assert.equal(await page.getByRole("button", { name: "Size steps" }).isDisabled(), true);
  assert.equal(await panel.locator(".type-note").isVisible(), true);
  await heading.evaluate((el) => el.style.removeProperty("font-size"));
});

await context.close();
await browser.close();
report(results, errors, out);
