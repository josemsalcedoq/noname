import { expect, test } from "@playwright/test";

test.describe("text translator", () => {
  test("translates English input to Spanish via the live backend", async ({ page }) => {
    await page.goto("/text-translator");

    await page.getByTestId("source-textarea").fill("Hello, how are you today?");
    await page.getByTestId("translate-button").click();

    const target = page.getByTestId("target-textarea");
    await expect(target).not.toHaveValue("");
    const value = await target.inputValue();
    expect(value.toLowerCase()).toMatch(/hola|cómo|estás/);
  });

  test("swap button mirrors the previous output back into the source pane", async ({ page }) => {
    await page.goto("/text-translator");

    await page.getByTestId("source-textarea").fill("good morning");
    await page.getByTestId("translate-button").click();
    await expect(page.getByTestId("target-textarea")).not.toHaveValue("");

    const beforeOutput = await page.getByTestId("target-textarea").inputValue();
    await page.getByTestId("swap-button").click();

    await expect(page.getByTestId("source-textarea")).toHaveValue(beforeOutput);
    await expect(page.getByTestId("source-lang")).toHaveValue("es");
    await expect(page.getByTestId("target-lang")).toHaveValue("en");
  });

  test("empty input does not call the backend", async ({ page }) => {
    await page.goto("/text-translator");

    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/text-translator/translate")) requests.push(r.url());
    });

    await page.getByTestId("translate-button").click();
    await page.waitForTimeout(300);

    expect(requests).toHaveLength(0);
    await expect(page.getByTestId("target-textarea")).toHaveValue("");
  });
});
