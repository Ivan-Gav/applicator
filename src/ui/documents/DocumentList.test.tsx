import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentSort } from "@/domain/document/list";
import type { Document } from "@/domain/document/model";
import { SortDirection } from "@/lib/sort-direction";
import { aDocument, aVersion } from "@/test/document.fixture";
import { messages } from "@/ui/messages";
import type { SortLink } from "@/ui/SortableHead";
import { DocumentList, type DocumentListActions, type DocumentListControls } from "./DocumentList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const t = messages.documents;
const timeZone = "Europe/Berlin";

const original = aVersion({
  id: "v1",
  fileName: "cv-2025.pdf",
  sizeBytes: 245_760,
  uploadedAt: new Date("2026-09-01T09:00:00Z"),
});
const revised = aVersion({
  id: "v2",
  fileName: "cv-2026.docx",
  format: "docx",
  sizeBytes: 1_300_000,
  label: "backend-heavy",
  uploadedAt: new Date("2026-10-01T09:00:00Z"),
});

const controls: DocumentListControls = {
  search: { action: "/documents", name: "q", value: "", hiddenFields: [] },
  types: [{ type: "cv", count: 2, on: true, href: "/documents" }],
  languages: [{ language: "de", count: 1, on: false, href: "/documents?type=cv&lang=de" }],
  clearHref: "/documents",
  total: 3,
  matching: 2,
  filtered: true,
};

const sorting = {
  [DocumentSort.Title]: { href: "/documents?sort=title", direction: null },
  [DocumentSort.Type]: { href: "/documents?sort=type", direction: null },
  [DocumentSort.Language]: { href: "/documents?sort=language", direction: null },
  [DocumentSort.Uploaded]: { href: "/documents?dir=asc", direction: SortDirection.Descending },
} satisfies Record<DocumentSort, SortLink>;

function renderList(
  documents: Document[],
  overrides: {
    controls?: DocumentListControls | null;
    nothingMatches?: boolean;
    showMoreHref?: string;
  } = {},
) {
  const actions = {
    upload: vi.fn<DocumentListActions["upload"]>(() => Promise.resolve({ failure: null })),
    addVersion: vi.fn<DocumentListActions["addVersion"]>(() => Promise.resolve({ failure: null })),
    rename: vi.fn<DocumentListActions["rename"]>(() => Promise.resolve(true)),
    delete: vi.fn<DocumentListActions["delete"]>(() => Promise.resolve()),
  };
  render(
    <DocumentList
      documents={documents}
      controls={overrides.controls ?? null}
      sorting={sorting}
      nothingMatches={overrides.nothingMatches ?? false}
      showMoreHref={overrides.showMoreHref ?? null}
      fileHref={(versionId) => `/files/${versionId}`}
      fileOpenHref={(versionId) => `/files/${versionId}?open`}
      timeZone={timeZone}
      actions={actions}
    />,
  );
  return { actions, user: userEvent.setup() };
}

function row(title: string) {
  return screen.getByRole("row", { name: new RegExp(`^${t.open(title, null).split(" (")[0]}`) });
}

function iconButton(action: string, title: string) {
  return screen.getByRole("button", { name: t.actions.label(action, title) });
}

describe("DocumentList", () => {
  it("says what to do when there is no document yet", () => {
    renderList([]);

    expect(screen.getByRole("heading", { name: t.empty.title })).toBeInTheDocument();
    expect(screen.getByText(t.empty.description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.upload })).toBeInTheDocument();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says when the search and filters let nothing through", () => {
    renderList([], { controls, nothingMatches: true });

    expect(screen.getByRole("heading", { name: t.nothingMatches.title })).toBeInTheDocument();
  });

  it("shows the search, the count, and the type and language chips with their counts", () => {
    renderList([aDocument()], { controls });

    expect(screen.getByRole("searchbox", { name: t.search.label })).toHaveAttribute(
      "placeholder",
      t.search.placeholder,
    );
    expect(screen.getByText(t.countFiltered(2, 3))).toBeInTheDocument();
    const filters = within(screen.getByRole("group", { name: t.filters.label }));
    expect(filters.getByRole("button", { name: `${t.type.cv} 2` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(filters.getByRole("button", { name: `${t.language.de} 1` })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("link", { name: t.filters.clear })).toHaveAttribute(
      "href",
      "/documents",
    );
  });

  it("orders by the column headers, the version column excepted", () => {
    renderList([aDocument()]);

    const uploaded = screen.getByRole("columnheader", { name: new RegExp(t.columns.uploaded) });
    expect(uploaded).toHaveAttribute("aria-sort", "descending");
    expect(
      within(screen.getByRole("columnheader", { name: t.columns.document })).getByRole("link"),
    ).toHaveAttribute("href", "/documents?sort=title");
    expect(
      within(screen.getByRole("columnheader", { name: t.columns.version })).queryByRole("link"),
    ).toBeNull();
  });

  it("names a document by title, file, format and size, type, language and upload day", () => {
    renderList([
      aDocument({
        title: "MSc in Computer Science",
        type: "diploma",
        language: "de",
        versions: [aVersion({ fileName: "msc.pdf", uploadedAt: new Date("2026-09-30T23:30:00Z") })],
      }),
    ]);

    const diploma = within(row("MSc in Computer Science"));
    expect(diploma.getByText("msc.pdf")).toBeInTheDocument();
    expect(diploma.getByText(t.fileSummary("PDF", "240 kB"))).toBeInTheDocument();
    expect(diploma.getByText(t.type.diploma)).toBeInTheDocument();
    expect(diploma.getByText(t.language.de)).toBeInTheDocument();
    // Berlin's day, not UTC's.
    expect(diploma.getByText("1 Oct 2026")).toBeInTheDocument();
  });

  it("opens a single file in a new tab from the whole row, with no version select", () => {
    renderList([aDocument({ title: "CV" })]);

    const open = screen.getByRole("link", { name: t.open("CV", null) });
    expect(open).toHaveAttribute("href", "/files/00000000-0000-4000-8000-0000000000e1?open");
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener");
    expect(screen.queryByRole("combobox", { name: t.versions.select("CV") })).toBeNull();
    expect(
      screen.getByRole("link", { name: t.actions.label(t.actions.download, "CV") }),
    ).toHaveAttribute("href", "/files/00000000-0000-4000-8000-0000000000e1");
  });

  it("offers a select for a single labelled file", () => {
    renderList([aDocument({ title: "CV", versions: [aVersion({ label: "short" })] })]);

    expect(screen.getByRole("combobox", { name: t.versions.select("CV") })).toHaveDisplayValue(
      "short",
    );
    expect(screen.getByRole("link", { name: t.open("CV", "short") })).toBeInTheDocument();
  });

  it("lists versions newest first, the unlabelled first file as the original, and follows the pick", async () => {
    const { user } = renderList([aDocument({ title: "CV", versions: [revised, original] })]);

    const select = screen.getByRole("combobox", { name: t.versions.select("CV") });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["backend-heavy", t.versions.original]);
    expect(select).toHaveDisplayValue("backend-heavy");
    expect(screen.getByRole("link", { name: t.open("CV", "backend-heavy") })).toHaveAttribute(
      "href",
      "/files/v2?open",
    );

    await user.selectOptions(select, t.versions.original);

    const cv = within(row("CV"));
    expect(screen.getByRole("link", { name: t.open("CV", t.versions.original) })).toHaveAttribute(
      "href",
      "/files/v1?open",
    );
    expect(cv.getByText("cv-2025.pdf")).toBeInTheDocument();
    expect(cv.getByText("1 Sept 2026")).toBeInTheDocument();
    expect(
      cv.getByRole("link", { name: t.actions.label(t.actions.download, "CV") }),
    ).toHaveAttribute("href", "/files/v1");
  });

  it("numbers later unlabelled versions", () => {
    renderList([
      aDocument({ title: "CV", versions: [aVersion({ id: "v2" }), aVersion({ id: "v1" })] }),
    ]);

    expect(
      within(screen.getByRole("combobox", { name: t.versions.select("CV") }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([t.versions.numbered(2), t.versions.original]);
  });

  it("offers more when more documents match than are shown", () => {
    renderList([aDocument()], { controls, showMoreHref: "/documents?shown=40" });

    expect(screen.getByRole("link", { name: t.showMore })).toHaveAttribute(
      "href",
      "/documents?shown=40",
    );
  });

  it("adds a version through a form that asks for the file and its label only", async () => {
    const { actions, user } = renderList([aDocument({ id: "d1", title: "CV" })]);

    await user.click(iconButton(t.actions.addVersion, "CV"));
    const dialog = screen.getByRole("dialog", { name: t.versionDialog.title("CV") });
    expect(within(dialog).queryByRole("textbox", { name: t.form.title })).toBeNull();
    await user.upload(within(dialog).getByLabelText(t.form.file), new File(["%PDF-"], "cv-v2.pdf"));
    await user.click(within(dialog).getByRole("button", { name: t.form.submit }));

    expect(actions.addVersion).toHaveBeenCalledExactlyOnceWith("d1", expect.any(FormData));
  });

  it("renames a document, and refuses a blank title", async () => {
    const { actions, user } = renderList([aDocument({ id: "d1", title: "CV" })]);

    await user.click(iconButton(t.actions.rename, "CV"));
    const title = screen.getByRole("textbox", { name: t.form.title });
    expect(title).toHaveValue("CV");
    await user.clear(title);
    await user.click(screen.getByRole("button", { name: t.renameDialog.submit }));
    expect(title).toHaveAccessibleDescription(t.renameDialog.rejected);
    expect(actions.rename).not.toHaveBeenCalled();

    await user.type(title, "CV, German");
    await user.click(screen.getByRole("button", { name: t.renameDialog.submit }));

    expect(actions.rename).toHaveBeenCalledExactlyOnceWith("d1", "CV, German");
  });

  it.each([
    ["with versions, naming how many go with it", [revised, original], 2],
    ["without versions, naming none", [original], null],
  ])("deletes a document %s, once confirmed", async (_, versions, count) => {
    const { actions, user } = renderList([aDocument({ id: "d1", title: "CV", versions })]);

    await user.click(iconButton(t.actions.delete, "CV"));
    const confirm = screen.getByRole("alertdialog", { name: t.deleteDialog.title });
    expect(confirm).toHaveTextContent(t.deleteDialog.description("CV", count));
    await user.click(within(confirm).getByRole("button", { name: t.deleteDialog.confirm }));

    expect(actions.delete).toHaveBeenCalledExactlyOnceWith("d1");
  });
});
