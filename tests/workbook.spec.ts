import { expect, test } from "@playwright/test";

test("grid controls change the actual content geometry, not just labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("switch", { name: "Column grid" }).click();
  await expect(page.locator(".grid-overlay > span")).toHaveCount(12);
  await page.getByLabel("Columns", { exact: true }).selectOption("10");
  await expect(page.locator(".grid-overlay > span")).toHaveCount(10);
  await expect(page.locator(".metric").first()).toHaveCSS(
    "grid-column-start",
    "span 3",
  );
  await expect(page.locator(".metric").last()).toHaveCSS(
    "grid-column-start",
    "span 4",
  );
  await page.getByLabel("Gutter", { exact: true }).selectOption("32");
  await expect(page.locator(".metric-grid")).toHaveCSS("gap", "32px");
  await page.getByLabel("Content padding", { exact: true }).selectOption("16");
  await expect(page.locator(".mock-content")).toHaveCSS("padding", "16px");
  await page.getByRole("button", { name: "Reset controls" }).click();
  await expect(page.locator(".mock-content")).toHaveCSS("padding", "24px");
  await expect(page.locator(".grid-overlay")).toHaveCount(0);
});

test("patterns change composition and density changes row heights", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "List + detail", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Brand refresh", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editor workspace", exact: true })
    .click();
  await expect(page.getByText("Scene 04 / The arrival")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Workspace name")).toHaveValue("Forma Studio");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(page.locator(".project-row").first()).toHaveCSS(
    "min-height",
    "36px",
  );
});

test("lessons give feedback and components expose real states", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Learning path", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use 24px everywhere", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Try again");
  await page
    .getByRole("button", { name: "8px within, 24px between", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Exactly");
  await page.getByRole("button", { name: "Next lesson", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hierarchy before decoration" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
});

test("narrow viewport reflows without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(
    page.getByRole("heading", {
      name: "A little structure. A lot of clarity.",
    }),
  ).toBeVisible();
  const lastTab = await page
    .getByRole("button", { name: "Open Learning path", exact: true })
    .boundingBox();
  expect(lastTab).not.toBeNull();
  if (lastTab) expect(lastTab.x + lastTab.width).toBeLessThanOrEqual(370);
});

test("component error recovery, menu selection and empty state work", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Components", exact: true })
    .click();
  const field = page.getByLabel("Project name", { exact: true });
  await field.fill("  ");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("status")).toContainText("Enter a project name");
  await field.fill("A new direction");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByRole("status")).toContainText("Saved");
  await page
    .getByRole("button", { name: "Project actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplicate project", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Duplicate project selected in this mock menu."),
  ).toBeVisible();
  await expect(page.locator("#example-menu")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add mock asset", exact: true })
    .click();
  await expect(
    page.getByText("brand-guidelines.pdf", { exact: true }),
  ).toBeVisible();
});
