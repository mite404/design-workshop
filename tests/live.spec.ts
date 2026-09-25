import { expect, test } from "@playwright/test";

test("composition moves on the grid without scaling controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Live mode", exact: true })
    .click();
  const group = page.getByRole("button", { name: "Move Navigation" });
  await expect(group).toHaveCSS("left", "160px");
  await group.scrollIntoViewIfNeeded();
  const before = await group.boundingBox();
  if (!before) throw new Error("Missing navigation group");
  await page.mouse.move(before.x + 20, before.y + 16);
  await page.mouse.down();
  await page.mouse.move(before.x + 57, before.y + 16);
  await page.mouse.up();
  await expect(group).toHaveCSS("left", "200px");
  await expect(group).toHaveCSS("width", "80px");
  await group.press("ArrowRight");
  await expect(group).toHaveCSS("left", "208px");
  await page.getByLabel("Title-bar height").fill("80");
  await page.getByLabel("Window radius").fill("28");
  await expect(group).toHaveCSS("height", "36px");
  await expect(page.locator(".live-window")).toHaveCSS("border-radius", "28px");
  await expect(page.locator(".live-readout [role=status]")).toContainText(
    "22px above and below",
  );
  await page.getByLabel("Selected group X").fill("24");
  await expect(page.locator(".live-readout [role=status]")).toContainText(
    "overlap",
  );
  await group.press("Home");
  await expect(group).toHaveCSS("left", "0px");
  await page.getByRole("button", { name: "Reset composition" }).click();
  await expect(group).toHaveCSS("left", "160px");
});
