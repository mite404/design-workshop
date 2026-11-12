// oxlint-disable no-console -- this browser check reports its assertions on stdout
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arg, launch, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const browser = await launch();
const endpoint = `${base}/__workbench/values`;
const initial = await (await fetch(endpoint)).json();

async function checkChildOpening() {
  const { context, page, errors } = await workbenchPage(browser);
  try {
    await page.goto(`${base}/__workbench/?path=/t/demo-brief-workload`);
    const frame = page.frameLocator("iframe");
    const panel = frame.locator('[data-wb="ChatThreadPanel"]').first();
    await panel.waitFor();
    await panel.evaluate((node) => {
      window.retainedChildPanel = node;
    });
    const toggle = frame.getByRole("button", { name: /sidebar/i }).first();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await frame.getByRole("treeitem", { name: "ChatThreadPanel", exact: true }).first().focus();
    await page.keyboard.press("Enter");
    await frame.getByRole("button", { name: "Component mode", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode ===
        "component",
    );
    assert.equal(
      await panel.evaluate((node) => node.ownerDocument.location.pathname),
      "/t/demo-brief-workload",
      "tree opening keeps the child route",
    );
    assert.equal(
      await panel.evaluate((node) => node === window.retainedChildPanel),
      true,
      "tree opening keeps the child panel",
    );
    for (const mode of ["Live mode", "Component mode"]) {
      await frame.getByRole("button", { name: mode, exact: true }).click();
      await page.waitForFunction(
        (expected) =>
          document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode ===
          expected,
        mode === "Live mode" ? "live" : "component",
      );
      assert.equal(
        await panel.evaluate((node) => node.ownerDocument.location.pathname),
        "/t/demo-brief-workload",
        "mode switch keeps the child route",
      );
      assert.equal(
        await panel.evaluate((node) => node === window.retainedChildPanel),
        true,
        "mode switch keeps the child panel",
      );
    }
    await page.reload();
    await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
    assert.equal(
      await panel.evaluate((node) => node.ownerDocument.location.pathname),
      "/t/demo-brief-workload",
      "reload keeps the child route",
    );
    assert.equal(
      await page.locator(".selector").textContent(),
      '[data-wb="ChatThreadPanel"]',
      "reload restores the child component",
    );
    await frame.getByRole("button", { name: "Live mode", exact: true }).click();
    await page.goto(`${base}/__workbench/`);
    await panel.waitFor();
    assert.equal(
      await frame.locator('[data-wb="ChatThreadPanel"]').count(),
      1,
      "default preview does not mount a previously saved lane layout",
    );
    assert.equal(await frame.getByRole("region", { name: "Compose canvas" }).count(), 0);
    assert.deepEqual(errors, [], "no child browser errors");
    console.log("ok tree opening, mode switches and reload preserve the child thread");
  } finally {
    await context.close();
  }
}

try {
  assert.deepEqual(initial.saved, {}, "the override file starts empty");
  await checkChildOpening();
  const { page, errors } = await workbenchPage(browser);
  await page.goto(`${base}/__workbench/`);
  const frame = page.frameLocator("iframe");
  await frame.locator("[data-slot=window]").waitFor();
  await frame.locator('[data-wb="CatalogCard"]').first().waitFor();
  assert.equal(await frame.locator('[data-wb="ChatThreadPanel"]').count(), 1);
  assert.equal(await frame.getByRole("button", { name: "Canvas", exact: true }).count(), 0);
  assert.equal(await frame.getByRole("region", { name: "Compose canvas" }).count(), 0);
  console.log("ok default preview is one chat history without the legacy canvas");
  const toggle = frame.getByRole("button", { name: /sidebar/i }).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const rows = frame.getByRole("tree", { name: "Components" });
  await rows.waitFor();
  assert.ok((await rows.getByRole("treeitem").count()) > 4, "drawer lists rendered components");
  await rows.getByRole("treeitem").first().focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(
      () => document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode,
    ),
    "live",
    "a Live row selects in place",
  );
  await frame.getByRole("button", { name: "Component mode", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector(".selector").textContent.includes("data-wb"),
  );
  assert.equal(await rows.locator('[aria-selected="true"]').count(), 1, "selection marks one row");
  await page.waitForFunction(
    () =>
      document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode ===
      "component",
  );
  assert.equal(
    await frame
      .getByRole("button", { name: "Component mode", exact: true })
      .getAttribute("aria-pressed"),
    "true",
    "Component mode opens the row chosen in Live",
  );
  assert.ok(new URL(page.url()).searchParams.has("component"), "open component is in URL");
  const cards = frame.locator('[data-wb="CatalogCard"]');
  await cards.first().evaluate((node) => {
    window.retainedCard = node;
    const scroll = node.closest(".thread-scroll");
    scroll.scrollTop = scroll.scrollHeight;
  });
  assert.equal(
    await cards
      .first()
      .evaluate(
        (node) =>
          node.getBoundingClientRect().bottom <
          node.closest(".thread-scroll").getBoundingClientRect().top,
      ),
    true,
    "the requested component starts above the visible chat history",
  );
  for (const name of ["AgentTurn", "Prose"]) {
    const branch = rows.getByRole("treeitem", { name, exact: true }).first();
    if ((await branch.getAttribute("aria-expanded")) === "false")
      await branch
        .getByRole("button", { name: `Expand ${name}` })
        .first()
        .click();
  }
  await rows
    .getByRole("treeitem", { name: "CatalogCard", exact: true })
    .first()
    .locator(':scope > [data-sidebar="menu-button"]')
    .click();
  await page.waitForFunction(
    () => document.querySelector(".selector").textContent === '[data-wb="CatalogCard"]',
  );
  assert.equal(
    await cards.first().evaluate((node) => {
      const box = node.getBoundingClientRect();
      const view = node.closest(".thread-scroll").getBoundingClientRect();
      return box.top >= view.top && box.bottom <= view.bottom;
    }),
    true,
    "clicking the tree row scrolls its component fully into view",
  );
  console.log("ok a tree click scrolls to a component outside the viewport");
  assert.equal(
    await cards.first().evaluate((node) => window.retainedCard === node),
    true,
    "opening keeps the actual DOM node",
  );
  assert.equal(
    await page.locator("#wb-x").evaluate((input) => input.readOnly),
    true,
    "root nudge is locked",
  );
  await page.locator("body").press("ArrowRight");
  assert.equal(
    await cards.first().evaluate((node) => node.style.translate),
    "",
    "arrow keys cannot nudge root",
  );
  const outside = await cards.first().boundingBox();
  await page.mouse.click(outside.x + outside.width + 25, outside.y + 30);
  assert.equal(
    await page.locator(".selector").textContent(),
    "",
    "surroundings cannot be selected",
  );
  await rows.getByRole("treeitem", { name: "CatalogCard", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  const left = page.locator("#wb-padding-left");
  await page.locator('.bar[data-name="padding-left"]:not([hidden])').first().waitFor();
  const handle = await page
    .locator('.bar[data-name="padding-left"]:not([hidden])')
    .first()
    .boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 38, handle.y + handle.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForFunction(() =>
    [
      ...document
        .querySelector("iframe")
        .contentDocument.querySelectorAll('[data-wb="CatalogCard"]'),
    ].every((n) => getComputedStyle(n).paddingLeft === "38px"),
  );
  assert.ok(
    readFileSync(`${ROOT}/packages/catalog/src/overrides.css`, "utf8").includes(
      '[data-wb="CatalogCard"] {',
    ),
    "one shared rule is saved",
  );
  console.log("ok root padding reaches repeated instances and root cannot nudge");
  const openKey = new URL(page.url()).searchParams.get("component");
  await frame.getByRole("button", { name: "Live mode", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage === "");
  assert.equal(
    await cards.first().evaluate((node) => window.retainedCard === node),
    true,
    "Live keeps the DOM node",
  );
  assert.equal(
    new URL(page.url()).searchParams.get("component"),
    openKey,
    "Live retains open component",
  );
  await left.fill("46");
  await left.press("Enter");
  await page.waitForFunction(() => {
    const nodes = document
      .querySelector("iframe")
      .contentDocument.querySelectorAll('[data-wb="CatalogCard"]');
    return (
      getComputedStyle(nodes[0]).paddingLeft === "46px" &&
      getComputedStyle(nodes[1]).paddingLeft === "38px"
    );
  });
  await frame.getByRole("button", { name: "Component mode", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
  await left.fill("54");
  await left.press("Enter");
  await page.waitForFunction(() => {
    const nodes = document
      .querySelector("iframe")
      .contentDocument.querySelectorAll('[data-wb="CatalogCard"]');
    return (
      nodes[0].style.paddingLeft === "" &&
      getComputedStyle(nodes[0]).paddingLeft === "46px" &&
      getComputedStyle(nodes[1]).paddingLeft === "54px"
    );
  });
  console.log("ok Live instance wins over a later component edit");
  await page.reload();
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
  assert.equal(
    await page.locator(".selector").textContent(),
    '[data-wb="CatalogCard"]',
    "reload restores component selection",
  );
  await page.getByRole("button", { name: "Reset left", exact: true }).click();
  await frame.getByRole("button", { name: "Live mode", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage === "");
  await page.getByRole("button", { name: "Reset left", exact: true }).click();
  await page.waitForFunction(
    async () => Object.keys((await (await fetch("/__workbench/values")).json()).saved).length === 0,
  );
  console.log("ok reload restores focus and resets preserve selector reach");

  await page.locator(".tool").focus();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => {
      const d = document.querySelector("iframe").contentDocument;
      const root = d.querySelector(new URL(location.href).searchParams.get("component"));
      const selected = d.querySelector(document.querySelector(".selector").textContent);
      return root.contains(selected);
    }),
    false,
    "Live mode can select the component's parent",
  );
  await frame.getByRole("button", { name: "Component mode", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
  assert.equal(
    await page.evaluate(() => {
      const selector = document.querySelector(".selector").textContent;
      if (selector === "") return true;
      const d = document.querySelector("iframe").contentDocument;
      const root = d.querySelector(new URL(location.href).searchParams.get("component"));
      return root.contains(d.querySelector(selector));
    }),
    true,
    "Component mode cannot retain a selection outside its root",
  );
  await rows
    .getByRole("treeitem", { name: "CatalogCard", exact: true })
    .first()
    .locator(':scope > [data-sidebar="menu-button"]')
    .click();
  console.log("ok returning to Component mode rejects an outside Live selection");

  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
  await left.fill("24");
  await left.press("Enter");
  await page.waitForFunction(() =>
    [
      ...document
        .querySelector("iframe")
        .contentDocument.querySelectorAll('[data-wb="CatalogCard"]'),
    ].every((n) => getComputedStyle(n).paddingLeft === "24px"),
  );
  await cards.evaluateAll((nodes) => {
    for (const node of nodes) node.remove();
  });
  await page.getByRole("status").filter({ hasText: "no longer on this page" }).waitFor();
  assert.equal(
    await page.locator(".selector").textContent(),
    "",
    "missing target does not unlock the canvas",
  );
  await page.locator(".unmatched").getByText('[data-wb="CatalogCard"]', { exact: true }).waitFor();
  assert.ok(
    readFileSync(`${ROOT}/packages/catalog/src/overrides.css`, "utf8").includes("24px"),
    "unmatched values stay saved",
  );
  await page.locator(".unmatched button").click();
  console.log("ok missing component is reported and unmatched saved paths remain listed");

  await page.goto(`${base}/__workbench/?path=/t/demo-brief`);
  const preview = frame.locator('[aria-label="Component preview"]');
  await preview.waitFor();
  await preview.evaluate((node) => {
    window.retainedPreview = node;
  });
  const root = rows.getByRole("treeitem", { name: "ChatThreadPanel", exact: true }).first();
  await root.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
  await frame.getByRole("button", { name: "Live mode", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("iframe").style.maskImage === "");
  assert.equal(
    await preview.evaluate((node) => node === window.retainedPreview),
    true,
    "opening the default mock and switching to Live retain it",
  );
  console.log("ok unopened Component mode keeps its shared chat and opening does not replace it");
  assert.deepEqual(errors, [], "no browser errors");
  console.log("ok component tree keyboard selection reaches inspector");
} finally {
  await browser.close();
  const current = await (await fetch(endpoint)).json();
  const changes = Object.entries(current.saved).flatMap(([selector, rule]) =>
    Object.entries(rule).map(([name, was]) => ({ selector, name, was, value: null })),
  );
  if (changes.length > 0 && Object.keys(initial.saved).length === 0) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ head: current.head, changes }),
    });
    assert.equal(response.status, 200, "test writes are cleaned up through the Workbench API");
  }
}
