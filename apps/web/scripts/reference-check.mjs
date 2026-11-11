// oxlint-disable no-await-in-loop -- a lever drives one step at a time
// The element reference lever (ETH-110): drives the Workbench's chat at /__workbench/ in headless
// Chromium over the completed brief. The chat button opens the panel without starting a choice
// and the Select tool still selects; only the arrow button starts one. A pointer swept across a
// paragraph's bold words keeps the paragraph, a few pixels past a button keeps the button and a
// clear move leaves it; arrow keys reach a parent and the bold child. A press on the button
// while the highlight is still gliding there selects it, highlighted where it is, without
// clicking it. Add to chat adds a chip to the open panel beside the typed draft, removal keeps
// the draft, Escape leaves it untouched, and Send puts the button's own selector and preview in
// the message without any request. Removing the button marks the reference unresolved; its
// Reselect adds a new draft reference and the message keeps the old one. Screenshots go to
// .artifacts/reference/; `--video dir` records the run with a drawn pointer. Exits 1 when any
// step fails.
//
//   node apps/web/scripts/reference-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/reference"));
const video = arg("--video", undefined);
const theme = arg("--theme", "light");
const DRAFT = "Make this the primary action";
mkdirSync(out, { recursive: true });

const browser = await launch();
const { context, page, errors } = await workbenchPage(browser, {
  colorScheme: theme,
  ...(video === undefined
    ? {}
    : { recordVideo: { dir: video, size: { width: 1440, height: 900 } } }),
});
const frame = page.frameLocator("iframe");
const paragraph = frame.locator("p:visible", { hasText: "Leading with the" }).first();
const bold = paragraph.locator("strong");
const button = frame.locator("button:visible", { hasText: "Show it as a bar chart" });
const arrow = page.getByRole("button", { name: "Reference an element" });
const chatButton = page.getByRole("button", { name: "Chat" });
const chat = page.locator(".chat");
const draft = page.getByRole("textbox", { name: "Message" });
const label = page.locator(".target-label");
const chips = page.locator(".composer .chip");
const posts = [];
page.on("request", (r) => {
  if (r.method() !== "GET") posts.push(`${r.method()} ${r.url()}`);
});
const settle = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const box = async (locator) => {
  const b = await locator.boundingBox();
  assert.ok(b !== null, "on screen");
  return b;
};
const target = async () => {
  await settle();
  return (await page.locator(".target").isVisible()) ? await label.textContent() : null;
};

// Headless Chromium draws no pointer, so the recording gets a dot that follows it in both pages.
async function drawPointer() {
  await page.evaluate(() => {
    const dot = document.createElement("div");
    dot.style.cssText =
      "position:fixed;z-index:9999;width:14px;height:14px;margin:-7px;border-radius:50%;" +
      "background:rgb(0 0 0/.55);border:2px solid #fff;pointer-events:none;left:-20px";
    document.body.append(dot);
    const at = (x, y) => Object.assign(dot.style, { left: `${x}px`, top: `${y}px` });
    document.addEventListener("pointermove", (e) => at(e.clientX, e.clientY), true);
    const iframe = document.querySelector("iframe");
    iframe.contentWindow.addEventListener(
      "pointermove",
      (e) => {
        const r = iframe.getBoundingClientRect();
        at(r.left + e.clientX, r.top + e.clientY);
      },
      true,
    );
  });
}

const results = [];
async function step(name, run) {
  try {
    await run();
    results.push({ name, ok: true, detail: "" });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  await page.screenshot({
    path: path.join(out, `${results.length}-${name.replaceAll(/\W+/g, "-")}.png`),
  });
}

await page.goto(`${base}/__workbench/`);
await page.locator("iframe").waitFor();
await page.frames()[1].goto(`${base}/t/demo-brief`);
await button.waitFor({ timeout: 20_000 });
await page.frames()[1].waitForLoadState("load");
await paragraph.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
if (video !== undefined) await drawPointer();
const clicks = await button.evaluate((el) => {
  window.wbClicks = 0;
  el.addEventListener("click", () => window.wbClicks++);
  return 0;
});

await step("chat opens without starting a choice", async () => {
  await page.mouse.move(700, 600);
  await chatButton.click();
  await chat.locator("h2").waitFor({ state: "visible" });
  assert.equal(await chat.getAttribute("data-open"), "true");
  assert.equal(await arrow.getAttribute("aria-pressed"), "false");
  await draft.fill(DRAFT);
  const p = await box(paragraph);
  await page.mouse.move(p.x + 40, p.y + 8, { steps: 8 });
  assert.equal(await target(), null, "no highlight before the arrow");
  // The Select tool still selects in the preview.
  await page.mouse.click(p.x + 40, p.y + 8);
  assert.notEqual(await page.locator(".selector").textContent(), "");
});

await step("a sweep over bold words keeps the paragraph", async () => {
  await arrow.click();
  assert.equal(await arrow.getAttribute("aria-pressed"), "true");
  const b = await box(bold);
  const seen = new Set();
  for (let x = b.x - 60; x <= b.x + b.width + 60; x += 6) {
    await page.mouse.move(x, b.y + b.height / 2 + ((x / 6) % 2 === 0 ? 1 : -1));
    seen.add(await target());
  }
  assert.deepEqual([...seen], ["p · Leading with the longest-open cases, as…"]);
});

await step("arrow keys reach the bold child and the container", async () => {
  await page.keyboard.press("ArrowDown");
  assert.equal(await target(), "strong · longest-open cases");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.notEqual(await target(), "p · Leading with the longest-open cases, as…");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  assert.equal(await target(), "strong · longest-open cases");
});

await step("the highlight holds near a button and leaves it on a clear move", async () => {
  await button.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const b = await box(button);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  assert.equal(await target(), "button · Show it as a bar chart");
  await page.mouse.move(b.x + b.width + 3, b.y + b.height / 2, { steps: 3 });
  assert.equal(await target(), "button · Show it as a bar chart", "3px past the edge");
  await page.mouse.move(b.x + b.width + 30, b.y + b.height / 2, { steps: 6 });
  assert.notEqual(await target(), "button · Show it as a bar chart", "30px past the edge");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  assert.equal(await target(), "button · Show it as a bar chart");
});

await step("a click during travel selects the button where it shows", async () => {
  const b = await box(button);
  await page.mouse.move(b.x + b.width + 50, b.y + b.height / 2, { steps: 6 });
  await page.waitForTimeout(300); // settled on the container
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); // at once, while the highlight is still on its way
  await settle();
  const [shown, now] = [await box(page.locator(".target")), await box(button)];
  await page.mouse.up();
  for (const k of ["x", "y", "width", "height"]) {
    assert.ok(
      Math.abs(shown[k] - now[k]) < 1,
      `highlight ${k} ${shown[k]} is the button's ${now[k]}`,
    );
  }
  assert.equal(await button.evaluate(() => window.wbClicks), clicks);
  assert.equal(await page.locator(".stage-label").textContent(), "button · Show it as a bar chart");
});

await step("add to chat puts a chip beside the draft", async () => {
  await page.getByRole("button", { name: "Add to chat" }).click();
  await settle();
  assert.equal(await page.locator(".chat").count(), 1);
  assert.equal(await chat.getAttribute("data-open"), "true");
  assert.equal(await draft.inputValue(), DRAFT);
  assert.equal(await chips.count(), 1);
  assert.equal(await chips.locator(".chip-label").textContent(), "button · Show it as a bar chart");
  assert.equal(await arrow.getAttribute("aria-pressed"), "false");
  assert.equal(await target(), null);
});

await step("removing the chip keeps the draft", async () => {
  await page.getByRole("button", { name: "Remove button · Show it as a bar chart" }).click();
  assert.equal(await chips.count(), 0);
  assert.equal(await draft.inputValue(), DRAFT);
});

await step("escape leaves the choice and the draft alone", async () => {
  await arrow.click();
  const b = await box(button);
  await page.mouse.move(b.x + 10, b.y + 10, { steps: 6 });
  await page.keyboard.press("Escape");
  assert.equal(await arrow.getAttribute("aria-pressed"), "false");
  assert.equal(await target(), null);
  assert.equal(await draft.inputValue(), DRAFT);
});

await step("the keyboard chooses and attaches", async () => {
  await arrow.focus();
  await page.keyboard.press("Enter");
  assert.equal(await arrow.getAttribute("aria-pressed"), "true");
  const b = await box(button);
  await page.mouse.move(b.x + 10, b.y + 10, { steps: 6 });
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .getByRole("button", { name: "Add to chat" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(await chips.count(), 1);
  assert.equal(await draft.inputValue(), DRAFT);
});

let sent = "";
await step("send keeps the reference's identity in the message", async () => {
  await page.getByRole("button", { name: "Send" }).click();
  const ref = chat.locator(".chat-message .chip");
  assert.equal(await ref.count(), 1);
  assert.equal(await chat.locator(".chat-message p").textContent(), DRAFT);
  assert.equal(await ref.getAttribute("data-preview"), "Live · /t/demo-brief");
  sent = (await ref.getAttribute("data-selector")) ?? "";
  assert.equal(
    await button.evaluate((el, s) => {
      const all = el.ownerDocument.querySelectorAll(s);
      return all.length === 1 && all[0] === el;
    }, sent),
    true,
    `${sent} is the button alone`,
  );
  assert.equal(await draft.inputValue(), "");
  assert.equal(await chips.count(), 0);
  assert.deepEqual(posts, [], "no request left the page");
});

await step("a removed element is unresolved, not replaced", async () => {
  await button.evaluate((el) => el.remove());
  await settle();
  assert.equal(await chat.locator(".chat-message .chip").getAttribute("data-unresolved"), "true");
});

await step("a sent unresolved reference is reselected into the draft", async () => {
  await draft.fill(DRAFT);
  await chat.getByRole("button", { name: "Reselect button · Show it as a bar chart" }).click();
  assert.equal(await arrow.getAttribute("aria-pressed"), "true");
  const p = await box(paragraph);
  await page.mouse.move(p.x + 40, p.y + 8, { steps: 6 });
  await page.mouse.click(p.x + 40, p.y + 8);
  await page.getByRole("button", { name: "Add to chat" }).click();
  assert.equal(
    await chips.locator(".chip-label").textContent(),
    "p · Leading with the longest-open cases, as…",
  );
  await page.locator('.composer .chip[data-unresolved="false"]').waitFor();
  assert.equal(await draft.inputValue(), DRAFT);
  const sentChip = chat.locator(".chat-message .chip");
  assert.equal(
    await sentChip.getAttribute("data-selector"),
    sent,
    "the message keeps its reference",
  );
  assert.equal(await sentChip.getAttribute("data-unresolved"), "true");
  await page.screenshot({ path: path.join(out, "reselected.png") });
  await page
    .getByRole("button", { name: "Remove p · Leading with the longest-open cases, as…" })
    .click();
  await draft.fill("");
});

await step("a component preview reference names its preview", async () => {
  await page.locator(".tool").click(); // the Select tool off, so the preview takes the click
  await frame.getByRole("button", { name: "Component mode" }).click();
  const section = frame.locator('section[aria-label="Component mode"]');
  await section.waitFor();
  await page.locator(".tool").click();
  const inside = section.locator("p:visible").first();
  await inside.scrollIntoViewIfNeeded();
  await arrow.click();
  const b = await box(inside);
  await page.mouse.move(b.x + 20, b.y + b.height / 2, { steps: 10 });
  await page.mouse.click(b.x + 20, b.y + b.height / 2);
  await page.getByRole("button", { name: "Add to chat" }).click();
  assert.match((await chips.getAttribute("data-preview")) ?? "", /^Component · \/t\/demo-brief/u);
});

await context.close();
await browser.close();
report(results, errors, out);
