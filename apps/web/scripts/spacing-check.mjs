// oxlint-disable no-await-in-loop, no-console -- a lever drives one step at a time and reports on stdout
// The spacing lever (ETH-102): drives the Workbench at /__workbench/ in headless Chromium through
// the completed brief's "Catalog limit" card, a flex column: select it, drag its gap
// by an uneven amount, drag a padding with Alt, type an odd value, Escape mid-drag, reset, and
// delete values left matching nothing. Each step checks the computed style, the inspector's field and the
// override file. Screenshots go to .artifacts/spacing/. Exits 1 when any step fails. It writes
// the real override file and leaves it empty, so start from an empty one.
//
//   node apps/web/scripts/spacing-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/spacing"));
const video = arg("--video", undefined);
const OVERRIDES = path.join(ROOT, "packages/catalog/src/overrides.css");
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
mkdirSync(out, { recursive: true });
assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "the override file starts empty");

const browser = await launch();
const { context, page, errors } = await workbenchPage(
  browser,
  video === undefined ? {} : { recordVideo: { dir: out } },
);
const frame = page.frameLocator("iframe");
const card = frame.locator("section.card.state").first();
const selector = page.locator(".selector");
const fieldOf = (name) => page.locator(`#wb-${name}`);
const bar = (name) => page.locator(`.bar[data-name=${name}]:not([hidden])`).first();
const center = async (locator) => {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
// oxlint-disable-next-line prefer-number-coercion -- Number("12px") is NaN
const computed = (locator, name) =>
  locator.evaluate(
    (el, n) => Number.parseFloat(getComputedStyle(el).getPropertyValue(n)) || 0,
    name === "gap" ? "row-gap" : name,
  );
let sel = "";
const file = (decls) =>
  decls.length === 0 ? EMPTY : `${EMPTY}${sel} {\n${decls.map((d) => `  ${d};\n`).join("")}}\n`;

// Whether the Workbench's selection is `locator`'s element, by its selector matching it alone.
const selects = async (locator) => {
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const text = await selector.textContent();
  return locator.evaluate((el, s) => {
    const all = s === "" ? [] : el.ownerDocument.querySelectorAll(s);
    return all.length === 1 && all[0] === el;
  }, text ?? "");
};

// The card's `name`, its inspector field and the override file all agree, the file once its
// write lands and the inline value once the hot reload does.
async function expectSpacing(name, px, decls) {
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8") !== file(decls); i++) {
    await page.waitForTimeout(100);
  }
  assert.equal(readFileSync(OVERRIDES, "utf8"), file(decls), "override file");
  await page.waitForFunction(
    ([id, want]) => document.querySelector(`#wb-${id}`).value === String(want),
    [name, px],
  );
  assert.equal(await computed(card, name), px, `computed ${name}`);
  await card.evaluate(async (el) => {
    for (let i = 0; i < 100 && el.getAttribute("style"); i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  assert.equal((await card.getAttribute("style")) ?? "", "", "no inline value left behind");
  assert.equal(await computed(card, name), px, `computed ${name} from the file`);
}

// Drags from `locator`'s centre by dx, dy, holding `keys`, and runs `during` before release.
async function dragBy(locator, dx, dy, keys = [], during = async () => {}) {
  const from = await center(locator);
  await page.mouse.move(from.x, from.y);
  for (const key of keys) await page.keyboard.down(key);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await during();
  await page.mouse.up();
  for (const key of keys) await page.keyboard.up(key);
}

const results = [];
const step = async (name, run) => {
  try {
    const detail = (await run()) ?? "";
    results.push({ name, ok: true, detail });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};

await step("with the select tool off, the completed conversation is ready", async () => {
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
  await page.locator(".tool").click();
  assert.equal(await page.locator(".tool").getAttribute("aria-pressed"), "false");
  await page.frames()[1].goto(`${base}/t/demo-brief`);
  await card.waitFor({ timeout: 30_000 });
  assert.equal(await frame.locator('[data-slot="demo-controls"]').count(), 0);
  await card.scrollIntoViewIfNeeded();
  await page.locator(".tool").click();
});

// A point in the card's top padding, where the card is the deepest element under the pointer,
// away from the middle of the edge, where a padding handle takes the click.
const inPadding = async () => {
  const b = await card.boundingBox();
  return { x: b.x + 60, y: b.y + 6 };
};

await step("clicks select from the outside in, and never reach the app", async () => {
  await card.evaluate((el) => {
    el.ownerDocument.defaultView.clicks = 0;
    el.ownerDocument.addEventListener("click", () => el.ownerDocument.defaultView.clicks++);
  });
  const click = async () => {
    const at = await inPadding();
    await page.mouse.click(at.x, at.y);
  };
  await card.scrollIntoViewIfNeeded();
  await click();
  assert.ok(
    await selects(frame.locator("[data-slot=window]")),
    "the first click selects the window",
  );
  for (let i = 0; i < 30 && !(await selects(card)); i++) await click();
  assert.ok(await selects(card), "repeated clicks reach the card");
  await click();
  assert.ok(await selects(card), "a click on the deepest element keeps it");
  assert.equal(await card.evaluate((el) => el.ownerDocument.defaultView.clicks), 0);
  const outline = await page.locator(".outline").boundingBox();
  const box = await card.boundingBox();
  for (const k of ["x", "y", "width", "height"]) assert.ok(Math.abs(outline[k] - box[k]) <= 1, k);
  await page.screenshot({ path: `${out}/01-card-selected.png` });
});

await step("a click on a child selects it, one level deeper; Escape selects the card", async () => {
  const child = card.locator(":scope > *").nth(1);
  const at = await center(child);
  await page.mouse.click(at.x, at.y);
  assert.ok(await selects(child));
  await page.keyboard.press("Escape");
  assert.ok(await selects(card));
  sel = (await selector.textContent()) ?? "";
  assert.doesNotMatch(sel, /\./, "no class names in the selector");
  assert.equal(await page.locator(".bar[data-name=gap]:not([hidden])").count(), 2);
  assert.equal(await fieldOf("gap").inputValue(), "0");
  assert.equal(await fieldOf("padding-left").inputValue(), "16");
});

await step("hovering the gap handle highlights the gap and shows its value", async () => {
  const gap = await center(bar("gap"));
  await page.mouse.move(gap.x - 40, gap.y);
  await page.mouse.move(gap.x, gap.y, { steps: 4 });
  assert.equal(await page.locator(".pill").textContent(), "Gap 0");
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector(".space[data-name=gap]")).opacity === "1",
  );
  const area = await page.locator(".space[data-name=gap]").first().boundingBox();
  const content = await card.boundingBox();
  assert.ok(
    Math.abs(area.width - (content.width - 34)) <= 1,
    `across the content box, inside border and padding: ${area.width}`,
  );
  await page.screenshot({ path: `${out}/02-gap-hovered.png` });
});

await step("dragging the gap handle 7px down snaps the gap to 8", async () => {
  await dragBy(bar("gap"), 3, 7, [], async () => {
    assert.equal(await computed(card, "gap"), 8, "live while dragging"); // 7 → 8
    assert.equal(await page.locator(".pill").textContent(), "Gap 8");
  });
  await expectSpacing("gap", 8, ["gap: 8px"]);
});

await step("dragging the left padding 5px in with Alt sets left and right to 22", async () => {
  await dragBy(bar("padding-left"), 5, 0, ["Alt"], async () => {
    assert.equal(await computed(card, "padding-left"), 22);
    assert.equal(await computed(card, "padding-right"), 22);
    assert.equal(await computed(card, "padding-top"), 18);
    assert.equal(
      await page
        .locator('.space[data-name="padding-right"]')
        .evaluate((el) => getComputedStyle(el).opacity),
      "1",
      "Alt highlights the opposite padding band",
    );
    const readout = await page.locator(".pill").boundingBox();
    const content = await card.boundingBox();
    assert.ok(readout.x + readout.width <= content.x + 1, "readout stays outside card text");
    await page.screenshot({ path: `${out}/03-padding-drag.png` });
  });
  await expectSpacing("padding-right", 22, [
    "gap: 8px",
    "padding-right: 22px",
    "padding-left: 22px",
  ]);
  await expectSpacing("padding-left", 22, [
    "gap: 8px",
    "padding-right: 22px",
    "padding-left: 22px",
  ]);
});

await step("clicking the top handle opens a field; 13 and Enter sets an odd value", async () => {
  const top = await center(bar("padding-top"));
  await page.mouse.click(top.x, top.y);
  const inplace = page.locator(".inplace");
  await inplace.waitFor();
  assert.equal(await inplace.inputValue(), "18");
  await inplace.fill("13");
  await inplace.press("Enter");
  assert.equal(await inplace.isHidden(), true);
  await expectSpacing("padding-top", 13, [
    "gap: 8px",
    "padding-right: 22px",
    "padding-left: 22px",
    "padding-top: 13px",
  ]);
});

const saved = ["gap: 8px", "padding-right: 22px", "padding-left: 22px", "padding-top: 13px"];

await step("Escape mid-drag restores the gap from before the drag", async () => {
  await dragBy(bar("gap"), 0, 30, [], async () => {
    assert.equal(await computed(card, "gap"), 38);
    await page.keyboard.press("Escape");
    assert.equal(await computed(card, "gap"), 8);
  });
  await expectSpacing("gap", 8, saved);
});

await step("arrow keys on a focused handle step by 2; the field's arrows by 1", async () => {
  await bar("gap").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expectSpacing("gap", 10, saved.with(0, "gap: 10px"));
  await fieldOf("gap").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Enter");
  await expectSpacing("gap", 21, saved.with(0, "gap: 21px"));
});

await step("Tab reaches every handle in turn", async () => {
  await bar("padding-top").focus();
  const order = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => document.activeElement.dataset.name));
  }
  assert.deepEqual(order, ["padding-right", "padding-bottom", "padding-left", "gap"]);
  await page.keyboard.press("Shift+Tab");
});

await step("a value set in the element's own style is read-only", async () => {
  await card.evaluate((el) => el.style.setProperty("padding-bottom", "4px"));
  const child = await center(card.locator(":scope > *").nth(1));
  await page.mouse.click(child.x, child.y);
  await page.keyboard.press("Escape");
  assert.ok(await selects(card));
  await page.waitForFunction(() => document.querySelector("#wb-padding-bottom").readOnly);
  assert.equal(await fieldOf("padding-bottom").getAttribute("readonly"), "");
  assert.equal(await page.locator(".note").isVisible(), true);
  assert.equal(await page.locator(".bar[data-name=padding-bottom]").isHidden(), true);
  await card.evaluate((el) => el.style.removeProperty("padding-bottom"));
  await page.mouse.click(child.x, child.y);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#wb-padding-bottom").readOnly);
  assert.equal(await fieldOf("padding-bottom").getAttribute("readonly"), null);
});

await step("Reset on the gap field removes it and the card's own 0 returns", async () => {
  await page.getByRole("button", { name: "Reset gap" }).click();
  await expectSpacing("gap", 0, saved.slice(1));
  await page.getByRole("button", { name: "Reset gap", disabled: true }).waitFor();
});

await step("clicking empty space deselects", async () => {
  await page.mouse.click(6, 450);
  await page.locator(".overlay[data-selected=false]").waitFor();
  assert.equal(await page.locator("section[aria-label=Selection]").isHidden(), true);
});

await step("values whose selector matches nothing are listed and can be deleted", async () => {
  await page.frames()[1].goto(`${base}/`);
  await frame.locator("[data-slot=window]").waitFor();
  const list = page.locator(".unmatched li");
  await list.first().waitFor();
  assert.deepEqual(await list.locator("span").allTextContents(), [
    "padding-right: 22px",
    "padding-left: 22px",
    "padding-top: 13px",
  ]);
  for (let n = 3; n > 0; n--) {
    await list
      .first()
      .getByRole("button", { name: /^Delete/ })
      .click();
    await page.waitForFunction(
      (want) => document.querySelectorAll(".unmatched li").length === want,
      n - 1,
    );
  }
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
  assert.equal(
    await page.locator("section[aria-label='Saved values that match nothing']").isHidden(),
    true,
  );
});

await context.close();
if (video !== undefined) await page.video().saveAs(video);
await browser.close();
report(results, errors, out);
