// oxlint-disable no-await-in-loop -- one browser and one override file, checked in order
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLOUR_ROLES } from "../../../packages/workbench/src/theme.ts";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

// Theme story (docs/feature/themes/themes-story.md) criteria, one step each.
const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/theme"));
const file = path.join(ROOT, "packages/catalog/src/overrides.css");
const themes = path.join(ROOT, ".workbench/themes");
const NAME = "theme-check";
const saved = path.join(themes, `${NAME}.theme.json`);
const starting = readFileSync(file, "utf8");
const hadThemes = existsSync(themes);
const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const form = page.getByRole("form", { name: "Save the colours as a theme" });
const nameField = page.getByRole("textbox", { name: "New theme name" });
const picker = page.getByRole("combobox", { name: "Apply a theme" });
const mode = page.getByRole("combobox", { name: "Canvas mode" });
const remove = page.getByRole("button", { name: "Remove", exact: true });
const undo = page.getByRole("button", { name: "Undo", exact: true });
const canvasBg = () =>
  page
    .frameLocator("iframe")
    .locator("html")
    .evaluate((root) => getComputedStyle(root).getPropertyValue("--bg"));
const disk = () => readFileSync(file, "utf8");
const message = () => page.locator(".message").textContent();
const cursor = () =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("workbench-history")).history.cursor);
const results = [];
const step = async (name, run) => {
  try {
    results.push({ name, ok: true, detail: (await run()) ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};
mkdirSync(out, { recursive: true });

async function until(check, what) {
  for (let i = 0; i < 100 && !(await check()); i++) await page.waitForTimeout(50);
  assert.ok(await check(), `${what}: ${await message()}`);
}

// Each colour role's value as the inspector shows it in `want` mode.
async function shown(want) {
  await mode.selectOption(want);
  const label = want === "dark" ? "Dark" : "Light";
  await page.getByRole("heading", { name: `Colours · ${label}` }).waitFor();
  const entries = [];
  for (const [role, name] of Object.entries(COLOUR_ROLES)) {
    const field = page.getByRole("textbox", { name: `${name} hex`, exact: true });
    entries.push([role, (await field.inputValue()).toLowerCase()]);
  }
  return Object.fromEntries(entries);
}

async function save(name) {
  await nameField.fill(name);
  await form.getByRole("button", { name: "Save" }).click();
}

try {
  await page.goto(`${base}/__workbench/`);
  await page.frameLocator("iframe").locator("[data-wb]").first().waitFor();
  await until(async () => (await picker.locator("option").count()) > 1, "themes listed");

  await step("1.1 Colours has a Save control that asks for a name", async () => {
    assert.equal(await nameField.isVisible(), true);
    assert.equal(await nameField.getAttribute("required"), "");
    await page.locator(".inspector").screenshot({ path: path.join(out, "save-control.png") });
  });

  await step("1.2 the saved file holds every colour role, light and dark", async () => {
    const light = await shown("light");
    const dark = await shown("dark");
    await mode.selectOption("light");
    await save(NAME);
    await until(() => existsSync(saved), "theme file written");
    const theme = JSON.parse(readFileSync(saved, "utf8"));
    assert.deepEqual(Object.keys(theme.colours).toSorted(), Object.keys(COLOUR_ROLES).toSorted());
    for (const role of Object.keys(COLOUR_ROLES)) {
      assert.deepEqual(theme.colours[role], { light: light[role], dark: dark[role] }, role);
    }
    assert.deepEqual(theme.type ?? {}, {}, "a palette carries no type roles");
  });

  await step("1.2 reading it back gives the same values", async () => {
    await until(
      async () => (await picker.locator(`option[value="${NAME}"]`).count()) === 1,
      "listed",
    );
    const before = await cursor();
    await picker.selectOption(NAME);
    await page.waitForTimeout(500);
    assert.equal(disk(), starting, "applying the just-saved theme changes nothing");
    assert.equal(await cursor(), before, "and records no undo step");
  });

  await step("1.3 a name that already exists is refused, not overwritten", async () => {
    const before = readFileSync(saved, "utf8");
    await save(NAME);
    await until(async () => (await message())?.includes("already exists"), "refusal shown");
    assert.equal(readFileSync(saved, "utf8"), before);
    await page.locator(".inspector").screenshot({ path: path.join(out, "name-taken.png") });
  });

  await step("1.4 saving writes only that file", () => {
    assert.equal(disk(), starting, "override file untouched");
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const changed = status.split("\n").filter((l) => l.includes(".workbench/"));
    assert.deepEqual(changed, [`?? .workbench/themes/${NAME}.theme.json`]);
  });

  await step("2.1 loading writes a theme's values and the canvas shows them", async () => {
    await picker.selectOption("vesper");
    await until(() => disk().includes("--bg: #101010;"), "vesper saved");
    assert.equal(await mode.inputValue(), "dark", "a dark-only theme shows Dark");
    await until(async () => (await canvasBg()).trim() === "#101010", "canvas shows Vesper's --bg");
    await page.screenshot({ path: path.join(out, "vesper.png") });
  });

  await step("2.2 loading touches only colour values", () => {
    const added = disk()
      .split("\n")
      .filter((line) => !starting.includes(line) && line.trim().startsWith("--"));
    const names = new Set(Object.values(COLOUR_ROLES));
    for (const line of added) assert.ok(names.has(line.trim().split(":")[0]), line);
  });

  await step("2.4 a load is one step of undo", async () => {
    await undo.click();
    await until(() => disk() === starting, "one undo restores the file");
  });

  await step("2.3 unload removes the theme's values, back to the baseline", async () => {
    await picker.selectOption("vesper");
    await until(() => disk().includes("--bg: #101010;"), "vesper saved");
    await until(async () => (await picker.inputValue()) === "vesper", "picker shows vesper on");
    await page.locator(".inspector").screenshot({ path: path.join(out, "vesper-on.png") });
    await remove.click();
    await until(() => disk() === starting, "unload restores the file");
    await until(async () => (await canvasBg()).trim() === "#131212", "baseline --bg returns");
    // The theme saved in 1.2 is the baseline, so it is the one now in effect.
    await until(
      async () => (await picker.inputValue()) === NAME,
      "picker shows the baseline's theme",
    );
  });

  await step("2.4 an unload is one step of undo", async () => {
    await undo.click();
    await until(() => disk().includes("--bg: #101010;"), "one undo puts vesper back");
    await until(async () => (await picker.inputValue()) === "vesper", "and shows it on");
    await undo.click();
    await until(() => disk() === starting, "a second undo takes the load back");
  });

  await step("2.5 load and unload work from the keyboard", async () => {
    await picker.focus();
    await page.keyboard.type("v");
    const seen = await page.evaluate(() => [
      document.activeElement?.id,
      document.querySelector("#theme-file").value,
    ]);
    await until(
      () => disk().includes("--bg: #101010;"),
      `typing v on the picker loads vesper (${seen})`,
    );
    await page.keyboard.press("Tab");
    assert.equal(await remove.evaluate((b) => b === document.activeElement), true);
    await page.keyboard.press("Enter");
    await until(() => disk() === starting, "Enter on Remove unloads it");
  });
} finally {
  writeFileSync(file, starting);
  rmSync(hadThemes ? saved : path.join(ROOT, ".workbench"), { recursive: true, force: true });
  await browser.close();
}
report(results, errors, out);
