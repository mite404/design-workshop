// oxlint-disable no-await-in-loop -- one browser drives one page, checked in order
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validate } from "../../../packages/workbench/src/contract.ts";
import { parseOverrides } from "../../../packages/workbench/src/overrides.ts";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

// Project files story (docs/done/project-files/project-files-story.md), features 1 to 3, and
// the contract's semantic surfaces (ETH-132).
const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/project"));
const status = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8",
  });
/** @type {string} */
const before = status();
const browser = await launch();
const { page, errors } = await workbenchPage(browser, { acceptDownloads: true });
// The checklist as the command line prints it: one "ok|FAIL path code" per item.
const cli = (file) => {
  try {
    return execFileSync("node", ["packages/workbench/src/cli.ts", "check-project", file], {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch (e) {
    return String(e.stdout);
  }
};
const cliList = (file) =>
  cli(file)
    .trim()
    .split("\n")
    .map((line) => line.replace(/:.*$/, "").replaceAll(/\s+/g, " ").trim());
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
    const saved = parseOverrides(readFileSync(path.join(ROOT, ".workbench/overrides.css"), "utf8"));
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
  const overrides = path.join(ROOT, ".workbench/overrides.css");
  const startingOverrides = readFileSync(overrides, "utf8");
  const uiList = async (file) => {
    await page.locator('input[type="file"][aria-label="Project file"]').setInputFiles(file);
    const dialog = page.getByRole("dialog", { name: "Project file" });
    await dialog.waitFor();
    const rows = await dialog.locator("li").evaluateAll((lis) =>
      lis.map((li) => {
        const code = li.querySelector("code")?.textContent ?? "";
        const fail = li.classList.contains("failed") === true;
        const detail = li.querySelector("span:last-child")?.textContent?.split(":")[0] ?? "";
        return `${fail ? "FAIL" : "ok"} ${code === "file" ? "" : code}${fail ? ` ${detail}` : ""}`.trim();
      }),
    );
    return rows;
  };
  const fixture = (name, change) => {
    const file = path.join(out, `${name}.project.json`);
    const copy = structuredClone(project);
    change(copy.manifest);
    writeFileSync(file, JSON.stringify(copy));
    return file;
  };
  const fixtures = {
    valid: fixture("valid", () => {}),
    version: fixture("version", (m) => {
      m.storybook.version = "10.6.7";
    }),
    slot: fixture("slot", (m) => {
      m.slots = m.slots.filter((s) => s !== "title-bar");
    }),
    story: fixture("story", (m) => {
      m.components.ComposeBox.stories = [];
    }),
  };
  const expected = {
    valid: [],
    version: ["FAIL storybook/version storybook-version"],
    slot: ["FAIL slots/title-bar missing-slot"],
    story: ["FAIL components/ComposeBox missing-story"],
  };

  for (const [name, file] of Object.entries(fixtures)) {
    await step(
      `2.1-2.4 ${name}: the Workbench and the command line give the same checklist`,
      async () => {
        const ui = await uiList(file);
        assert.deepEqual(ui, cliList(file));
        assert.deepEqual(
          ui.filter((l) => l.startsWith("FAIL")),
          expected[name],
        );
        assert.deepEqual(await uiList(file), ui, "the same file gives the same list again");
        await page.getByRole("dialog", { name: "Project file" }).screenshot({
          path: path.join(out, `checklist-${name}.png`),
        });
        await page.getByRole("button", { name: "Close", exact: true }).click();
      },
    );
  }

  await step("2.2 a wrong Storybook version names both versions", async () => {
    await page
      .locator('input[type="file"][aria-label="Project file"]')
      .setInputFiles(fixtures.version);
    const text = await page.getByRole("dialog", { name: "Project file" }).textContent();
    assert.ok(text?.includes("10.6.0") === true && text.includes("10.6.7") === true, text);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  });

  await step("2.1 checking writes nothing", () => {
    assert.equal(readFileSync(overrides, "utf8"), startingOverrides);
  });

  const dialog = page.getByRole("dialog", { name: "Project file" });
  const loadButton = dialog.getByRole("button", { name: "Load", exact: true });
  await step("3.1 a file that fails the check cannot be loaded", async () => {
    await uiList(fixtures.slot);
    assert.ok(await loadButton.isDisabled());
    await page.getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(readFileSync(overrides, "utf8"), startingOverrides);
  });

  await step(
    "3.2-3.4 loading writes the file's look as one undo step, listing unmatched",
    async () => {
      const look = path.join(out, "look.project.json");
      const lookOverrides = {
        ":root": { "--window-radius": "23px" },
        '[data-wb="NoSuchPart"]': { gap: "3px" },
      };
      writeFileSync(look, JSON.stringify({ ...project, overrides: lookOverrides }));
      await uiList(look);
      assert.ok(await loadButton.isEnabled());
      await loadButton.click();
      await page.getByText("Loaded look.project.json.").waitFor();
      const written = Object.fromEntries(
        [...parseOverrides(readFileSync(overrides, "utf8"))].map(([sel, rule]) => [
          sel,
          Object.fromEntries(rule),
        ]),
      );
      assert.deepEqual(written, lookOverrides);
      await page
        .frameLocator("iframe")
        .locator("html")
        .evaluate(
          (html) =>
            new Promise((resolve, reject) => {
              const end = Date.now() + 5000;
              const poll = () => {
                if (getComputedStyle(html).getPropertyValue("--window-radius").trim() === "23px")
                  resolve();
                else if (Date.now() > end)
                  reject(new Error("canvas did not take on the loaded radius"));
                else requestAnimationFrame(poll);
              };
              poll();
            }),
        );
      await page
        .locator(".unmatched")
        .getByText('[data-wb="NoSuchPart"]', { exact: true })
        .waitFor();
      const changed = status()
        .split("\n")
        .filter((l) => l !== "" && !before.includes(l));
      assert.deepEqual(changed, [" M .workbench/overrides.css"]);
      await page.screenshot({ path: path.join(out, "loaded.png") });
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll(".unmatched li").length === 0);
      assert.equal(readFileSync(overrides, "utf8"), startingOverrides);
      assert.equal(status(), before);
    },
  );

  // Clicks `locator` until the Workbench selects exactly it, as a designer drills in.
  const select = async (locator) => {
    const selected = () =>
      page
        .locator(".selector")
        .textContent()
        .then((sel) =>
          locator.evaluate((el, s) => s !== "" && el.ownerDocument.querySelector(s) === el, sel),
        );
    for (let i = 0; i < 20 && (await selected()) !== true; i++) {
      const b = await locator.boundingBox();
      await page.mouse.click(b.x + 30, b.y + b.height / 2);
      await page.waitForTimeout(50);
    }
    assert.ok(await selected(), "clicks select the element");
  };
  const app = page.frameLocator("iframe");
  const surface = page.locator("details[aria-label=Selection] .surface-note");
  await step("7 selecting the compose box names the compose surface and its colour", async () => {
    await select(app.locator('[data-wb="ComposeBox"]').first());
    assert.match(await surface.textContent(), /^Compose surface · --compose-bg$/);
    assert.match(await surface.locator(".surface-swatch").getAttribute("title"), /^#[0-9a-f]{6}$/);
    await page
      .locator("details[aria-label=Selection]")
      .screenshot({ path: path.join(out, "surface-compose.png") });
  });
  await step("7 a part inside the thread names the thread surface", async () => {
    await select(app.locator('[data-wb="AgentTurn"] p').last());
    assert.match(await surface.textContent(), /^Thread surface · --paper$/);
  });
} finally {
  await browser.close();
}
report(results, errors, out);
