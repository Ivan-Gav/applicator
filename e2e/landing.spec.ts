import { expect, test } from "@playwright/test";
import { routes, signInPath } from "@/app/routes";
import { messages } from "@/ui/messages";
import { authStateFile } from "./support/auth";
import { isAt } from "./support/urls";

const t = messages.home;

test("the home page offers sign-in to a visitor and the app to a signed-in user", async ({
  browser,
}) => {
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(routes.home);

  await expect(
    visitorPage.getByRole("heading", { level: 1, name: messages.app.name }),
  ).toBeVisible();
  await expect(visitorPage.getByRole("link", { name: t.signIn })).toHaveAttribute(
    "href",
    signInPath(),
  );
  await expect(visitorPage.getByRole("link", { name: t.openApplications })).toHaveCount(0);
  await visitor.close();

  const member = await browser.newContext({ storageState: authStateFile });
  const memberPage = await member.newPage();
  await memberPage.goto(routes.home);

  await expect(memberPage).toHaveURL(isAt(routes.home));
  await expect(memberPage.getByRole("link", { name: t.signIn })).toHaveCount(0);
  await memberPage.getByRole("link", { name: t.openApplications }).click();
  await expect(memberPage).toHaveURL(isAt(routes.applications));
  await expect(
    memberPage.getByRole("heading", { level: 1, name: messages.applications.title }),
  ).toBeVisible();
  await member.close();
});
