import { expect, test } from "@playwright/test";

test.describe("docx translator", () => {
  test("rejects a non-docx file with an inline error", async ({ page }) => {
    await page.goto("/docx-translator");

    await page.getByTestId("file-input").setInputFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plain text"),
    });

    await expect(page.getByRole("alert")).toContainText("Only .docx");
    await expect(page.getByTestId("selected-file")).toHaveCount(0);
  });

  test("disables the action button until a file is selected", async ({ page }) => {
    await page.goto("/docx-translator");
    await expect(page.getByTestId("translate-button")).toBeDisabled();
  });
});
