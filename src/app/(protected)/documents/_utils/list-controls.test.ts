import { describe, expect, it } from "vitest";
import { documentsPath, documentsSearchParam, routes } from "@/app/routes";
import {
  type DocumentListQuery,
  DocumentSort,
  defaultDocumentListQuery,
  documentListView,
} from "@/domain/document/list";
import { SortDirection } from "@/lib/sort-direction";
import { aDocument } from "@/test/document.fixture";
import { documentListControls, documentSortLinks } from "./list-controls";

const documents = [
  aDocument({ id: "a", type: "cv", language: "en" }),
  aDocument({ id: "b", type: "cv", language: "de" }),
  aDocument({ id: "c", type: "diploma", language: null }),
];

function controls(query: DocumentListQuery) {
  return documentListControls(query, documentListView(documents, query, 20));
}

describe("documentListControls", () => {
  it("offers nothing while there is no document", () => {
    expect(
      documentListControls(
        defaultDocumentListQuery,
        documentListView([], defaultDocumentListQuery, 20),
      ),
    ).toBeNull();
  });

  it("offers the types and languages the documents hold, counted, each switching itself", () => {
    const query = { ...defaultDocumentListQuery, types: ["cv"] as const };
    const result = controls(query);

    expect(result?.types).toEqual([
      { type: "cv", count: 2, on: true, href: documentsPath(defaultDocumentListQuery) },
      {
        type: "diploma",
        count: 1,
        on: false,
        href: documentsPath({ ...query, types: ["cv", "diploma"] }),
      },
    ]);
    expect(result?.languages.map(({ language, count }) => [language, count])).toEqual([
      ["en", 1],
      ["de", 1],
    ]);
  });

  it("keeps a filter that is on offered though no document holds its value", () => {
    const result = controls({ ...defaultDocumentListQuery, languages: ["ru"] });

    expect(result?.languages.at(-1)).toMatchObject({ language: "ru", count: 0, on: true });
  });

  it("clears search and filters but keeps the order, and searches keeping the rest", () => {
    const query = {
      ...defaultDocumentListQuery,
      search: "cv",
      types: ["cv"] as const,
      sort: DocumentSort.Type,
      direction: SortDirection.Ascending,
    };
    const result = controls(query);

    expect(result?.clearHref).toBe(
      documentsPath({ ...defaultDocumentListQuery, sort: query.sort, direction: query.direction }),
    );
    expect(result?.search).toMatchObject({
      action: routes.documents,
      name: documentsSearchParam.search,
      value: "cv",
    });
    expect(result?.search.hiddenFields).not.toContainEqual([documentsSearchParam.search, "cv"]);
    expect(result).toMatchObject({ total: 3, matching: 2, filtered: true });
  });
});

describe("documentSortLinks", () => {
  it("reverses the order it has, and starts any other in its first direction", () => {
    const query = { ...defaultDocumentListQuery, search: "cv" };
    const links = documentSortLinks(query);

    expect(links[DocumentSort.Uploaded]).toEqual({
      direction: SortDirection.Descending,
      href: documentsPath({ ...query, direction: SortDirection.Ascending }),
    });
    for (const sort of [DocumentSort.Title, DocumentSort.Type, DocumentSort.Language]) {
      expect(links[sort]).toEqual({
        direction: null,
        href: documentsPath({ ...query, sort, direction: SortDirection.Ascending }),
      });
    }
  });
});
