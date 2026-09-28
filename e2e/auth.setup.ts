import { expect, test as setup } from "@playwright/test";
import { messages } from "@/ui/messages";
import { authStateFile, sharedUser, signInWithMagicLink } from "./support/auth";

setup("sign the shared test user in", async ({ page }) => {
  await signInWithMagicLink(page, sharedUser.email);

  await expect(
    page.getByRole("heading", { level: 1, name: messages.applications.title }),
  ).toBeVisible();
  await page.context().storageState({ path: authStateFile });
});
