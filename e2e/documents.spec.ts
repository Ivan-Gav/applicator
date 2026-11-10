import { readFile } from "node:fs/promises";
import { type Download, expect, type Page, test } from "@playwright/test";
import { applicationPath, documentsPath, routes } from "@/app/routes";
import { defaultDocumentListQuery } from "@/domain/document/list";
import { formatFileSize } from "@/lib/file-size";
import { messages } from "@/ui/messages";
import { removeApplications, seedApplication } from "./support/applications";
import { authStateFile, documentsStateFile } from "./support/auth";
import { removeDocuments, storedFileKeys } from "./support/documents";
import { isAt } from "./support/urls";

const t = messages.documents;
const a = messages.applications.form;

test.use({ storageState: documentsStateFile });
// One user for the whole file, emptied before each test: one at a time.
test.describe.configure({ mode: "default" });

test.beforeEach(async ({ page }) => {
  await removeApplications(page.request);
  await removeDocuments(page.request);
});

// Real PDF headers, so the server's content check passes as for a real file.
const firstFile = {
  name: "cv-2026.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\n% first version\n"),
};
const secondFile = {
  name: "cv-2026-backend.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\n% second version, revised\n"),
};
const thirdFile = {
  name: "cv-2026-short.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\n% third version, short\n"),
};
const letterFile = {
  name: "letter-kestrel.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\n% cover letter\n"),
};

async function downloaded(page: Page, link: ReturnType<Page["getByRole"]>): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  return download;
}

async function contentOf(download: Download): Promise<Buffer> {
  return readFile(await download.path());
}

function row(page: Page, title: string) {
  return page.getByRole("row").filter({ has: page.getByText(title, { exact: true }) });
}

function iconButton(page: Page, action: string, title: string) {
  return page.getByRole("button", { name: t.actions.label(action, title) });
}

test("a document is uploaded, gets versions, opens, downloads, is found, stays private, is sent with an application at the version attached, and is deleted with its files once detached", async ({
  page,
  browser,
}) => {
  await page.goto(routes.documents);
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeVisible();

  // Upload: the title is taken from the file until it is changed.
  await page.getByRole("button", { name: t.upload }).click();
  const uploadDialog = page.getByRole("dialog", { name: t.uploadDialog.title });
  await uploadDialog.getByLabel(t.form.file).setInputFiles(firstFile);
  const title = uploadDialog.getByRole("textbox", { name: t.form.title });
  await expect(title).toHaveValue("cv-2026");
  await title.fill("CV, English");
  await uploadDialog
    .getByRole("combobox", { name: t.form.language })
    .selectOption({ label: t.language.en });
  await uploadDialog.getByRole("button", { name: t.form.submit }).click();
  await expect(uploadDialog).toBeHidden();

  const cv = row(page, "CV, English");
  await expect(cv).toContainText(t.type.cv);
  await expect(cv).toContainText(t.language.en);
  await expect(cv).toContainText(firstFile.name);
  await expect(cv).toContainText(
    t.fileSummary(t.format.pdf, formatFileSize(firstFile.buffer.length)),
  );
  // One file without a label: nothing to choose between.
  const versions = page.getByRole("combobox", { name: t.versions.select("CV, English") });
  await expect(versions).toBeHidden();

  // Proves the document came from the database, not from client state.
  await page.reload();
  await expect(cv).toBeVisible();

  // A second version, which as the newest is chosen.
  await iconButton(page, t.actions.addVersion, "CV, English").click();
  const versionDialog = page.getByRole("dialog", { name: t.versionDialog.title("CV, English") });
  await versionDialog.getByLabel(t.form.file).setInputFiles(secondFile);
  await versionDialog.getByRole("textbox", { name: t.form.label }).fill("backend-heavy");
  await versionDialog.getByRole("button", { name: t.form.submit }).click();
  await expect(versionDialog).toBeHidden();

  await expect(versions.getByRole("option")).toHaveText(["backend-heavy", t.versions.original]);
  await expect(cv).toContainText(secondFile.name);

  // The row opens the chosen version: shown in the browser under its own name.
  const rowLink = page.getByRole("link", { name: t.open("CV, English", "backend-heavy") });
  await expect(rowLink).toHaveAttribute("target", "_blank");
  const openHref = await rowLink.getAttribute("href");
  const opened = await page.request.get(openHref ?? "");
  expect(opened.headers()["content-type"]).toBe("application/pdf");
  expect(opened.headers()["content-disposition"]).toBe(
    `inline; filename="${secondFile.name}"; filename*=UTF-8''${secondFile.name}`,
  );
  expect(await opened.body()).toEqual(secondFile.buffer);

  // Download saves the chosen version, byte for byte.
  const download = page.getByRole("link", {
    name: t.actions.label(t.actions.download, "CV, English"),
  });
  const newest = await downloaded(page, download);
  expect(newest.suggestedFilename()).toBe(secondFile.name);
  expect(await contentOf(newest)).toEqual(secondFile.buffer);

  await versions.selectOption({ label: t.versions.original });
  await expect(
    page.getByRole("link", { name: t.open("CV, English", t.versions.original) }),
  ).toBeVisible();
  const first = await downloaded(page, download);
  expect(first.suggestedFilename()).toBe(firstFile.name);
  expect(await contentOf(first)).toEqual(firstFile.buffer);
  const firstFileHref = await download.getAttribute("href");

  // Found by a version label in the search, kept with a type filter through a reload.
  await page.getByRole("searchbox", { name: t.search.label }).fill("backend heavy");
  await expect(page).toHaveURL(
    isAt(documentsPath({ ...defaultDocumentListQuery, search: "backend heavy" })),
  );
  await page
    .getByRole("group", { name: t.filters.label })
    .getByRole("button", { name: `${t.type.cv} 1` })
    .click();
  const searched = documentsPath({
    ...defaultDocumentListQuery,
    search: "backend heavy",
    types: ["cv"],
  });
  await expect(page).toHaveURL(isAt(searched));
  await page.reload();
  await expect(cv).toBeVisible();
  await page.getByRole("searchbox", { name: t.search.label }).fill("nowhere");
  await expect(page.getByRole("heading", { name: t.nothingMatches.title })).toBeVisible();
  await page.goto(routes.documents);

  // Another user who has the addresses gets nothing.
  const stranger = await browser.newContext({ storageState: authStateFile });
  for (const href of [firstFileHref, openHref]) {
    const refused = await stranger.request.get(href ?? "", { maxRedirects: 0 });
    expect(refused.status()).toBe(404);
  }
  await stranger.close();

  expect(await storedFileKeys(page.request)).toHaveLength(2);

  // Attached to an application at its current version, "backend-heavy", and saved.
  const applicationId = await seedApplication(page.request, {
    companyName: "Kestrel Robotics",
    positionTitle: "Frontend Engineer",
  });
  await page.goto(applicationPath(applicationId));
  const attachedList = page.getByRole("list", { name: a.documents.listLabel });
  const versionSent = page.getByRole("button", { name: a.documents.version("CV, English") });
  const documentField = page.getByRole("combobox", { name: a.documents.document });
  await documentField.fill("cv, eng");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(attachedList.getByRole("listitem")).toHaveCount(1);
  await expect(versionSent).toHaveText("backend-heavy");

  // A document uploaded from the application is attached once the page lists it.
  await documentField.click();
  await page.getByRole("option", { name: a.documents.uploadAndAttach }).click();
  const attachUpload = page.getByRole("dialog", { name: t.uploadDialog.title });
  await attachUpload.getByLabel(t.form.file).setInputFiles(letterFile);
  await attachUpload
    .getByRole("combobox", { name: t.form.type })
    .selectOption({ label: t.type.cover_letter });
  await attachUpload.getByRole("button", { name: t.form.submit }).click();
  await expect(attachUpload).toBeHidden();
  await expect(attachedList.getByRole("link")).toHaveText(["CV, English", "letter-kestrel"]);
  await expect(documentField).toBeFocused();
  await page.getByRole("button", { name: a.saveChanges }).click();
  await expect(page.getByText(a.saved)).toBeVisible();
  await page.reload();
  await expect(versionSent).toHaveText("backend-heavy");
  const attachedLink = attachedList.getByRole("link", {
    name: t.open("CV, English", "backend-heavy"),
  });
  await expect(attachedLink).toHaveAttribute("href", openHref ?? "");

  // A third version, which becomes the document's current one.
  await page.goto(routes.documents);
  await iconButton(page, t.actions.addVersion, "CV, English").click();
  await versionDialog.getByLabel(t.form.file).setInputFiles(thirdFile);
  await versionDialog.getByRole("textbox", { name: t.form.label }).fill("short");
  await versionDialog.getByRole("button", { name: t.form.submit }).click();
  await expect(versionDialog).toBeHidden();
  await expect(versions.getByRole("option")).toHaveText([
    "short",
    "backend-heavy",
    t.versions.original,
  ]);

  // The point of attaching a version: after the newer "short" arrived, the
  // application still says "backend-heavy" was sent, and still opens that file.
  await page.goto(applicationPath(applicationId));
  await expect(versionSent).toHaveText("backend-heavy");
  await expect(attachedLink).toHaveAttribute("href", openHref ?? "");
  expect(await (await page.request.get(openHref ?? "")).body()).toEqual(secondFile.buffer);

  // While attached, Delete explains why it cannot, naming the application and the version sent.
  await page.goto(routes.documents);
  await iconButton(page, t.actions.delete, "CV, English").click();
  const refusal = page.getByRole("alertdialog", { name: t.inUseDialog.title });
  await expect(refusal).toContainText(`CV, English${t.inUseDialog.description(1)}`);
  await expect(refusal.getByRole("link")).toHaveText([/^Kestrel Robotics.*backend-heavy$/]);
  await refusal.getByRole("button", { name: t.inUseDialog.close }).click();
  await expect(refusal).toBeHidden();

  // Detached and saved, the documents can go.
  await page.goto(applicationPath(applicationId));
  await expect(attachedList.getByRole("link")).toHaveText(["CV, English", "letter-kestrel"]);
  await page.getByRole("button", { name: a.documents.remove("CV, English") }).click();
  await page.getByRole("button", { name: a.documents.remove("letter-kestrel") }).click();
  await expect(page.getByText(a.documents.empty)).toBeVisible();
  await page.getByRole("button", { name: a.saveChanges }).click();
  await expect(page.getByText(a.saved)).toBeVisible();
  await page.goto(routes.documents);
  await iconButton(page, t.actions.delete, "letter-kestrel").click();
  await page
    .getByRole("alertdialog", { name: t.deleteDialog.title })
    .getByRole("button", { name: t.deleteDialog.confirm })
    .click();
  await expect(row(page, "letter-kestrel")).toBeHidden();

  // Deleting removes the document, its versions, and all three files.
  await iconButton(page, t.actions.delete, "CV, English").click();
  const confirm = page.getByRole("alertdialog", { name: t.deleteDialog.title });
  await expect(confirm).toContainText(t.deleteDialog.description("CV, English", 3));
  await confirm.getByRole("button", { name: t.deleteDialog.confirm }).click();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeVisible();
  // The files go after the response, so they may outlast the page by a moment.
  await expect.poll(() => storedFileKeys(page.request)).toEqual([]);
});
