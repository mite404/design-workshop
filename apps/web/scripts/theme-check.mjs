// oxlint-disable no-await-in-loop -- one browser and one override file, checked in order
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COLOUR_ROLES, TYPE_ROLES } from "../../../packages/workbench/src/theme.ts";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

// Theme story (docs/done/themes/themes-story.md) criteria, one step each.
const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/theme"));
const file = path.join(ROOT, ".workbench/overrides.css");
const themes = path.join(ROOT, ".workbench/themes");
const NAME = "theme-check";
const saved = path.join(themes, `${NAME}.theme.json`);
const written = [NAME, "pairing-check", "pairing-wide"].map((n) =>
  path.join(themes, `${n}.theme.json`),
);
/** @type {string} */
const starting = readFileSync(file, "utf8");
/** @type {boolean} */
const hadThemes = existsSync(themes);
// What git reports under .workbench/, so step 1.4 sees only what this run wrote there.
const workbenchStatus = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((l) => l.includes(".workbench/"));
/** @type {string[]} */
const startingStatus = workbenchStatus();
const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const form = page.getByRole("form", { name: "Save the colours as a theme" });
const nameField = page.getByRole("textbox", { name: "New theme name" });
const picker = page.getByRole("combobox", { name: "Apply a theme" });
const mode = page.getByRole("combobox", { name: "Canvas mode" });
const remove = page
  .locator('details[aria-label="Colours"]')
  .getByRole("button", { name: "Remove", exact: true });
const typeSection = page.locator('details[aria-label="Type"]');
const pairingPicker = page.getByRole("combobox", { name: "Apply a pairing" });
const pairingRemove = typeSection.getByRole("button", { name: "Remove", exact: true });
const PAIRING = "pairing-check";
const WIDE = "pairing-wide";
const MISSING = "Zzz Missing Sans";
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
  for (let i = 0; i < 100 && (await check()) !== true; i++) await page.waitForTimeout(50);
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

mkdirSync(themes, { recursive: true });
writeFileSync(
  path.join(themes, "pairing-wide.theme.json"),
  JSON.stringify({
    format: "design-workshop/theme",
    version: 1,
    name: "pairing-wide",
    type: { "text-font": `"Zzz Missing Sans", sans-serif`, "base-size": "14px", ratio: "1.25" },
  }),
);
// A tokens.css font stack as a theme saves it: its first family and its generic.
const savedForm = (stack) => {
  const parts = stack.split(",").map((p) => p.trim().replaceAll('"', ""));
  return `"${parts[0]}", ${parts.at(-1)}`;
};

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
    const changed = workbenchStatus().filter((l) => !startingStatus.includes(l));
    assert.deepEqual(changed.toSorted(), [
      "?? .workbench/themes/pairing-wide.theme.json",
      `?? .workbench/themes/${NAME}.theme.json`,
    ]);
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
    await until(async () => (await picker.inputValue()) === NAME, "picker settled on the baseline");
    await picker.focus();
    await page.keyboard.type("v");
    await until(() => disk().includes("--bg: #101010;"), "typing v on the picker loads vesper");
    await page.keyboard.press("Tab");
    assert.equal(await remove.evaluate((b) => b === document.activeElement), true);
    await page.keyboard.press("Enter");
    await until(() => disk() === starting, "Enter on Remove unloads it");
  });
  await step("3.1 Type saves the five type values as a pairing", async () => {
    const tokens = readFileSync(path.join(ROOT, "packages/catalog/src/tokens.css"), "utf8");
    const baseOf = (name) => new RegExp(`^\\s*${name}: ([^;]+);`, "m").exec(tokens)[1];
    await typeSection.getByRole("textbox", { name: "New pairing name" }).fill(PAIRING);
    await page
      .getByRole("form", { name: "Save the type as a pairing" })
      .getByRole("button", { name: "Save" })
      .click();
    const pairingFile = path.join(themes, `${PAIRING}.theme.json`);
    await until(() => existsSync(pairingFile), "pairing file written");
    const pairing = JSON.parse(readFileSync(pairingFile, "utf8"));
    assert.deepEqual(pairing.colours ?? {}, {}, "a pairing carries no colour roles");
    const want = Object.fromEntries(
      Object.entries(TYPE_ROLES).map(([role, name]) => [
        role,
        name.startsWith("--font-") ? savedForm(baseOf(name)) : baseOf(name),
      ]),
    );
    assert.deepEqual(pairing.type, want);
    await until(async () => (await pairingPicker.inputValue()) === PAIRING, "baseline pairing on");
  });

  await step("3.1 loading a pairing writes its type values", async () => {
    await pairingPicker.selectOption(WIDE);
    await until(() => disk().includes("--type-base: 14px;"), "pairing saved");
    assert.ok(disk().includes(`--font-text: "${MISSING}", sans-serif;`));
    await until(async () => (await pairingPicker.inputValue()) === WIDE, "picker shows it on");
  });

  await step("3.2 loading a pairing leaves colours and element values untouched", () => {
    const names = new Set(Object.values(TYPE_ROLES));
    const added = disk()
      .split("\n")
      .filter((line) => !starting.includes(line) && line.trim().startsWith("--"));
    assert.ok(added.length > 0);
    for (const line of added) assert.ok(names.has(line.trim().split(":")[0]), line);
    assert.equal(disk().split("{").length, starting.split("{").length, "no new selector block");
  });

  await step("3.3 a pairing's missing font shows the missing-font warning", async () => {
    const warning = typeSection.getByRole("img", {
      name: `${MISSING} is not in the repo or installed on this computer`,
    });
    await warning.waitFor({ timeout: 5000 });
    await typeSection.screenshot({ path: path.join(out, "pairing-missing.png") });
  });

  await step("3.1 unload removes the pairing in one undo step", async () => {
    await pairingRemove.click();
    await until(() => disk() === starting, "unload restores the file");
    await undo.click();
    await until(() => disk().includes("--type-base: 14px;"), "one undo puts the pairing back");
    await undo.click();
    await until(() => disk() === starting, "a second undo takes the load back");
  });
} finally {
  writeFileSync(file, starting);
  for (const f of written) rmSync(f, { force: true });
  if (!hadThemes) rmSync(themes, { recursive: true, force: true });
  await browser.close();
}
report(results, errors, out);
