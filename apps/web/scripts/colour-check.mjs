// oxlint-disable no-await-in-loop, no-console -- one browser and one override file, checked in order
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const storybook = arg("--storybook", "");
const out = arg("--out", path.join(ROOT, ".artifacts/colour"));
const file = path.join(ROOT, "packages/catalog/src/overrides.css");
const starting = readFileSync(file, "utf8");
const browser = await launch();
const { page, context, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const paper = page.getByRole("textbox", { name: "--paper hex", exact: true });
const ink = page.getByRole("textbox", { name: "--ink hex", exact: true });
const mode = page.getByRole("combobox", { name: "Canvas mode" });
const disk = () => readFileSync(file, "utf8");
const history = () =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("workbench-history")).history);
mkdirSync(out, { recursive: true });

async function saved(text) {
  for (let i = 0; i < 100 && !disk().includes(text); i++) await page.waitForTimeout(50);
  assert.ok(
    disk().includes(text),
    `missing ${text}: ${await page.locator(".message").textContent()}`,
  );
}

async function value(field, want) {
  await page.waitForFunction(
    ({ name, expected }) => document.querySelector(`[aria-label="${name}"]`).value === expected,
    { name: await field.getAttribute("aria-label"), expected: want },
  );
}

async function edit(field, hex) {
  const { cursor } = await history();
  await field.fill(hex);
  await field.press("Enter");
  await saved(hex);
  // The file changes before the Workbench reads the response and records the undo step.
  await page.waitForFunction(
    (n) => JSON.parse(sessionStorage.getItem("workbench-history")).history.cursor > n,
    cursor,
  );
}

async function background(want) {
  await frame.locator('[data-slot="window"]').evaluate(
    (root, expected) =>
      new Promise((resolve, reject) => {
        let tries = 0;
        const poll = () => {
          const probe = root.ownerDocument.createElement("div");
          probe.style.color = expected;
          root.append(probe);
          const rgb = getComputedStyle(probe).color;
          probe.remove();
          if (getComputedStyle(root).backgroundColor === rgb) resolve();
          else if (++tries > 200) reject(new Error("canvas paper did not update"));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
    want,
  );
}

try {
  await context.route(/api\.fontsource\.org|cdn\.jsdelivr\.net/, (route) => route.abort());
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor();
  await frame.locator('[data-wb="ChatThreadPanel"]').waitFor();
  await mode.selectOption("light");
  await value(paper, "#f0efea");
  const before = (await history()).cursor;
  await paper.fill("#f1d4a7");
  await background("#f1d4a7");
  assert.equal(disk(), starting, "typing previews without saving");
  await paper.press("Escape");
  await value(paper, "#f0efea");
  assert.equal(disk(), starting);
  await paper.fill("#12345678");
  await paper.press("Enter");
  await value(paper, "#f0efea");
  assert.equal(disk(), starting, "alpha hex is rejected");
  await edit(paper, "#f1d4a7");
  await background("#f1d4a7");
  assert.equal((await history()).cursor, before + 1, "one release is one undo step");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await value(paper, "#f0efea");
  assert.equal(disk(), starting);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await value(paper, "#f1d4a7");
  await mode.selectOption("dark");
  await value(paper, "#242223");
  await background("#242223");
  await edit(paper, "#17283b");
  assert.match(disk(), /:root\[data-theme="light"\] \{\n  --paper: #f1d4a7;/);
  assert.match(disk(), /:root\[data-theme="dark"\] \{\n  --paper: #17283b;/);
  await page.reload();
  await value(paper, "#17283b");
  await frame.locator('[data-wb="ChatThreadPanel"]').waitFor();
  await edit(ink, "#18293c");
  const inkRatios = ink.locator("xpath=../..").locator('.contrast [data-low="true"]');
  assert.ok((await inkRatios.count()) > 0);
  await page.screenshot({ path: `${out}/dark-flag.png` });
  await page.getByRole("button", { name: "Reset --ink", exact: true }).click();
  await value(ink, "#fff7ed");
  await page.getByRole("button", { name: "Reset --paper", exact: true }).click();
  await value(paper, "#242223");
  await mode.selectOption("light");
  await value(paper, "#f1d4a7");
  await edit(ink, "#b5a58f");
  assert.ok((await inkRatios.count()) > 0);
  await page.screenshot({ path: `${out}/light-flag.png` });
  await page.getByRole("button", { name: "Reset --ink", exact: true }).click();
  await value(ink, "#252524");
  await page.getByRole("button", { name: "Reset --paper", exact: true }).click();
  await value(paper, "#f0efea");
  assert.equal(disk(), starting, "resets restore every starting byte");
  const sage = page.getByRole("textbox", { name: "--sage hex", exact: true });
  await edit(sage, "#123456");
  await mode.selectOption("dark");
  await value(sage, "#c7cfba");
  await mode.selectOption("light");
  await page.getByRole("button", { name: "Reset --sage", exact: true }).click();
  await value(sage, "#c7cfba");
  assert.equal(disk(), starting, "a colour inherited by dark is isolated too");
  if (storybook !== "") {
    const story = await context.newPage();
    await story.goto(`${storybook}/iframe.html?id=sidebar-section--folded&viewMode=story`);
    const label = story.getByRole("button", { name: "Archived, 3" });
    await label.waitFor();
    const soft = page.getByRole("textbox", { name: "--soft-ink hex", exact: true });
    await edit(soft, "#314159");
    await story.waitForFunction(() => {
      const node = document.querySelector('[data-slot="sidebar-group-label"]');
      return node !== null && getComputedStyle(node).color === "rgb(49, 65, 89)";
    });
    await page.getByRole("button", { name: "Reset --soft-ink", exact: true }).click();
    await value(soft, "#565650");
    await story.close();
    console.log("ok shadcn SidebarGroupLabel in Storybook follows the saved colour");
  }
  assert.ok(
    (await page
      .getByRole("textbox", { name: "--rule hex", exact: true })
      .getAttribute("readonly")) !== null,
  );
  const picker = page.locator('input[aria-label="Pick --paper"]');
  await picker.focus();
  await picker.evaluate((el) => {
    el.value = "#f2dfbc";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await background("#f2dfbc");
  assert.equal(disk(), starting, "picker input previews only");
  await picker.press("Escape");
  await value(paper, "#f0efea");
  await picker.focus();
  await picker.evaluate((el) => {
    el.value = "#d9e8f1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await saved("#d9e8f1");
  await page.getByRole("button", { name: "Discard", exact: true }).waitFor({ state: "visible" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await value(paper, "#f0efea");
  assert.equal(disk(), starting, "discard restores the committed file");
  assert.deepEqual(errors, []);
  console.log(
    "ok colour modes, inherited colours, live preview, Escape, validation, contrast, reset, undo, redo, reload and discard",
  );
} finally {
  writeFileSync(file, starting);
  await browser.close();
}
