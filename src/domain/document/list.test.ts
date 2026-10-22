import { describe, expect, it } from "vitest";
import { SortDirection } from "@/lib/sort-direction";
import { aDocument, aVersion } from "@/test/document.fixture";
import {
  DocumentSort,
  defaultDocumentListQuery,
  documentListView,
  firstDocumentDirection,
  isDocumentListFiltered,
  matchesDocumentSearch,
  sortDocuments,
} from "./list";
import type { Document } from "./model";

const day = (date: string) => new Date(`${date}T09:00:00Z`);

function document(id: string, overrides: Partial<Document> & { uploaded?: string } = {}): Document {
  const { uploaded = "2026-09-01", ...rest } = overrides;
  return aDocument({
    id,
    title: id,
    versions: [aVersion({ id: `${id}-v`, uploadedAt: day(uploaded) })],
    ...rest,
  });
}

const ids = (documents: readonly Document[]) => documents.map((each) => each.id);

describe("matchesDocumentSearch", () => {
  const cv = aDocument({
    title: "Lebenslauf Frontend",
    versions: [
      aVersion({ fileName: "Ivan-Gavrilin-FrontEnd-Dev-DE-w-phone.pdf", label: "30.08.2026 DE" }),
      aVersion({ fileName: "résumé-2025.pdf", label: null }),
    ],
  });

  it.each([
    ["the title", "lebenslauf"],
    ["a file name, its punctuation read as spaces", "frontend dev"],
    ["the label of any version", "30 08 2026"],
    ["an older version's file name, without accents", "resume 2025"],
    ["nothing at all", "  "],
  ])("finds a document by %s", (_, search) => {
    expect(matchesDocumentSearch(cv, search)).toBe(true);
  });

  it("finds nothing that none of them holds", () => {
    expect(matchesDocumentSearch(cv, "backend")).toBe(false);
  });
});

describe("sortDocuments", () => {
  const older = document("older", { uploaded: "2026-08-01", type: "diploma", language: "ru" });
  const newer = document("newer", { uploaded: "2026-10-01", type: "cv", language: "en" });
  const middle = document("middle", { uploaded: "2026-09-01", type: "cv", language: null });

  it("orders by the newest upload, either way", () => {
    expect(
      ids(sortDocuments([older, newer, middle], DocumentSort.Uploaded, SortDirection.Descending)),
    ).toEqual(["newer", "middle", "older"]);
    expect(
      ids(sortDocuments([older, newer, middle], DocumentSort.Uploaded, SortDirection.Ascending)),
    ).toEqual(["older", "middle", "newer"]);
  });

  it("orders by type in list order, the newest first within a type", () => {
    expect(
      ids(sortDocuments([older, middle, newer], DocumentSort.Type, SortDirection.Ascending)),
    ).toEqual(["newer", "middle", "older"]);
    expect(
      ids(sortDocuments([older, middle, newer], DocumentSort.Type, SortDirection.Descending)),
    ).toEqual(["older", "newer", "middle"]);
  });

  it("orders by language in list order, without a language last either way", () => {
    expect(
      ids(sortDocuments([middle, older, newer], DocumentSort.Language, SortDirection.Ascending)),
    ).toEqual(["newer", "older", "middle"]);
    expect(
      ids(sortDocuments([middle, older, newer], DocumentSort.Language, SortDirection.Descending)),
    ).toEqual(["older", "newer", "middle"]);
  });

  it("orders by title alphabetically, ignoring case, either way", () => {
    const b = document("b", { title: "bayootec" });
    const a = document("a", { title: "Anschreiben" });
    const c = document("c", { title: "Curriculum" });

    expect(ids(sortDocuments([b, c, a], DocumentSort.Title, SortDirection.Ascending))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(ids(sortDocuments([b, c, a], DocumentSort.Title, SortDirection.Descending))).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts by the newest version, not the first", () => {
    const revised = aDocument({
      id: "revised",
      versions: [
        aVersion({ uploadedAt: day("2026-10-15") }),
        aVersion({ uploadedAt: day("2026-01-01") }),
      ],
    });

    expect(
      ids(sortDocuments([newer, revised], DocumentSort.Uploaded, SortDirection.Descending)),
    ).toEqual(["revised", "newer"]);
  });
});

describe("documentListView", () => {
  const documents = [
    document("cv-en", { type: "cv", language: "en", uploaded: "2026-10-01" }),
    document("cv-de", { type: "cv", language: "de", uploaded: "2026-09-01" }),
    document("letter-de", { type: "cover_letter", language: "de", uploaded: "2026-08-01" }),
    document("diploma", { type: "diploma", language: null, uploaded: "2026-07-01" }),
  ];

  it("filters by any of the chosen types and any of the chosen languages, together", () => {
    const view = documentListView(
      documents,
      { ...defaultDocumentListQuery, types: ["cv", "cover_letter"], languages: ["de"] },
      20,
    );

    expect(ids(view.shown)).toEqual(["cv-de", "letter-de"]);
    expect(view.matching).toBe(2);
    expect(view.total).toBe(4);
  });

  it("counts types and languages over every document, in list order, leaving out the absent", () => {
    const view = documentListView(documents, { ...defaultDocumentListQuery, search: "cv" }, 20);

    expect(view.typeCounts).toEqual([
      { value: "cv", count: 2 },
      { value: "cover_letter", count: 1 },
      { value: "diploma", count: 1 },
    ]);
    expect(view.languageCounts).toEqual([
      { value: "en", count: 1 },
      { value: "de", count: 2 },
    ]);
  });

  it("shows at most `limit` of the matching documents", () => {
    const view = documentListView(documents, defaultDocumentListQuery, 2);

    expect(ids(view.shown)).toEqual(["cv-en", "cv-de"]);
    expect(view.matching).toBe(4);
  });
});

describe("isDocumentListFiltered and firstDocumentDirection", () => {
  it("count search and filters, not the order", () => {
    expect(isDocumentListFiltered(defaultDocumentListQuery)).toBe(false);
    expect(isDocumentListFiltered({ ...defaultDocumentListQuery, search: " " })).toBe(false);
    expect(
      isDocumentListFiltered({ ...defaultDocumentListQuery, sort: DocumentSort.Language }),
    ).toBe(false);
    expect(isDocumentListFiltered({ ...defaultDocumentListQuery, languages: ["ru"] })).toBe(true);
  });

  it("start dates newest first and everything else from the start", () => {
    expect(firstDocumentDirection(DocumentSort.Uploaded)).toBe(SortDirection.Descending);
    expect(firstDocumentDirection(DocumentSort.Title)).toBe(SortDirection.Ascending);
    expect(firstDocumentDirection(DocumentSort.Type)).toBe(SortDirection.Ascending);
    expect(firstDocumentDirection(DocumentSort.Language)).toBe(SortDirection.Ascending);
  });
});
