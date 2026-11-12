import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { validate } from "../../../packages/workbench/src/contract.ts";
import { parseOverrides } from "../../../packages/workbench/src/overrides.ts";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

// Project files story (docs/feature/project-files/project-files-story.md), feature 1.
const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/project"));
const status = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  });
const before = status();
const browser = await launch();
const { page, errors } = await workbenchPage(browser, { acceptDownloads: true });
const results = [];
const step = async (name, run) => {
  try {
    results.push({ name, ok: true, detail: (await run()) ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};
mkdirSync(out, { recursive: true });
let project;

try {
  await page.goto(`${base}/__workbench/`);
  await page.frameLocator("iframe").locator("[data-wb]").first().waitFor();

  await step("1.3 Export downloads one JSON project file from the Workbench", async () => {
    const button = page.getByRole("button", { name: "Export", exact: true });
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      button.click(),
    ]);
    assert.equal(download.suggestedFilename(), "design-workshop.project.json");
    const file = path.join(out, "export.project.json");
    await download.saveAs(file);
    project = JSON.parse(readFileSync(file, "utf8"));
    await page.locator(".inspector").screenshot({ path: path.join(out, "exported.png") });
  });

  await step("1.1 the file holds the format, its version, the manifest and the overrides", () => {
    assert.equal(project.format, "design-workshop/project");
    assert.equal(project.version, 1);
    assert.equal(project.manifest.storybook.version, "10.6.0");
    const saved = parseOverrides(
      readFileSync(path.join(ROOT, "packages/catalog/src/overrides.css"), "utf8"),
    );
    assert.deepEqual(
      project.overrides,
      Object.fromEntries([...saved].map(([s, values]) => [s, Object.fromEntries(values)])),
    );
  });

  await step("1.2 the export passes the validator in this repo", () => {
    assert.deepEqual(validate(JSON.stringify(project.manifest)), []);
  });

  await step("1.3 exporting writes nothing in the repo", () => {
    assert.equal(status(), before);
  });
} finally {
  await browser.close();
}
report(results, errors, out);
