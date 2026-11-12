// Proxy check (ETH-148): a scratch Vite app that never imports the override file shows a saved
// value through `design-workshop dev`, live and again after a reload.
//   node apps/web/scripts/proxy-check.mjs [--out dir]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const out = path.resolve(arg("--out", path.join(ROOT, ".artifacts/proxy")));
const APP_PORT = 5191;
const PROXY_PORT = 5181;
const CLI = path.join(ROOT, "packages/workbench/src/cli.ts");
const workbench = (...args) => execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT });
const { createServer } = await import(
  createRequire(path.join(ROOT, "packages/workbench/package.json")).resolve("vite")
);
const { startDev } = await import(path.join(ROOT, "packages/workbench/src/dev.ts"));

const app = mkdtempSync(path.join(tmpdir(), "proxy-scratch-"));
// The app colours its page with `--bg`, a value the Workbench never writes inline on the frame,
// so only the linked override stylesheet can change it.
writeFileSync(
  path.join(app, "index.html"),
  `<!doctype html><html data-theme="light"><head><style>
:root { --bg: #dddddd; }
body { background: var(--bg); }
</style></head><body><div data-slot="window">Scratch app</div></body></html>\n`,
);
const vite = await createServer({
  root: app,
  configFile: false,
  appType: "spa",
  logLevel: "silent",
  server: { port: APP_PORT, strictPort: true },
});
await vite.listen();
await startDev(`http://localhost:${APP_PORT}`, PROXY_PORT);

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
const canvas = () => page.frameLocator("iframe").locator('[data-slot="window"]');
// Vite's client in the Workbench page has connected, so a file change reaches it.
const connected = () =>
  page.waitForEvent("console", {
    predicate: (m) => m.text().includes("[vite] connected"),
    timeout: 120_000,
  });
const SELECTOR = ':root[data-theme="light"]';
const background = () =>
  page
    .frameLocator("iframe")
    .locator("body")
    .evaluate((b) => getComputedStyle(b).backgroundColor);
const expectBackground = async (want) => {
  for (let i = 0; i < 50; i++) {
    if ((await background()) === want) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`background is ${await background()}, not ${want}`);
};

try {
  // A cold checkout optimizes the Workbench's dependencies on first load, which takes a while.
  const first = connected();
  await page.goto(`http://localhost:${PROXY_PORT}/__workbench/?path=%2F`, { timeout: 120_000 });
  await canvas().waitFor({ timeout: 120_000 });
  await first;

  await step("the app's page gets the override stylesheet linked, with no import", async () => {
    const links = await page
      .frameLocator("iframe")
      .locator("link[data-workbench-overrides]")
      .count();
    if (links !== 1) throw new Error(`${links} override links`);
    await expectBackground("rgb(221, 221, 221)");
  });

  await step("a saved value shows in the app without a reload", async () => {
    workbench("set", SELECTOR, "--bg", "#ff0000");
    await expectBackground("rgb(255, 0, 0)");
    await page.screenshot({ path: path.join(out, "saved.png") });
  });

  await step("the value is still there after a reload", async () => {
    const again = connected();
    await page.reload();
    await canvas().waitFor();
    await again;
    await expectBackground("rgb(255, 0, 0)");
  });

  await step("removing it brings the app's own value back", async () => {
    workbench("unset", SELECTOR, "--bg");
    await expectBackground("rgb(221, 221, 221)");
  });
} finally {
  try {
    workbench("unset", SELECTOR, "--bg");
  } catch {
    // Already removed.
  }
  await browser.close();
  await vite.close();
  rmSync(app, { recursive: true, force: true });
}
report(results, errors, out);
