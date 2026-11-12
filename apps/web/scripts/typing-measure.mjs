// Measures how long the app takes to answer each keystroke in the compose box (PRD section 15:
// input rendering under CPU slowdown). Opens the Weekly brief, whose thread holds two chart cards,
// types a sentence at 4x CPU slowdown and reads the browser's Event Timing entries, the measure
// behind INP: per keystroke, the longest event duration of its interaction. Prints one JSON report.
// Needs the dev server (5173). Usage:
//   node apps/web/scripts/typing-measure.mjs [--runs 5] [--thread "Weekly brief"] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const runs = Number(arg("--runs", "5"));
const thread = arg("--thread", "Weekly brief");
const out = arg("--out", path.join(ROOT, ".artifacts/typing-measure"));
const TEXT = "Summarise the open billing cases by age"; // 39 keystrokes
const SHOWN = '[role="tabpanel"]:not([inert])';

const round = (x) => Math.round(x);
const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];

// Runs in the page: records every event entry from now on, by interaction.
function observe() {
  window.typing = new Map(); // interactionId → longest duration, ms
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.interactionId === 0) continue;
      window.typing.set(
        e.interactionId,
        Math.max(window.typing.get(e.interactionId) ?? 0, e.duration),
      );
    }
  }).observe({ type: "event", durationThreshold: 16, buffered: false });
}

// One run: the keystrokes' durations, in ms; Event Timing rounds to 8 ms and drops those under 16.
async function typeOnce(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { name: thread, exact: true })
    .click();
  await page.locator(`${SHOWN} .chart svg`).first().waitFor({ timeout: 60_000 });
  const box = page.locator(`${SHOWN} [data-wb="ComposeBox"] textarea`);
  await box.click();
  await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(observe);
  await page.keyboard.type(TEXT, { delay: 600 });
  await page.waitForTimeout(1000);
  const durations = await page.evaluate(() => [...window.typing.values()]);
  await page.close();
  return durations;
}

const browser = await launch();
try {
  await typeOnce(browser); // warm-up, so Vite's on-demand transforms are not counted
  const perRun = [];
  for (let i = 0; i < runs; i++) perRun.push(await typeOnce(browser));
  const all = perRun.flat();
  const report = {
    at: new Date().toISOString(),
    thread,
    cpuSlowdown: 4,
    keystrokesPerRun: TEXT.length,
    runs,
    // Keystrokes slower than 16 ms, per run: the rest never reach Event Timing.
    slowKeystrokes: perRun.map((d) => d.length),
    medianMs: all.length === 0 ? 0 : round(median(all)),
    worstMsPerRun: perRun.map((d) => round(Math.max(0, ...d))),
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "typing-measure.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
