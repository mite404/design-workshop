// oxlint-disable no-console -- runnable first-visit browser check, using the app's real runtime
import assert from "node:assert/strict";
import { arg, launch } from "./harness.mjs";

const base = arg("--base", "http://127.0.0.1:5173");
const testCase = arg("--case", "all");
const browser = await launch();

function watchDrawerMotion() {
  window.drawerTransitions = [];
  document.addEventListener("transitionrun", (event) => {
    if (
      event.target instanceof HTMLElement &&
      ["sidebar-wrapper", "sidebar-container", "sidebar-gap"].includes(event.target.dataset.slot)
    ) {
      window.drawerTransitions.push(event.propertyName);
    }
  });
}

async function checkDeferredGuide(playback, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 360, height: 640 } : { width: 1100, height: 900 },
  });
  const closed = mobile ? "closed" : "collapsed";
  const opened = mobile ? "open" : "expanded";
  try {
    await context.addInitScript(() => {
      if (localStorage.getItem("kay.sidebar") === null)
        localStorage.setItem("kay.sidebar", "closed");
    });
    const page = await context.newPage();
    await page.goto(`${base}/t/demo-brief`);
    await page.getByRole("button", { name: "Play", exact: true }).waitFor();
    if (!playback) {
      assert.equal(
        await page.locator(`[data-slot='sidebar'][data-state='${closed}']`).count(),
        1,
        "a deep link must honor the saved drawer choice before onboarding is eligible",
      );
      await page.reload();
      await page.getByRole("button", { name: "Play", exact: true }).waitFor();
      assert.equal(await page.locator(`[data-slot='sidebar'][data-state='${closed}']`).count(), 1);
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
    if (mobile || (await page.locator("[data-slot='sidebar'][data-state='expanded']").count()))
      await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    const guide = page.getByRole("dialog", { name: "A quick look around" });
    await guide.waitFor();
    if (!playback) {
      assert.equal(
        await page.locator(`[data-slot='sidebar'][data-state='${opened}']`).count(),
        1,
        "deferred onboarding must expand the actual history drawer",
      );
    }
    await guide.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("dialog", { name: "Try the scripted demo" }).waitFor();
    assert.match(
      await page.locator("[data-slot='demo-status']").textContent(),
      /^Paused ·/,
      "Next must pause the already-playing show without restarting it",
    );
    await page.getByRole("dialog").getByRole("button", { name: "Got it" }).click();
    assert.equal(
      await page.locator(`[data-slot='sidebar'][data-state='${closed}']`).count(),
      1,
      "onboarding must not overwrite the saved drawer choice",
    );
  } finally {
    await context.close();
  }
}

try {
  if (testCase === "all" || testCase === "playback" || testCase === "deferred")
    await checkDeferredGuide(testCase === "playback");
  if (testCase === "all" || testCase === "deferred") await checkDeferredGuide(false, true);
  if (testCase === "all" || testCase === "fresh" || testCase === "short") {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await context.addInitScript(() => {
      if (localStorage.getItem("kay.sidebar") === null)
        localStorage.setItem("kay.sidebar", "closed");
    });
    await context.addInitScript(watchDrawerMotion);
    const page = await context.newPage();
    await page.goto(base);
    const guide = page.getByRole("dialog", { name: "A quick look around" });
    await guide.waitFor();
    assert.equal(await guide.getByText("Choose a demo", { exact: true }).count(), 1);
    assert.equal(await guide.getByText("Try the live model", { exact: true }).count(), 1);
    assert.equal(await page.locator("[data-onboarding-outline]").count(), 2);
    assert.match(
      await page
        .locator("[data-slot='dialog-overlay']")
        .evaluate((el) => getComputedStyle(el).backdropFilter),
      /blur\(/,
    );
    const demoSection = page.locator("[data-slot='sidebar-menu-item'][data-guide-target='demo']");
    await demoSection.getByText("Central depot", { exact: true }).waitFor();
    await page.waitForFunction(() => {
      const section = document
        .querySelector("[data-slot='sidebar-menu-item'][data-guide-target='demo']")
        ?.getBoundingClientRect();
      const outline = document
        .querySelector("[data-onboarding-outline='demo']")
        ?.getBoundingClientRect();
      return (
        section &&
        outline &&
        section.left >= 0 &&
        Math.abs(section.left - outline.left) < 2 &&
        Math.abs(section.bottom - outline.bottom) < 2
      );
    });
    assert.deepEqual(
      await page.evaluate(() => window.drawerTransitions),
      [],
      "drawer starts expanded without motion",
    );
    await guide.getByRole("button", { name: "Next", exact: true }).click();
    const demoGuide = page.getByRole("dialog", { name: "Try the scripted demo" });
    await demoGuide.waitFor();
    await page.waitForURL(/\/t\/demo-brief$/);
    assert.equal(await page.locator("[data-slot='demo-status']").textContent(), "Ready");
    assert.equal(await page.locator("[data-onboarding-outline]").count(), 2);
    assert.equal(
      await demoGuide
        .getByRole("heading", { level: 2 })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(await demoGuide.evaluate((el) => el.contains(document.activeElement)), true);
    await demoGuide.getByRole("button", { name: "Got it" }).click();
    await demoGuide.waitFor({ state: "detached" });
    assert.equal(await page.locator("[data-onboarding-outline]").count(), 0);
    assert.equal(await page.locator("[data-slot='demo-status']").textContent(), "Ready");
    await page.getByRole("button", { name: "Play", exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Play", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await page.locator("[data-slot='sidebar'][data-state='collapsed']").count(), 1);
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("kay.sidebar")), "open");
    await page.reload();
    await page.getByRole("toolbar", { name: "Scripted demo" }).waitFor();
    assert.equal(await page.locator("[data-slot='sidebar'][data-state='expanded']").count(), 1);
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("kay.sidebar")), "closed");
    await page.reload();
    await page.getByRole("toolbar", { name: "Scripted demo" }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator("[data-slot='sidebar'][data-state='collapsed']").count(), 1);
    await context.close();

    const fresh = await browser.newContext({ viewport: { width: 360, height: 640 } });
    await fresh.addInitScript(watchDrawerMotion);
    const narrow = await fresh.newPage();
    await narrow.goto(base);
    const narrowGuide = narrow.getByRole("dialog", { name: "A quick look around" });
    await narrowGuide.waitFor();
    await narrow.waitForFunction(() => {
      const section = document
        .querySelector("[data-slot='sidebar-menu-item'][data-guide-target='demo']")
        ?.getBoundingClientRect();
      const outline = document
        .querySelector("[data-onboarding-outline='demo']")
        ?.getBoundingClientRect();
      return (
        section &&
        outline &&
        section.left >= 0 &&
        Math.abs(section.left - outline.left) < 2 &&
        Math.abs(section.bottom - outline.bottom) < 2
      );
    });
    assert.equal(await narrowGuide.evaluate((el) => el.contains(document.activeElement)), true);
    assert.deepEqual(
      await narrow.evaluate(() => window.drawerTransitions),
      [],
      "phone drawer starts expanded without motion",
    );
    assert.equal(await narrowGuide.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    assert.equal(
      await narrowGuide.evaluate((el) => {
        const dialog = el.getBoundingClientRect();
        return [...document.querySelectorAll("[data-onboarding-outline]")].every((outline) => {
          const box = outline.getBoundingClientRect();
          return (
            box.top >= 0 &&
            box.bottom <= innerHeight &&
            (box.bottom <= dialog.top ||
              box.top >= dialog.bottom ||
              box.right <= dialog.left ||
              box.left >= dialog.right)
          );
        });
      }),
      true,
      "narrow target outlines must not cross the guide",
    );
    await narrow.keyboard.press("Escape");
    await narrowGuide.waitFor({ state: "detached" });
    await narrow.reload();
    await narrow.locator(".welcome").waitFor();
    assert.equal(await narrow.getByRole("dialog").count(), 0);
    await fresh.close();
    console.log(
      "PASS: expanded without motion, matched outlines, blur, paused demo, dismissal, reload, narrow Escape",
    );
  }
} finally {
  await browser.close();
}
