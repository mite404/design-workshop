// oxlint-disable no-await-in-loop -- one browser drives one page, checked in order
// Role map check (ETH-157): a shadcn-style scratch app whose config maps theme roles to its own
// variables loads a bundled theme through `design-workshop dev`, and its own variables change.
//   node apps/web/scripts/role-map-check.mjs [--out dir]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const out = path.resolve(arg("--out", path.join(ROOT, ".artifacts/role-map")));
const APP_PORT = 5192;
const PROXY_PORT = 5182;
const { createServer } = await import(
  createRequire(path.join(ROOT, "packages/workbench/package.json")).resolve("vite")
);
const { startDev } = await import(path.join(ROOT, "packages/workbench/src/dev.ts"));

const app = mkdtempSync(path.join(tmpdir(), "role-map-scratch-"));
// shadcn's names: `--background` on `:root` for light, `.dark` for dark.
writeFileSync(
  path.join(app, "globals.css"),
  ":root {\n  --background: #dddddd;\n  --foreground: #222222;\n}\n.dark {\n  --background: #333333;\n}\n",
);
writeFileSync(
  path.join(app, "index.html"),
  `<!doctype html><html><head><link rel="stylesheet" href="/globals.css" /><style>
body { background: var(--background); color: var(--foreground); }
</style></head><body><div data-slot="window">Scratch app</div></body></html>\n`,
);
mkdirSync(path.join(app, ".workbench"));
const appOverrides = path.join(app, ".workbench/overrides.css");
writeFileSync(
  appOverrides,
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n",
);
writeFileSync(
  path.join(app, ".workbench/config.json"),
  JSON.stringify({
    format: "design-workshop/config",
    version: 1,
    sources: ["."],
    storybook: null,
    tokens: "globals.css",
    roles: { page: "--background", ink: "--foreground" },
    colourSelectors: { light: ":root:not(.dark)", dark: ".dark" },
  }),
);
writeFileSync(path.join(app, ".gitignore"), ".vite/\n");
const git = (...args) => execFileSync("git", args, { cwd: app, encoding: "utf8" });
git("init", "-q");
git("add", ".");
git("-c", "user.name=check", "-c", "user.email=check@example.com", "commit", "-qm", "init");
const vite = await createServer({
  root: app,
  configFile: false,
  appType: "spa",
  logLevel: "silent",
  server: { port: APP_PORT, strictPort: true },
});
await vite.listen();
await startDev(`http://localhost:${APP_PORT}`, PROXY_PORT, app);

mkdirSync(out, { recursive: true });
const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const results = [];
const step = async (name, run) => {
  try {
    results.push({ name, ok: true, detail: (await run()) ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};
/** @returns {string} */
const disk = () => readFileSync(appOverrides, "utf8");
const picker = page.getByRole("combobox", { name: "Apply a theme" });
const background = () =>
  page
    .frameLocator("iframe")
    .locator("body")
    .evaluate((b) => getComputedStyle(b).backgroundColor);
async function until(check, what) {
  for (let i = 0; i < 100 && (await check()) !== true; i++) await page.waitForTimeout(50);
  if ((await check()) !== true) throw new Error(`timed out: ${what}`);
}

try {
  await page.goto(`http://localhost:${PROXY_PORT}/__workbench/?path=%2F`, { timeout: 120_000 });
  await page.frameLocator("iframe").locator('[data-slot="window"]').waitFor({ timeout: 120_000 });
  await until(async () => (await picker.locator("option").count()) > 1, "themes listed");

  await step("a light theme sets the app's own --background and --foreground", async () => {
    await picker.selectOption("catppuccin-latte");
    await until(() => disk().includes("--background: #eff1f5;"), "latte saved");
    if (!disk().includes("--foreground: #4c4f69;")) throw new Error("ink not mapped");
    if (/--bg:|--ink:|--olive:/.test(disk()))
      throw new Error(`Template names written to the app:\n${disk()}`);
    await until(async () => (await background()) === "rgb(239, 241, 245)", "canvas shows it");
    await page.screenshot({ path: path.join(out, "latte.png") });
  });

  await step("one undo takes the theme back off", async () => {
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await until(() => !disk().includes("--background"), "undo emptied the file");
    await until(async () => (await background()) === "rgb(221, 221, 221)", "baseline back");
  });

  await step("a dark theme writes into the app's dark selector", async () => {
    await picker.selectOption("vesper");
    await until(() => /\.dark \{\n {2}--background: #101010;/.test(disk()), "vesper in .dark");
  });

  await step(
    "the Colours section edits the app's own role colours, not the Template's",
    async () => {
      // Undo Vesper and show light mode, then edit the light page colour by hand.
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await until(() => !disk().includes("--background"), "vesper undone");
      await page.getByRole("combobox", { name: "Canvas mode" }).selectOption("light");
      const rows = await page.locator(".colour-row label").allTextContents();
      if (rows.join() !== "--background,--foreground") throw new Error(`rows: ${rows.join()}`);
      const field = page.getByRole("textbox", { name: "--background hex", exact: true });
      await field.fill("#123456");
      await field.press("Enter");
      await until(
        () => /:root:not\(\.dark\) \{\n {2}--background: #123456;/.test(disk()),
        "saved in the light selector",
      );
      await until(async () => (await background()) === "rgb(18, 52, 86)", "canvas shows it");
      await page.locator(".colour-row").last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, "colour-row.png") });
    },
  );

  await step("the Canvas mode switch shows the app's .dark mode and back", async () => {
    const mode = page.getByRole("combobox", { name: "Canvas mode" });
    const hasDark = () =>
      page
        .frameLocator("iframe")
        .locator("html")
        .evaluate((html) => html.classList.contains("dark"));
    await mode.selectOption("dark");
    await until(async () => (await hasDark()) === true, "html has .dark");
    await until(async () => (await background()) === "rgb(51, 51, 51)", "canvas shows .dark");
    await page.screenshot({ path: path.join(out, "dark.png") });
    await mode.selectOption("light");
    await until(async () => (await hasDark()) === false, ".dark removed");
    await until(async () => (await background()) === "rgb(18, 52, 86)", "light is back");
  });

  await step("nothing but the app's override file changed", () => {
    const changed = git("status", "--porcelain").trim();
    if (changed !== "M .workbench/overrides.css") throw new Error(`app changes: ${changed}`);
  });
} finally {
  await browser.close();
  await vite.close();
  rmSync(app, { recursive: true, force: true });
}
report(results, errors, out);
