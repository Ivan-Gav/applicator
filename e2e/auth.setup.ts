import { expect, test as setup } from "@playwright/test";
import { messages } from "@/ui/messages";
import { authStateFile, sharedUser, signInWithMagicLink } from "./support/auth";

// Runs once before the suite: signs the shared test user in through the real
// callback and persists the resulting cookies. Specs that merely need a session
// load that storageState instead of walking through the sign-in UI again.
setup("sign the shared test user in", async ({ page }) => {
  await signInWithMagicLink(page, sharedUser.email);

  await expect(
    page.getByRole("heading", { level: 1, name: messages.applications.title }),
  ).toBeVisible();
  await page.context().storageState({ path: authStateFile });
});
