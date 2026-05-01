import { expect, test } from "@playwright/test";

test.describe("youtube downloader", () => {
  test("rejects a non-YouTube URL with a backend error", async ({ page }) => {
    await page.goto("/youtube-downloader");

    await page.getByTestId("url-input").fill("https://example.com/foo");
    await page.getByTestId("probe-button").click();

    await expect(page.getByRole("alert")).toContainText("Only YouTube URLs");
  });

  test("disables the download button until a URL is entered", async ({ page }) => {
    await page.goto("/youtube-downloader");
    await expect(page.getByTestId("download-button")).toBeDisabled();
  });
});
