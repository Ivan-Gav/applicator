import { readFile } from "node:fs/promises";
import { type Download, expect, type Page, test } from "@playwright/test";
import { documentsPath, routes } from "@/app/routes";
import { defaultDocumentListQuery } from "@/domain/document/list";
import { formatFileSize } from "@/lib/file-size";
import { messages } from "@/ui/messages";
import { authStateFile, documentsStateFile } from "./support/auth";
import { removeDocuments, storedFileKeys } from "./support/documents";
import { isAt } from "./support/urls";

const t = messages.documents;

test.use({ storageState: documentsStateFile });
// One user for the whole file, emptied before each test: one at a time.
test.describe.configure({ mode: "default" });

test.beforeEach(async ({ page }) => {
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

test("a document is uploaded, gets a second version, opens, downloads, is found, stays private, and is deleted with its files", async ({
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

  // Deleting removes the document, its versions, and both files.
  await iconButton(page, t.actions.delete, "CV, English").click();
  const confirm = page.getByRole("alertdialog", { name: t.deleteDialog.title });
  await expect(confirm).toContainText(t.deleteDialog.description("CV, English", 2));
  await confirm.getByRole("button", { name: t.deleteDialog.confirm }).click();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeVisible();
  // The files go after the response, so they may outlast the page by a moment.
  await expect.poll(() => storedFileKeys(page.request)).toEqual([]);
});
