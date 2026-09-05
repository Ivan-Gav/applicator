import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the project name", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Applicator" })).toBeVisible();
  });

  test("renders the primary button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  });
});
