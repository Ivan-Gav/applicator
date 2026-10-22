import { normalizeForSearch } from "@/lib/normalize-for-search";
import { SortDirection } from "@/lib/sort-direction";
import {
  type Document,
  type DocumentLanguage,
  type DocumentType,
  documentLanguages,
  documentTypes,
} from "./model";
import { lastUploadedAt } from "./rules";

// What the list can be ordered by.
export const DocumentSort = {
  Title: "title",
  Uploaded: "uploaded",
  Type: "type",
  Language: "language",
} as const;
export type DocumentSort = (typeof DocumentSort)[keyof typeof DocumentSort];

/** Which documents to show, and in what order. */
export type DocumentListQuery = {
  /** Matched against titles, file names and version labels; blank matches everything. */
  search: string;
  /** Any of these; none means every type. */
  types: readonly DocumentType[];
  /** Any of these; none means every language. */
  languages: readonly DocumentLanguage[];
  sort: DocumentSort;
  direction: SortDirection;
};

export const defaultDocumentListQuery: DocumentListQuery = {
  search: "",
  types: [],
  languages: [],
  sort: DocumentSort.Uploaded,
  direction: SortDirection.Descending,
};

/** The direction a first pick of an order sorts in: the newest uploads first, anything else from the start. */
export function firstDocumentDirection(sort: DocumentSort): SortDirection {
  return sort === DocumentSort.Uploaded ? SortDirection.Descending : SortDirection.Ascending;
}

/** Whether the query narrows the list at all; the order does not count. */
export function isDocumentListFiltered(query: DocumentListQuery): boolean {
  return (
    normalizeForSearch(query.search) !== "" || query.types.length > 0 || query.languages.length > 0
  );
}

/**
 * In the title, or in the file name or label of any version, ignoring case,
 * accents and punctuation: "frontend dev" finds "FrontEnd-Dev.pdf".
 */
export function matchesDocumentSearch(document: Document, search: string): boolean {
  const wanted = normalizeForSearch(search);
  if (wanted === "") {
    return true;
  }
  const searchedTexts = [
    document.title,
    ...document.versions.flatMap((version) => [version.fileName, version.label ?? ""]),
  ];
  return searchedTexts.some((text) => normalizeForSearch(text).includes(wanted));
}

function passesFilters(document: Document, query: DocumentListQuery): boolean {
  return (
    matchesDocumentSearch(document, query.search) &&
    (query.types.length === 0 || query.types.includes(document.type)) &&
    (query.languages.length === 0 ||
      (document.language !== null && query.languages.includes(document.language)))
  );
}

/**
 * A sorted copy. Titles go alphabetically, ignoring case; types and languages
 * in list order; a document without a language sinks to the bottom in either
 * direction. Within one title, type or language, and for equal upload times,
 * the newest upload comes first.
 */
export function sortDocuments(
  documents: readonly Document[],
  sort: DocumentSort,
  direction: SortDirection,
): Document[] {
  const sign = direction === SortDirection.Ascending ? 1 : -1;
  const newestFirst = (a: Document, b: Document) =>
    lastUploadedAt(b).getTime() - lastUploadedAt(a).getTime();
  return documents.toSorted((a, b) => {
    switch (sort) {
      case DocumentSort.Title:
        return (
          sign * a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
          newestFirst(a, b)
        );
      case DocumentSort.Uploaded:
        return -sign * newestFirst(a, b);
      case DocumentSort.Type:
        return (
          sign * (documentTypes.indexOf(a.type) - documentTypes.indexOf(b.type)) ||
          newestFirst(a, b)
        );
      case DocumentSort.Language: {
        if (a.language === null || b.language === null) {
          return a.language === b.language ? newestFirst(a, b) : a.language === null ? 1 : -1;
        }
        return (
          sign * (documentLanguages.indexOf(a.language) - documentLanguages.indexOf(b.language)) ||
          newestFirst(a, b)
        );
      }
    }
  });
}

/** One value present among the documents, with how many hold it. */
export type Count<T> = { value: T; count: number };

/** What a page of the list needs to know. */
export type DocumentListView = {
  /** The first `limit` matching documents, in the query's order. */
  shown: Document[];
  /** Every document. */
  total: number;
  /** The documents the query lets through. */
  matching: number;
  /** In list order, only types some document holds, counted over every document. */
  typeCounts: Count<DocumentType>[];
  /** Likewise for languages. */
  languageCounts: Count<DocumentLanguage>[];
};

export function documentListView(
  documents: readonly Document[],
  query: DocumentListQuery,
  limit: number,
): DocumentListView {
  const matching = sortDocuments(
    documents.filter((document) => passesFilters(document, query)),
    query.sort,
    query.direction,
  );
  const countsOf = <T>(values: readonly T[], valueOf: (document: Document) => T | null) =>
    values
      .map((value) => ({
        value,
        count: documents.filter((document) => valueOf(document) === value).length,
      }))
      .filter(({ count }) => count > 0);
  return {
    shown: matching.slice(0, limit),
    total: documents.length,
    matching: matching.length,
    typeCounts: countsOf(documentTypes, (document) => document.type),
    languageCounts: countsOf(documentLanguages, (document) => document.language),
  };
}
