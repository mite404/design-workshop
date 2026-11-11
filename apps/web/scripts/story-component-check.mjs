// oxlint-disable no-console, no-await-in-loop -- a browser check drives one action at a time
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/stories"));
const endpoint = `${base}/__workbench/values`;
const browser = await launch();
const initial = await (await fetch(endpoint)).json();
mkdirSync(out, { recursive: true });
const { page, errors } = await workbenchPage(browser);

try {
  assert.deepEqual(initial.saved, {}, "run in a disposable checkout with empty overrides");
  await page.goto(`${base}/__workbench/`);
  const app = page.frameLocator("iframe.frame");
  const sidebar = app.getByRole("button", { name: /sidebar/i }).first();
  if ((await sidebar.getAttribute("aria-expanded")) !== "true") await sidebar.click();
  await app.getByRole("button", { name: "Component mode", exact: true }).click();
  if (process.argv.includes("--offline")) {
    await app.getByRole("status").filter({ hasText: "pnpm storybook" }).waitFor();
    await app
      .getByRole("tree", { name: "Components" })
      .getByRole("treeitem", { name: "ChatThreadPanel", exact: true })
      .first()
      .focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("iframe.frame").style.maskImage !== "");
    const opened = new URL(page.url()).searchParams.get("component");
    assert.ok(opened);
    assert.equal(await app.locator(opened).getAttribute("data-wb"), "ChatThreadPanel");
    assert.equal(new URL(page.url()).searchParams.has("story"), false);
    await app.getByRole("status").filter({ hasText: "pnpm storybook" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, "storybook-stopped.png") });
    assert.deepEqual(errors, []);
    console.log(
      "Stopped Storybook names its start command; opening a rendered component still works.",
    );
  } else {
    const stories = app.getByRole("tree", { name: "Stories" });
    await stories.waitFor({ timeout: 5000 });
    for (const name of ["Thread", "Chat thread panel"]) {
      const row = stories.getByRole("treeitem", { name, exact: true });
      await row.focus();
      await page.keyboard.press("ArrowRight");
    }
    await stories.getByRole("treeitem", { name: "Standard", exact: true }).focus();
    await page.keyboard.press("Enter");
    const story = app.frameLocator("iframe[data-wb-story]");
    const card = story.locator('[data-wb="CatalogCard"]').first();
    await card.waitFor();
    assert.equal(
      new URL(page.url()).searchParams.get("story"),
      "thread-chat-thread-panel--standard",
    );
    assert.equal(await page.locator("iframe.frame").evaluate((node) => node.style.maskImage), "");
    for (let i = 0; i < 8; i++) {
      await card.click({ position: { x: 30, y: 25 } });
      if ((await page.locator(".selector").textContent()) === '[data-wb="CatalogCard"]') break;
    }
    assert.equal(await page.locator(".selector").textContent(), '[data-wb="CatalogCard"]');
    const outline = await page.locator(".outline").boundingBox();
    const bounds = await card.boundingBox();
    assert.ok(
      Math.abs(outline.x - bounds.x) < 2 && Math.abs(outline.y - bounds.y) < 2,
      "nested overlay aligns",
    );
    const before = await card.evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft));
    const handle = await page
      .locator('.bar[data-name="padding-left"]:not([hidden])')
      .first()
      .boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 18, handle.y + handle.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    const storyPage = page.frames().find((child) => child.url().includes("/__stories/iframe.html"));
    assert.ok(storyPage);
    await storyPage.waitForFunction(
      (value) => {
        const node = document.querySelector('[data-wb="CatalogCard"]');
        return (
          node !== null &&
          getComputedStyle(node).paddingLeft === `${value}px` &&
          node.style.paddingLeft === ""
        );
      },
      before + 18,
      { timeout: 10000 },
    );
    assert.ok(
      readFileSync(`${ROOT}/packages/catalog/src/overrides.css`, "utf8").includes(
        '[data-wb="CatalogCard"] {',
      ),
    );
    await app.locator('[data-slot="sidebar-content"]').evaluate((node) => {
      node.scrollTop = 0;
    });
    const visibleCard = story.locator('[data-wb="CatalogCard"]').last();
    for (let i = 0; i < 8; i++) {
      await visibleCard.click({ position: { x: 30, y: 25 } });
      if ((await page.locator(".selector").textContent()) === '[data-wb="CatalogCard"]') break;
    }
    assert.equal(await page.locator(".selector").textContent(), '[data-wb="CatalogCard"]');
    await page.getByText("Colours · Light", { exact: true }).click();
    await page.screenshot({ path: path.join(out, "light.png") });
    await page.locator("#theme").selectOption("dark");
    await story.locator('html[data-theme="dark"]').waitFor();
    await page.screenshot({ path: path.join(out, "dark.png") });
    await app.getByRole("button", { name: "Live mode", exact: true }).click();
    await app.locator('[data-wb="CatalogCard"]').first().waitFor();
    assert.equal(
      await app
        .locator('[data-wb="CatalogCard"]')
        .first()
        .evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft)),
      before + 18,
    );
    await app.getByRole("button", { name: "Component mode", exact: true }).click();
    await card.waitFor();
    await page.reload();
    await card.waitFor();
    assert.equal(
      new URL(page.url()).searchParams.get("story"),
      "thread-chat-thread-panel--standard",
    );
    await story.locator('html[data-theme="dark"]').waitFor();
    await story.locator("body").click({ position: { x: 16, y: 16 } });
    assert.equal(
      await page.locator(".selector").textContent(),
      "",
      "unnamed surroundings are not selected",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Story keyboard opening, nested selection and overlay, shared padding HMR, theme, mode switches and reload passed.",
    );
  }
} finally {
  if (errors.length > 0) console.error(errors);
  await browser.close();
  const current = await (await fetch(endpoint)).json();
  const changes = Object.entries(current.saved).flatMap(([selector, rule]) =>
    Object.entries(rule).map(([name, was]) => ({ selector, name, was, value: null })),
  );
  if (changes.length > 0 && Object.keys(initial.saved).length === 0) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ head: current.head, changes }),
    });
    assert.equal(response.status, 200, "restore through the Workbench API");
  }
}
