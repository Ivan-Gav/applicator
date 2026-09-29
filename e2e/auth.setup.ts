import { expect, test as setup } from "@playwright/test";
import { messages } from "@/ui/messages";
import {
  applicationsStateFile,
  applicationsUser,
  authStateFile,
  sharedUser,
  signInWithMagicLink,
} from "./support/auth";

for (const { user, stateFile } of [
  { user: sharedUser, stateFile: authStateFile },
  { user: applicationsUser, stateFile: applicationsStateFile },
]) {
  setup(`sign ${user.email} in`, async ({ page }) => {
    await signInWithMagicLink(page, user.email);

    await expect(
      page.getByRole("heading", { level: 1, name: messages.applications.title }),
    ).toBeVisible();
    await page.context().storageState({ path: stateFile });
  });
}
