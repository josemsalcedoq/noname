import { expect, test } from "@playwright/test";

test.describe("personal hub — notes lifecycle", () => {
  test("create, archive, unarchive, then delete a note end-to-end", async ({ page }) => {
    const title = `e2e-${Date.now()}`;
    await page.goto("/personal-hub?tab=notes");

    await page.getByTestId("note-title-input").fill(title);
    await page.getByTestId("note-body-input").fill("body");
    await page.getByTestId("note-create-button").click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByText(title, { exact: true }).click();
    await page.getByRole("button", { name: "archive", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);

    await page.getByTestId("archived-toggle").click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByText(title, { exact: true }).click();
    await page.getByRole("button", { name: "unarchive", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);

    await page.getByTestId("archived-toggle").click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByText(title, { exact: true }).click();
    await page.getByRole("button", { name: "delete", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  });
});

test.describe("personal hub — todos lifecycle", () => {
  test("create, complete, reopen, delete a todo", async ({ page }) => {
    const title = `e2e-${Date.now()}`;
    await page.goto("/personal-hub?tab=todos");

    await page.getByTestId("todo-title-input").fill(title);
    await page.getByTestId("todo-create-button").click();
    await expect(page.getByText(title)).toBeVisible();

    const row = page.getByText(title).locator("xpath=ancestor::li");
    await row.locator("input[type=checkbox]").click();
    await expect(page.getByText(title)).toHaveCount(0);

    await page.getByRole("button", { name: "done" }).first().click();
    const doneRow = page.getByText(title).locator("xpath=ancestor::li");
    await doneRow.locator("input[type=checkbox]").click();
    await expect(page.getByText(title)).toHaveCount(0);

    await page.getByRole("button", { name: "open" }).first().click();
    const openRow = page.getByText(title).locator("xpath=ancestor::li");
    await openRow.getByTitle("delete").click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
