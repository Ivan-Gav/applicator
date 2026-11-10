import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AttachedVersion } from "@/domain/application/model";
import type { ApplicationRejection, CreateApplication } from "@/domain/application/schema";
import type { NewDocumentOutcome } from "@/domain/document/model";
import { anApplication } from "@/test/application.fixture";
import { messages } from "@/ui/messages";
import { ApplicationForm } from "./ApplicationForm";
import type { AttachableDocument } from "./attachable-documents";

const t = messages.applications.form;
const d = t.documents;

function aDocument(
  id: string,
  title: string,
  type: AttachableDocument["type"],
  versionNames: string[] = [],
): AttachableDocument {
  const names = versionNames.length > 0 ? versionNames : [messages.documents.versions.original];
  return {
    id,
    title,
    type,
    uploadedOn: "2 Oct",
    versions: names.map((name, index) => ({
      id: `${id}-v${names.length - index}`,
      name,
      uploadedOn: `${2 + index} Oct 2026`,
      open: `/files/${id}-v${names.length - index}?open`,
    })),
    withVersions: versionNames.length > 0,
  };
}

// Newest upload first, as the page passes them.
const cv = aDocument("cv", "CV — English", "cv", ["2026-10", "2026-09-ats", "2026-08"]);
const anlagen = aDocument("set", "Anlagen", "attachment_set");
const letter = aDocument("letter", "Anschreiben Kestrel", "cover_letter");
const documents = [cv, anlagen, letter];

type Save = (input: CreateApplication, attached: string[]) => Promise<ApplicationRejection>;

function renderForm(
  options: {
    attached?: AttachedVersion[];
    save?: Save;
    upload?: (form: FormData) => Promise<NewDocumentOutcome>;
  } = {},
) {
  const save = vi.fn<Save>(options.save ?? (() => Promise.resolve({ invalidFields: [] })));
  const upload = vi.fn(
    options.upload ??
      (() => Promise.resolve<NewDocumentOutcome>({ failure: null, documentId: "x" })),
  );
  const props: ComponentProps<typeof ApplicationForm> = {
    save,
    backHref: "/list",
    citySearch: { action: "/api/cities", name: "q" },
    sourceSearch: { action: "/api/sources", name: "q" },
    application: anApplication(),
    documents,
    attached: options.attached ?? [],
    uploadDocument: upload,
  };
  const { rerender } = render(
    <main>
      <ApplicationForm {...props} />
    </main>,
  );
  return {
    save,
    upload,
    user: userEvent.setup(),
    showDocuments: (shown: AttachableDocument[]) =>
      rerender(
        <main>
          <ApplicationForm {...props} documents={shown} />
        </main>,
      ),
  };
}

function panel() {
  return screen.getByRole("group", { name: d.title });
}

function documentField() {
  return screen.getByRole("combobox", { name: d.document });
}

function attachedTitles() {
  const list = screen.queryByRole("list", { name: d.listLabel });
  return list
    ? within(list)
        .getAllByRole("listitem")
        .map((item) => within(item).getByRole("link").textContent)
    : [];
}

function saveChanges() {
  return screen.getByRole("button", { name: t.saveChanges });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("the documents panel", () => {
  it("says nothing is attached yet, and Save changes stays off", () => {
    renderForm();

    expect(within(panel()).getByText(d.empty)).toBeVisible();
    expect(screen.queryByRole("list", { name: d.listLabel })).not.toBeInTheDocument();
    expect(saveChanges()).toBeDisabled();
  });

  it("adds a document from the keyboard: type, ↓, Enter, Enter, at its current version", async () => {
    const { user, save } = renderForm();

    await user.type(documentField(), "anlagen");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(documentField()).toHaveValue("Anlagen");
    expect(documentField()).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");

    expect(attachedTitles()).toEqual(["Anlagen"]);
    expect(within(panel()).getByText(d.count(1))).toBeVisible();
    expect(documentField()).toHaveValue("");
    expect(documentField()).toHaveFocus();

    // Four in a row; a CV with versions is attached at its newest.
    await user.type(documentField(), "cv");
    await user.keyboard("{ArrowDown}{Enter}{Enter}");
    expect(attachedTitles()).toEqual(["Anlagen", "CV — English"]);
    expect(screen.getByRole("button", { name: d.version(cv.title) })).toHaveTextContent("2026-10");

    expect(saveChanges()).toBeEnabled();
    await user.click(saveChanges());
    expect(save).toHaveBeenCalledWith(expect.anything(), ["set-v1", "cv-v3"]);
    expect(await screen.findByRole("button", { name: t.saveChanges })).toBeDisabled();
  });

  it("lists every document newest first, attached ones dimmed and skipped by the arrow keys", async () => {
    const { user } = renderForm({ attached: [{ documentId: "cv", versionId: "cv-v1" }] });

    await user.click(documentField());
    const options = within(screen.getByRole("listbox", { name: d.options })).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      `${messages.documents.type.cv}${cv.title}${d.attached}`,
      `${messages.documents.type.attachment_set}Anlagen2 Oct`,
      `${messages.documents.type.cover_letter}Anschreiben Kestrel2 Oct`,
      d.uploadAndAttach,
    ]);
    expect(options[0]).toHaveAttribute("aria-disabled", "true");

    await user.keyboard("{ArrowDown}");
    expect(documentField()).toHaveAttribute("aria-activedescendant", options[1]?.id);
    await user.click(options[0] as HTMLElement);
    expect(documentField()).toHaveValue("");
  });

  it("narrows the list by type and by the typed title, and says when nothing matches", async () => {
    const { user } = renderForm();

    await user.selectOptions(
      screen.getByRole("combobox", { name: d.type }),
      messages.documents.type.cover_letter,
    );
    expect(documentField()).toHaveAttribute("placeholder", d.placeholder.cover_letter);
    await user.click(documentField());
    expect(
      within(screen.getByRole("listbox", { name: d.options })).getAllByRole("option"),
    ).toHaveLength(2);

    await user.type(documentField(), "nordlicht");
    expect(screen.getByText(d.nothingMatches("nordlicht"))).toBeVisible();
  });

  it("keeps the type after adding, and clears the field on a second Escape", async () => {
    const { user } = renderForm();
    const type = screen.getByRole("combobox", { name: d.type });

    await user.selectOptions(type, messages.documents.type.cover_letter);
    await user.type(documentField(), "kestrel");
    await user.keyboard("{ArrowDown}{Enter}");
    await user.click(screen.getByRole("button", { name: d.add }));
    expect(type).toHaveValue("cover_letter");

    await user.type(documentField(), "x");
    await user.keyboard("{Escape}");
    expect(documentField()).toHaveAttribute("aria-expanded", "false");
    expect(documentField()).toHaveValue("x");
    await user.keyboard("{Escape}");
    expect(documentField()).toHaveValue("");
  });

  it("changes the version sent from the menu, and saves that version", async () => {
    const { user, save } = renderForm({ attached: [{ documentId: "cv", versionId: "cv-v1" }] });
    const versionButton = screen.getByRole("button", { name: d.version(cv.title) });
    expect(versionButton).toHaveTextContent("2026-08");
    expect(
      screen.getByRole("link", { name: messages.documents.open(cv.title, "2026-08") }),
    ).toHaveAttribute("href", "/files/cv-v1?open");

    await user.click(versionButton);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: /2026-08/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(within(menu).getByRole("menuitemradio", { name: /2026-09-ats/ }));

    expect(versionButton).toHaveTextContent("2026-09-ats");
    expect(saveChanges()).toBeEnabled();
    await user.click(saveChanges());
    expect(save).toHaveBeenCalledWith(expect.anything(), ["cv-v2"]);
  });

  it("names no version for a document without versions to tell apart", () => {
    renderForm({ attached: [{ documentId: "set", versionId: "set-v1" }] });

    expect(
      screen.getByRole("link", { name: messages.documents.open("Anlagen", null) }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: d.version("Anlagen") })).not.toBeInTheDocument();
  });

  it("removes a document at once, which counts as a change to save", async () => {
    const { user, save } = renderForm({
      attached: [
        { documentId: "set", versionId: "set-v1" },
        { documentId: "letter", versionId: "letter-v1" },
      ],
    });
    expect(saveChanges()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: d.remove("Anlagen") }));

    expect(attachedTitles()).toEqual(["Anschreiben Kestrel"]);
    await user.click(saveChanges());
    expect(save).toHaveBeenCalledWith(expect.anything(), ["letter-v1"]);
  });

  it("uploads from the list's last item and attaches the new document once the page lists it", async () => {
    const { user, upload, showDocuments } = renderForm({
      upload: () => Promise.resolve({ failure: null, documentId: "fresh" }),
    });

    await user.click(documentField());
    await user.keyboard("{ArrowUp}{Enter}");
    const dialog = screen.getByRole("dialog", { name: messages.documents.uploadDialog.title });
    await user.upload(
      within(dialog).getByLabelText(messages.documents.form.file),
      new File(["%PDF-1.7"], "zeugnis.pdf", { type: "application/pdf" }),
    );
    await user.click(within(dialog).getByRole("button", { name: messages.documents.form.submit }));

    expect(upload).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(attachedTitles()).toEqual([]);

    showDocuments([aDocument("fresh", "Zeugnis", "reference"), ...documents]);
    expect(attachedTitles()).toEqual(["Zeugnis"]);
    expect(saveChanges()).toBeEnabled();
  });

  it("says why when the server refuses the attachments", async () => {
    const { user } = renderForm({
      save: () => Promise.resolve({ invalidFields: ["attachments"] }),
    });

    await user.type(documentField(), "anlagen");
    await user.keyboard("{ArrowDown}{Enter}{Enter}");
    await user.click(saveChanges());

    expect(await screen.findByText(d.refused)).toBeVisible();
  });
});
