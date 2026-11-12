// Component chat check (ETH-154, ETH-155, R19): in Component mode the Workbench chat belongs to
// the open component and docks open at the canvas's right, the app narrowed beside it. A message
// sent with a reference on one component is gone on another, back on returning to it and after a
// reload, its reference still resolved; Live mode's chat does not show it and is not docked.
// Screenshots go to .artifacts/component-chat/.
//   node apps/web/scripts/component-chat-check.mjs [--base http://localhost:5173] [--out dir]
import { mkdirSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/component-chat"));
const TEXT = "Tighten the space under the title";
mkdirSync(out, { recursive: true });

const browser = await launch();
const { page, errors } = await workbenchPage(browser);
const frame = page.frameLocator("iframe");
const rows = frame.getByRole("tree", { name: "Components" });
// By CSS, not role: a closed panel is inert, so its log is out of the accessibility tree.
const messages = page.locator(".chat-log > .chat-message");
const results = [];

async function step(name, run) {
  try {
    results.push({ name, ok: true, detail: (await run()) ?? "" });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

const mode = () =>
  page.evaluate(
    () => document.querySelector("iframe").contentDocument.documentElement.dataset.wbMode,
  );

// Opens a component from the drawer, entering Component mode when Live mode only selected it.
async function openComponent(name) {
  await rows.getByRole("treeitem", { name, exact: true }).first().focus();
  await page.keyboard.press("Enter");
  if ((await mode()) !== "component")
    await frame.getByRole("button", { name: "Component mode", exact: true }).click();
  await page.waitForFunction(
    (wb) => document.querySelector(".selector").textContent.includes(`data-wb="${wb}"`),
    name,
  );
}

// The panel's title and whether it is docked open with the frame ending where it begins.
const layout = () =>
  page.evaluate(() => {
    const panel = document.querySelector(".chat");
    const app = document.querySelector(".frame").getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    return {
      title: panel.querySelector("h2").textContent,
      docked: panel.dataset.docked === "true" && panel.dataset.open === "true",
      beside: Math.abs(app.right - box.left) < 1 && Math.abs(box.height - app.height) < 1,
    };
  });

async function expectMessages(count) {
  await page
    .waitForFunction(
      (n) => document.querySelectorAll(".chat-log > .chat-message").length === n,
      count,
      {
        timeout: 10_000,
      },
    )
    .catch(() => {});
  const found = await messages.count();
  if (found !== count)
    throw new Error(
      `${found} messages, not ${count}; ${JSON.stringify(
        await page.evaluate(() => ({
          url: location.search,
          keys: Object.entries(localStorage).filter(([k]) => k.startsWith("workbench-chat")),
          selected: document.querySelector(".selector").textContent,
        })),
      )}`,
    );
}

try {
  await page.goto(`${base}/__workbench/?path=/t/demo-brief`);
  const toggle = frame.getByRole("button", { name: /sidebar/i }).first();
  await toggle.waitFor();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await rows.waitFor();

  await step("a message with a reference is sent on the open component", async () => {
    await openComponent("ChatThreadPanel");
    await page.getByRole("button", { name: "Reference an element" }).click();
    const text = frame.locator('[data-wb="ChatThreadPanel"] p:visible').last();
    await text.scrollIntoViewIfNeeded();
    const box = await text.boundingBox();
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 6 });
    await page.mouse.click(box.x + 10, box.y + box.height / 2);
    await page.getByRole("button", { name: "Add to chat" }).click();
    await page.getByRole("textbox", { name: "Message" }).fill(TEXT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expectMessages(1);
    await page.screenshot({ path: path.join(out, "01-sent.png") });
  });

  await step("the chat docks open beside the app, named for its component", async () => {
    const found = await layout();
    if (found.title !== "Chat · ChatThreadPanel" || found.docked !== true || found.beside !== true)
      throw new Error(JSON.stringify(found));
  });

  await step("another component opens with its own, empty chat", async () => {
    await openComponent("AgentTurn");
    await expectMessages(0);
  });

  await step("returning to the first component brings its message back", async () => {
    await openComponent("ChatThreadPanel");
    await expectMessages(1);
    const text = await messages.first().locator("p").textContent();
    if (text !== TEXT) throw new Error(`message reads ${text}`);
    if ((await messages.first().locator("li.chip").count()) !== 1) throw new Error("no chip");
  });

  await step("after a reload the message is back and its reference resolves", async () => {
    await page.reload();
    await frame.locator('[data-wb="ChatThreadPanel"]').first().waitFor();
    await page.waitForFunction(() => document.querySelector("iframe").style.maskImage !== "");
    await expectMessages(1);
    const chip = messages.first().locator("li.chip");
    await page.waitForFunction(
      () => document.querySelector(".chat-message li.chip")?.dataset.unresolved === "false",
    );
    await page.screenshot({ path: path.join(out, "02-after-reload.png") });
    return (await chip.locator(".chip-label").textContent()) ?? "";
  });

  await step("Live mode's chat does not show the component's messages", async () => {
    await frame.getByRole("button", { name: "Live mode", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("iframe").style.maskImage === "");
    await expectMessages(0);
    const found = await layout();
    if (found.docked !== false || found.title !== "Chat") throw new Error(JSON.stringify(found));
    await page.screenshot({ path: path.join(out, "03-live.png") });
  });
} finally {
  await browser.close();
}
report(results, errors, out);
