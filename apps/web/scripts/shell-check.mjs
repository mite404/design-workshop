// oxlint-disable no-await-in-loop, no-console -- a lever drives one step at a time and reports on stdout
// The one shell's lever (ADR-156): drives a fresh device in headless Chromium at 1280x900 from the
// splash through the completed chat, the mode switch, the
// retired addresses and the deleted /new, screenshotting each stage to .artifacts/one-shell/. Exits
// 1 when any step fails, and counts every console error as a failure except the 404 /new returns.
//
//   node apps/web/scripts/shell-check.mjs [--base http://127.0.0.1:5173] [--out dir]
//   PLAYWRIGHT_CHROMIUM=/path/to/chrome node apps/web/scripts/shell-check.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, ROOT } from "./harness.mjs";

const base = arg("--base", "http://127.0.0.1:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/one-shell"));
mkdirSync(out, { recursive: true });
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => {
  if (
    m.type() === "error" &&
    !(m.location()?.url ?? "").endsWith("/new") &&
    !/status of 404/.test(m.text())
  )
    errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));
const results = [];
const step = async (name, run) => {
  try {
    results.push({ name, ok: true, detail: (await run()) ?? "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};

await step(
  "fresh / lands on the splash with exactly Demo and Live Playground, no canvas",
  async () => {
    await page.goto(`${base}/`);
    await page.waitForURL(/\/t\/playground$/, { timeout: 20_000 });
    await page.locator(".welcome").waitFor({ timeout: 20_000 });
    const names = await page.locator(".welcome [data-slot='welcome-project']").allInnerTexts();
    assert.deepEqual(
      names.map((n) => n.trim()),
      ["Demo", "Live Playground"],
    );
    assert.equal(await page.getByText("Demo store").count(), 0);
    assert.equal(await page.locator('[data-slot="welcome-figure"]').count(), 1);
    assert.equal(await page.getByRole("region", { name: "Compose canvas" }).count(), 0);
    await page.screenshot({ path: `${out}/01-splash.png` });
    return page.url();
  },
);
await step("the Demo row opens the finished brief; canvas still hidden", async () => {
  await page.locator(".welcome").getByRole("link", { name: "Demo" }).click();
  await page.waitForURL(/\/t\/demo-brief$/);
  await page.getByText("Monday support brief (draft)").first().waitFor();
  assert.equal(await page.locator('[data-slot="demo-controls"]').count(), 0);
  assert.equal(await page.getByRole("region", { name: "Compose canvas" }).count(), 0);
  await page.screenshot({ path: `${out}/02-demo-brief.png` });
});
await step("the mode switch offers Live and Component, not the legacy canvas", async () => {
  const layout = page.getByRole("group", { name: "Layout" });
  assert.equal(await layout.getByRole("button", { name: "Canvas", exact: true }).count(), 0);
  assert.equal(await layout.getByRole("button", { name: "Live mode", exact: true }).count(), 1);
  assert.equal(
    await layout.getByRole("button", { name: "Component mode", exact: true }).count(),
    1,
  );
  assert.equal(await page.locator('[data-wb="ChatThreadPanel"]').count(), 1);
});
await step("a reload keeps the completed chat without mounting a canvas", async () => {
  await page.reload();
  await page.getByText("Monday support brief (draft)").first().waitFor();
  assert.equal(await page.locator('[data-wb="ChatThreadPanel"]').count(), 1);
  assert.equal(await page.getByRole("region", { name: "Compose canvas" }).count(), 0);
});
await step(
  "/playground, /demo/weekly-brief?script=returned and /demo/weekly-brief/t/demo-brief-workload redirect",
  async () => {
    await page.goto(`${base}/playground?splash=vitruvian`);
    await page.waitForURL(/\/t\/playground\?splash=vitruvian$/);
    await page.goto(`${base}/demo/weekly-brief?script=returned`);
    await page.waitForURL(/\/t\/demo-returned$/);
    await page.goto(`${base}/demo/weekly-brief/t/demo-brief-workload`);
    await page.waitForURL(/\/t\/demo-brief-workload$/);
    return page.url();
  },
);
await step("/new is gone", async () => {
  const response = await page.goto(`${base}/new`);
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  assert.ok(
    !/Start a thread|New thread/.test(body) ||
      /not found|404|gone/i.test(body) ||
      page.url().endsWith("/new"),
    body.slice(0, 120),
  );
  return `${response?.status()} ${page.url()} :: ${body.replace(/\s+/g, " ").slice(0, 80)}`;
});
for (const mode of ["Live", "Component"]) {
  await step(
    `${mode} opens the completed mock in the editor through the welcome button`,
    async () => {
      const fresh = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });
      try {
        const entry = await fresh.newPage();
        await entry.goto(base);
        await entry
          .locator(".welcome")
          .getByRole("button", { name: `${mode} mode` })
          .click();
        await entry.waitForURL(/\/__workbench\/\?path=/);
        const canvas = entry.frameLocator("iframe");
        const preview = canvas.locator(`[aria-label="${mode} preview"]`);
        await preview.getByText("Monday support brief (draft)").first().waitFor();
        assert.equal(await canvas.locator('[data-slot="demo-controls"]').count(), 0);
        assert.ok((await preview.locator(".turn-user").count()) >= 1);
        await preview.getByText("Oldest first", { exact: true }).waitFor();
        assert.ok((await preview.locator(".turn-agent").count()) >= 2);
        assert.ok((await preview.locator(".card").count()) >= 3);
        const card = preview.locator("section.card.state").first();
        await card.scrollIntoViewIfNeeded();
        for (let attempt = 0; attempt < 30; attempt++) {
          const box = await card.boundingBox();
          assert.ok(box);
          await entry.mouse.click(box.x + 60, box.y + 6);
          const selected = await entry.locator(".selector").textContent();
          if (
            await card.evaluate(
              (el, selector) => typeof selector === "string" && el.matches(selector),
              selected,
            )
          )
            break;
        }
        const selected = await entry.locator(".selector").textContent();
        assert.ok(
          await card.evaluate(
            (el, selector) => typeof selector === "string" && el.matches(selector),
            selected,
          ),
        );
        // The fields follow the selection a frame later, and the card's parent has no gap.
        await entry.locator("#wb-gap:enabled").waitFor();
        await entry.locator("#wb-padding-left:enabled").waitFor();
        await entry.screenshot({ path: `${out}/${mode.toLowerCase()}-editor.png` });
        await entry.locator(".tool").click();
        const other = mode === "Live" ? "Component" : "Live";
        await canvas
          .getByRole("group", { name: "Layout" })
          .getByRole("button", { name: `${other} mode` })
          .click();
        await canvas.locator(`[aria-label="${other} preview"]`).waitFor();
        assert.equal(await canvas.locator("iframe").count(), 0, "no nested editor");
      } finally {
        await fresh.close();
      }
    },
  );
}
results.push({ name: "no console errors", ok: errors.length === 0, detail: errors.join(" | ") });
await browser.close();
writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
for (const r of results)
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` · ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? `PASS one shell, ${results.length} steps` : `FAIL ${failed} of ${results.length}`,
);
process.exitCode = failed === 0 ? 0 : 1;
