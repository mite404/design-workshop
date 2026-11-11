// What every browser lever starts from: the repository's root, the Chromium that Storybook's
// Playwright install pins, and the command line's `--name value` flags; and the page and report
// the Workbench levers share.
import { createRequire } from "node:module";
import path from "node:path";

/** The repository's root. */
export const ROOT = path.resolve(import.meta.dirname, "../../..");

const playwright = await import(
  createRequire(path.join(ROOT, "apps/storybook/package.json")).resolve("playwright")
);

/** Playwright's Chromium. */
export const { chromium } = playwright.default ?? playwright;

/**
 * Launches Playwright's Chromium, or the build at `PLAYWRIGHT_CHROMIUM` where the pinned one is
 * not downloaded.
 */
export const launch = (options = {}) => {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM;
  return chromium.launch(executablePath === undefined ? options : { ...options, executablePath });
};

const argv = process.argv.slice(2);

/** The value after `name` on the command line, or `fallback` when it is not there. */
export const arg = (name, fallback) =>
  argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;

/**
 * A new 1440×900 page at 2x in `browser` for a Workbench lever, with `options` for its context,
 * and the list its uncaught errors go to.
 */
export async function workbenchPage(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    ...options,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}

/**
 * Prints each step's result and each page error, then exits, with 1 when any failed.
 * `results` holds `{ name, ok, detail }`, its detail "" when there is nothing to add.
 */
export function report(results, errors, out) {
  // oxlint-disable no-console -- a lever reports on stdout
  for (const { name, ok, detail } of results) {
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === "" ? "" : `: ${detail}`}`);
  }
  for (const e of errors) console.log(`FAIL page error: ${e}`);
  const failed = results.filter((r) => !r.ok).length + errors.length;
  console.log(
    `${results.length - failed} of ${results.length} steps passed; screenshots in ${out}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}
