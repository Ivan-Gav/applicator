import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { maxDocumentFileBytes } from "@/domain/document/format";
import { DocumentUploadFailure, type DocumentUploadOutcome } from "@/domain/document/model";
import { documentFormField } from "@/domain/document/schema";
import { messages } from "@/ui/messages";
import { UploadDocumentDialog } from "./UploadDocumentDialog";

const t = messages.documents;
const f = documentFormField;

function pdf(name = "cv-2026.pdf", size = 9) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

// applyAccept off: a person can always switch the file picker to "All files".
async function openDialog() {
  const upload = vi.fn<(form: FormData) => Promise<DocumentUploadOutcome>>(() =>
    Promise.resolve({ failure: null }),
  );
  render(<UploadDocumentDialog upload={upload} />);
  const user = userEvent.setup({ applyAccept: false });
  await user.click(screen.getByRole("button", { name: t.upload }));
  return { upload, user, dialog: screen.getByRole("dialog", { name: t.uploadDialog.title }) };
}

function fileInput() {
  return screen.getByLabelText(t.form.file);
}

describe("UploadDocumentDialog", () => {
  it("uploads the file with its type, title and language, the title taken from the file", async () => {
    const { upload, user, dialog } = await openDialog();

    await user.upload(fileInput(), pdf());
    expect(screen.getByRole("textbox", { name: t.form.title })).toHaveValue("cv-2026");
    await user.selectOptions(screen.getByRole("combobox", { name: t.form.type }), t.type.diploma);
    await user.selectOptions(
      screen.getByRole("combobox", { name: t.form.language }),
      t.language.de,
    );
    await user.type(screen.getByRole("textbox", { name: t.form.label }), "short");
    await user.click(screen.getByRole("button", { name: t.form.submit }));

    expect(upload).toHaveBeenCalledOnce();
    const sent = upload.mock.calls[0]![0];
    expect((sent.get(f.file) as File).name).toBe("cv-2026.pdf");
    expect(Object.fromEntries([...sent].filter(([name]) => name !== f.file))).toEqual({
      [f.type]: "diploma",
      [f.title]: "cv-2026",
      [f.language]: "de",
      [f.label]: "short",
    });
    expect(dialog).not.toBeInTheDocument();
  });

  it("offers to choose a file, then shows only its name, the field still named File", async () => {
    const { user, dialog } = await openDialog();
    const field = within(dialog);

    expect(field.getByText(t.form.chooseFile)).toBeInTheDocument();
    await user.upload(fileInput(), pdf("Ivan-Gavrilin-FrontEnd-Dev-DE-w-phone.pdf"));

    expect(field.getByText("Ivan-Gavrilin-FrontEnd-Dev-DE-w-phone.pdf")).toHaveClass("truncate");
    expect(field.queryByText(t.form.chooseFile)).toBeNull();
    expect(fileInput()).toHaveAccessibleName(t.form.file);
  });

  it("keeps a title the user typed when a file is chosen", async () => {
    const { user } = await openDialog();

    await user.type(screen.getByRole("textbox", { name: t.form.title }), "CV, English");
    await user.upload(fileInput(), pdf());

    expect(screen.getByRole("textbox", { name: t.form.title })).toHaveValue("CV, English");
  });

  it.each([
    [
      "a file over the limit",
      pdf("cv.pdf", maxDocumentFileBytes + 1),
      DocumentUploadFailure.TooLarge,
    ],
    ["a type not on the list", pdf("cv.exe"), DocumentUploadFailure.UnsupportedType],
    ["an empty file", pdf("cv.pdf", 0), DocumentUploadFailure.Empty],
  ])("refuses %s before uploading anything", async (_, file, failure) => {
    const { upload, user } = await openDialog();

    await user.upload(fileInput(), file);
    expect(fileInput()).toHaveAccessibleDescription(
      expect.stringContaining(t.form.failure[failure]),
    );
    await user.click(screen.getByRole("button", { name: t.form.submit }));

    expect(upload).not.toHaveBeenCalled();
    expect(fileInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("asks for a file and a title before uploading", async () => {
    const { upload, user } = await openDialog();

    await user.click(screen.getByRole("button", { name: t.form.submit }));

    expect(upload).not.toHaveBeenCalled();
    expect(fileInput()).toHaveAccessibleDescription(
      expect.stringContaining(t.form.errors.fileMissing),
    );
    expect(screen.getByRole("textbox", { name: t.form.title })).toHaveAccessibleDescription(
      t.form.errors.title,
    );
  });

  it("says why the server refused the file and stays open", async () => {
    const { upload, user, dialog } = await openDialog();
    upload.mockResolvedValue({ failure: DocumentUploadFailure.ContentMismatch });

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: t.form.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.form.failure[DocumentUploadFailure.ContentMismatch],
    );
    expect(dialog).toBeInTheDocument();
  });

  it("says so when the upload fails", async () => {
    const { upload, user } = await openDialog();
    upload.mockRejectedValue(new Error("network down"));

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: t.form.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t.form.failed);
  });
});
