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

  test("translate button is disabled while input is empty", async ({ page }) => {
    await page.goto("/text-translator");

    const button = page.getByTestId("translate-button");
    await expect(button).toBeDisabled();

    await page.getByTestId("source-textarea").fill("hello");
    await expect(button).toBeEnabled();

    await page.getByTestId("source-textarea").fill("");
    await expect(button).toBeDisabled();
  });
});
