import { expect, test } from "@playwright/test";

test.describe("skills catalog", () => {
  test("lists Anthropic skills with the previously-installed one marked", async ({ page }) => {
    await page.goto("/skills");

    const card = page.getByTestId("skill-card-frontend-design");
    await expect(card).toBeVisible();
    await expect(card.getByText("installed", { exact: true })).toBeVisible();
    await expect(page.getByTestId("skill-card-claude-api").getByText("not installed")).toBeVisible();
  });

  test("toggles manual steps and exposes a copy-oneliner button", async ({ page }) => {
    await page.goto("/skills");

    await page.getByTestId("toggle-steps-frontend-design").click();
    const steps = page.getByTestId("skill-card-frontend-design").locator("pre");
    await expect(steps).toContainText("git sparse-checkout set skills/frontend-design");
    await expect(page.getByTestId("copy-oneliner-frontend-design")).toBeVisible();
  });

  test("filter narrows the grid", async ({ page }) => {
    await page.goto("/skills");

    await page.getByTestId("skill-filter").fill("frontend");
    await expect(page.getByTestId("skill-card-frontend-design")).toBeVisible();
    await expect(page.getByTestId("skill-card-claude-api")).toHaveCount(0);
  });
});
