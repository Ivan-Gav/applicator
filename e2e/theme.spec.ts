import { expect, test } from "@playwright/test";
import { routes } from "@/app/routes";
import { messages } from "@/ui/messages";
import { authStateFile } from "./support/auth";

test.use({ storageState: authStateFile, colorScheme: "dark" });

const darkClass = /(^|\s)dark(\s|$)/;

test("the theme follows the system until picked, and the pick survives a reload", async ({
  page,
}) => {
  await page.goto(routes.applications);
  const html = page.locator("html");
  const toggle = page.getByRole("switch", { name: messages.nav.darkTheme });
  await expect(html).toHaveClass(darkClass);
  await expect(toggle).toBeChecked();

  await toggle.click();
  await expect(html).not.toHaveClass(darkClass);

  await page.reload();
  await expect(html).not.toHaveClass(darkClass);
  await expect(toggle).not.toBeChecked();
});
