// oxlint-disable no-await-in-loop, no-console -- browser checks run sequentially and report on stdout
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/layers"));
const overrides = path.join(ROOT, "packages/catalog/src/overrides.css");
const starting = readFileSync(overrides, "utf8");
mkdirSync(out, { recursive: true });
const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe.frame");
const tree = frame.getByRole("tree", { name: "Components" });
const row = (name) => tree.getByRole("treeitem", { name, exact: true });

async function selected(locator) {
  const selector = await page.locator(".selector").textContent();
  return locator.evaluate((el, s) => el.ownerDocument.querySelector(s) === el, selector);
}

try {
  await page.goto(`${base}/__workbench/?path=/t/demo-brief`);
  await tree.waitFor({ timeout: 15_000 });
  const toggle = frame.getByRole("button", { name: "Toggle sidebar" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await frame
    .locator('[data-slot="sidebar-container"]')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
  assert.equal(await row("AgentTurn").first().getAttribute("aria-expanded"), "false");
  assert.equal(await row("IconButton").count(), 0, "nested components start folded into groups");
  const panel = frame.locator('[data-wb="ChatThreadPanel"]').first();
  await row("ChatThreadPanel").first().locator(':scope > [data-sidebar="menu-button"]').click();
  assert.ok(await selected(panel), "a tree click selects the real component");
  assert.equal(
    await page.evaluate(
      () => document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode,
    ),
    "live",
    "a Live row click selects in place",
  );
  const scroller = frame.locator(".thread-scroll").first();
  const scrolled = () => scroller.evaluate((element) => element.scrollTop);
  const shown = (name) =>
    frame
      .locator(`[data-wb="${name}"]`)
      .first()
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      });
  assert.ok(await shown("ComposeBox"));
  assert.equal(await shown("UserTurn"), false, "the first turn starts above the fold");
  const before = await scrolled();
  await row("ComposeBox").first().locator(':scope > [data-sidebar="menu-button"]').click();
  assert.equal(await scrolled(), before, "a visible component does not scroll");
  await row("UserTurn").first().locator(':scope > [data-sidebar="menu-button"]').click();
  assert.ok(await shown("UserTurn"), "an off-screen component scrolls fully into view");
  await row("ChatThreadPanel").first().locator(':scope > [data-sidebar="menu-button"]').click();
  await frame.getByRole("button", { name: "Live mode", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode === "live",
  );
  const fromRow = await page.locator(".selector").textContent();
  await page.waitForTimeout(50);
  assert.equal(
    await frame.locator('[data-slot="sidebar-content"]').evaluate((element) => element.scrollLeft),
    0,
    "selecting a visible root keeps the drawer's horizontal inset",
  );
  await page.screenshot({ path: path.join(out, "selected-component.png") });
  const padding = page.locator("#wb-padding-top");
  await padding.fill("13");
  await padding.press("Enter");
  await page.getByRole("button", { name: "Undo", exact: true, disabled: false }).waitFor();
  const edited = readFileSync(overrides, "utf8");
  assert.notEqual(edited, starting);
  await row("ChatThreadPanel").first().focus();
  await page.keyboard.press("Control+z");
  await page.getByRole("button", { name: "Undo", exact: true, disabled: true }).waitFor();
  assert.equal(readFileSync(overrides, "utf8"), starting, "tree focus allows history undo");
  await page.keyboard.press("Control+Shift+z");
  await page.getByRole("button", { name: "Redo", exact: true, disabled: true }).waitFor();
  assert.equal(readFileSync(overrides, "utf8"), edited, "tree focus allows history redo");
  await page.locator(".tool").click();
  await frame.getByRole("button", { name: "Component mode", exact: true }).click();
  assert.equal(
    await frame.locator('[aria-label="Component preview"]').count(),
    0,
    "opening from the tree retains the live workspace",
  );
  assert.equal(await frame.locator('[data-wb="ChatThreadPanel"]').count(), 1);
  assert.equal(await frame.locator(fromRow).count(), 1, "saved Live selector stays instance-only");
  await frame.getByRole("button", { name: "Live mode", exact: true }).click();
  await row("ChatThreadPanel").first().focus();
  await page.keyboard.press("Control+z");
  await page.getByRole("button", { name: "Undo", exact: true, disabled: true }).waitFor();
  assert.equal(readFileSync(overrides, "utf8"), starting);
  await page.locator(".tool").click();
  await row("ChatThreadPanel").first().locator(':scope > [data-sidebar="menu-button"]').click();
  await page.locator("body").press("Escape");
  const box = await panel.boundingBox();
  for (let i = 0; i < 20 && !(await selected(panel)); i++) {
    await page.mouse.click(box.x + 20, box.y + 5);
  }
  assert.ok(await selected(panel), "canvas and row agree");
  assert.equal(await row("ChatThreadPanel").first().getAttribute("aria-selected"), "true");

  await row("ComposeBox").first().locator(':scope > [data-sidebar="menu-button"]').hover();
  assert.equal(await page.locator(".tree-outline").isVisible(), true, "hover outlines the target");
  const hoverBox = await page.locator(".tree-outline").boundingBox();
  const composeBox = await frame.locator('[data-wb="ComposeBox"]').first().boundingBox();
  assert.equal(Math.round(hoverBox.width), Math.round(composeBox.width));
  await row("ChatThreadPanel").first().focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await row("ChatThreadPanel").first().getAttribute("aria-expanded"), "false");
  await page.keyboard.press("ArrowRight");
  assert.equal(await row("ChatThreadPanel").first().getAttribute("aria-expanded"), "true");
  assert.equal(
    await row("UserTurn")
      .first()
      .locator(':scope > [data-sidebar="menu-button"]')
      .evaluate((element) => getComputedStyle(element).boxShadow),
    "none",
    "a focused parent does not draw focus rings on its descendants",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.notEqual(await page.locator(".selector").textContent(), fromRow);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  assert.ok(await selected(panel));

  const paragraph = frame.locator('[data-wb="CatalogCard"].state p').first();
  await paragraph.scrollIntoViewIfNeeded();
  const h = await paragraph.boundingBox();
  for (let i = 0; i < 30 && !(await selected(paragraph)); i++) {
    await page.mouse.click(h.x + h.width * 0.4, h.y + h.height * 0.7);
  }
  assert.ok(await selected(paragraph), "a paragraph inside a component remains selectable");
  assert.equal(
    await tree.locator('[aria-selected="true"]').getAttribute("aria-label"),
    "CatalogCard",
  );
  await toggle.click();
  await page.locator("body").press("Escape");
  assert.equal(
    await toggle.getAttribute("aria-expanded"),
    "false",
    "selection does not open drawer",
  );
  await toggle.click();

  await row("CatalogCard").first().focus();
  await page.keyboard.press("Control+b");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false", "tree allows drawer shortcut");
  await page.keyboard.press("Control+b");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await page.setViewportSize({ width: 630, height: 900 });
  await frame.locator('[data-mobile="true"][data-slot="sidebar"]').waitFor({ state: "attached" });
  await toggle.click();
  await row("UserTurn").first().focus();
  await page.keyboard.press("Escape");
  assert.equal(
    await toggle.getAttribute("aria-expanded"),
    "false",
    "tree Escape closes mobile drawer",
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  assert.ok((await row("UserTurn").count()) > 0);
  const expand = tree.getByRole("button", { name: /^Expand / });
  while ((await expand.count()) > 0) await expand.first().click();
  assert.ok((await row("IconButton").count()) > 0);
  assert.ok(
    await frame
      .locator('[data-slot="sidebar-content"]')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
    "a fully expanded tree keeps every row and chevron inside the drawer",
  );
  await page.locator(".tool").click();
  await frame.getByRole("link", { name: "Home", exact: true }).click();
  await frame.locator(".welcome").waitFor();
  await row("UserTurn").first().waitFor({ state: "detached" });
  assert.equal(await tree.locator('[data-slot="sidebar"]').count(), 0);
  assert.equal(await row("sidebar").count(), 0, "the drawer never lists itself");

  const standalone = await browser.newPage();
  await standalone.goto(base);
  await standalone.locator(".welcome").getByRole("link", { name: "Demo", exact: true }).click();
  await standalone.locator('[data-thread="main"]').first().waitFor({ state: "attached" });
  assert.equal(await standalone.getByRole("tree").count(), 0, "outside Workbench lists threads");
  assert.ok((await standalone.locator('[data-thread="main"]').count()) > 0);
  await standalone.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS layers: row/canvas selection, hover, keyboard, ancestor, closed drawer, navigation, standalone",
  );
} finally {
  await browser.close();
  if (readFileSync(overrides, "utf8") !== starting) writeFileSync(overrides, starting);
}
