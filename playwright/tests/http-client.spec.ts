import { expect, test } from "@playwright/test";

test.describe("http client", () => {
  test("imports a Postman v2.1 collection and renders it in the tree", async ({ page }) => {
    const collectionName = `e2e-import-${Date.now()}`;
    const postman = {
      info: {
        name: collectionName,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "users",
          item: [
            {
              name: "list users",
              request: {
                method: "GET",
                url: { raw: "https://example.test/users" },
              },
            },
          ],
        },
      ],
    };

    await page.goto("/http-client");
    await page.getByTestId("new-collection-toggle").click();
    await page.getByTestId("import-input").setInputFiles({
      name: "collection.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(postman)),
    });

    await expect(page.getByTestId("collection-select")).toHaveValue(/\d+/);
    await expect(page.getByText("users", { exact: true })).toBeVisible();
    await expect(page.getByText("list users", { exact: true })).toBeVisible();
  });

  test("send button is disabled until a URL is entered", async ({ page }) => {
    await page.goto("/http-client");
    await page.getByTestId("url-input").fill("");
    await expect(page.getByTestId("send-button")).toBeDisabled();
    await page.getByTestId("url-input").fill("https://example.com");
    await expect(page.getByTestId("send-button")).toBeEnabled();
  });
});
