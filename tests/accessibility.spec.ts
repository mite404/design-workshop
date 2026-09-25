import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const section of [
  "Layouts",
  "Live mode",
  "Components",
  "Spacing system",
  "Learning path",
]) {
  test(`${section} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: `Open ${section}`, exact: true })
      .click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
}
