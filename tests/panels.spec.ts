import { expect, test } from "@playwright/test";

test("panels snap on both axes without changing size or their contents", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Live mode", exact: true })
    .click();
  const handle = page.getByRole("button", { name: "Move Side navigation" });
  const panel = page.getByRole("region", { name: "Side navigation panel" });
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Missing panel handle");
  await page.mouse.move(box.x + 40, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 77, box.y + 35);
  await page.mouse.up();
  await expect(panel).toHaveCSS("left", "56px");
  await expect(panel).toHaveCSS("top", "40px");
  await expect(panel).toHaveCSS("width", "192px");
  await expect(panel).toHaveCSS("height", "400px");
  await handle.press("ArrowDown");
  await expect(panel).toHaveCSS("top", "48px");
  await expect(page.locator(".live-panel-feedback")).toContainText("overlap");
  await page.getByLabel("Panel Y", { exact: true }).fill("999");
  await expect(panel).toHaveCSS("top", "160px");
  await page.getByLabel("Panel X", { exact: true }).fill("-20");
  await expect(panel).toHaveCSS("left", "0px");
  await expect(page.locator(".live-panel-feedback")).toContainText("clear");
  await page.getByLabel("Show 8px grid").uncheck();
  await expect(page.locator(".live-panel-stage")).not.toHaveClass(/live-grid/);
  await page.getByRole("button", { name: "Reset composition" }).click();
  await expect(panel).toHaveCSS("left", "16px");
  await expect(panel).toHaveCSS("top", "24px");
  await page
    .getByRole("button", { name: "Move Chat thread" })
    .press("ArrowLeft");
  const chat = page.getByRole("region", { name: "Chat thread panel" });
  await expect(chat).toHaveCSS("left", "232px");
  await expect(chat).toHaveCSS("width", "512px");
  await expect(chat.getByText("Keep the controls grouped.")).toBeVisible();
  const chatHandle = page.getByRole("button", { name: "Move Chat thread" });
  await chatHandle.scrollIntoViewIfNeeded();
  const chatBox = await chatHandle.boundingBox();
  if (!chatBox) throw new Error("Missing chat handle");
  await page.mouse.move(chatBox.x + 40, chatBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(chatBox.x + 57, chatBox.y + 1);
  await page.mouse.up();
  await expect(chat).toHaveCSS("left", "248px");
  await expect(chat).toHaveCSS("top", "8px");
  await expect(chat).toHaveCSS("height", "440px");
  await page.getByLabel("Panel X", { exact: true }).fill("999");
  await expect(chat).toHaveCSS("left", "288px");
  await page.getByLabel("Panel Y", { exact: true }).fill("-10");
  await expect(chat).toHaveCSS("top", "0px");
});
