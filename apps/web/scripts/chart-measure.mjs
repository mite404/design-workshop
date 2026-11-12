// Measures what the catalog's charts cost (bklit charts story, feature 1): the gzip bytes of the
// chart library code the catalog imports, the Weekly brief's chart cards' render time and the
// Interactive Profit story's render time, both under 4x CPU slowdown. Prints one JSON report.
// Needs the dev server (5173) and Storybook (6006). Usage:
//   node apps/web/scripts/chart-measure.mjs [--runs 5] [--out dir]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { arg, launch, ROOT } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const storybook = arg("--storybook", "http://localhost:6006");
const runs = Number(arg("--runs", "5"));
const out = arg("--out", path.join(ROOT, ".artifacts/chart-measure"));
const SHOWN = '[role="tabpanel"]:not([inert])';
const STORY = "thread-chat-thread-panel--interactive-profit";

// The chart library's imports in the catalog, as written: `from "<library>"` blocks.
const IMPORT = /import\s*{([^}]*)}\s*from\s*"(recharts|@bklit\/[^"]+)"/g;

const round = (x) => Math.round(x);

// The median, fastest and slowest of `xs`, rounded to whole units.
const spread = (xs) => {
  const sorted = xs.toSorted((a, b) => a - b);
  return {
    runs: xs.length,
    median: round(sorted[Math.floor(sorted.length / 2)]),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
  };
};

// Bundles only the chart names the catalog imports, minified, and gzips the result.
async function chartBytes() {
  const sources = ["CatalogCard.tsx", "interactiveParts.tsx"].map((f) =>
    readFileSync(path.join(ROOT, "packages/catalog/src", f), "utf8"),
  );
  const names = new Map(); // library → Set of imported names
  for (const source of sources)
    for (const [, list, library] of source.matchAll(IMPORT)) {
      const set = names.get(library) ?? new Set();
      for (const n of list.split(",")) if (n.trim()) set.add(n.trim().split(/\s+as\s+/)[0]);
      names.set(library, set);
    }
  // Inside the catalog's node_modules, so the entry resolves the catalog's own chart library.
  const dir = path.join(ROOT, "packages/catalog/node_modules/.cache/chart-measure");
  mkdirSync(dir, { recursive: true });
  const entry = path.join(dir, "entry.js");
  writeFileSync(
    entry,
    [...names].map(([lib, set]) => `export { ${[...set].join(", ")} } from "${lib}";\n`).join(""),
  );
  const result = await build({
    root: path.join(ROOT, "packages/catalog"),
    logLevel: "silent",
    configFile: false,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ["es"], fileName: "charts" },
      rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime"] },
    },
  });
  const code = [result]
    .flat()
    .flatMap((r) => r.output)
    .filter((o) => o.type === "chunk")
    .map((o) => o.code)
    .join("");
  return {
    libraries: Object.fromEntries(
      [...names].map(([l, s]) => [l, [...s].toSorted((a, b) => (a < b ? -1 : 1))]),
    ),
    minified: Buffer.byteLength(code),
    gzip: gzipSync(code).length,
  };
}

// A page whose CPU runs 4x slower, with motion on as a reader sees it.
async function slowPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return page;
}

// Milliseconds from clicking Weekly brief in the sidebar to both its charts drawn.
async function weeklyBrief(browser) {
  const page = await slowPage(browser);
  await page.goto(`${base}/`, { waitUntil: "load" });
  const link = page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { name: "Weekly brief", exact: true });
  await link.waitFor();
  await page.evaluate(() => {
    window.measureStart = performance.now();
  });
  await link.click();
  await page.waitForFunction(
    (shown) => document.querySelectorAll(`${shown} .recharts-surface`).length >= 2,
    SHOWN,
    { timeout: 60_000, polling: "raf" },
  );
  const ms = await page.evaluate(() => performance.now() - window.measureStart);
  await page.close();
  return ms;
}

// Milliseconds from the story's navigation start to its chart drawn.
async function profitStory(browser) {
  const page = await slowPage(browser);
  await page.goto(`${storybook}/iframe.html?id=${STORY}&viewMode=story`);
  await page.waitForFunction(() => document.querySelector(".recharts-surface") !== null, null, {
    timeout: 120_000,
    polling: "raf",
  });
  const ms = await page.evaluate(() => performance.now());
  await page.close();
  return ms;
}

const browser = await launch();
try {
  const bytes = await chartBytes();
  const timings = { weeklyBrief: [], interactiveProfit: [] };
  // One warm-up of each, so Vite's on-demand transforms are not counted.
  await weeklyBrief(browser);
  await profitStory(browser);
  for (let i = 0; i < runs; i++) {
    timings.weeklyBrief.push(await weeklyBrief(browser));
    timings.interactiveProfit.push(await profitStory(browser));
  }
  const report = {
    at: new Date().toISOString(),
    cpuSlowdown: 4,
    bytes,
    weeklyBriefMs: spread(timings.weeklyBrief),
    interactiveProfitMs: spread(timings.interactiveProfit),
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "chart-measure.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
