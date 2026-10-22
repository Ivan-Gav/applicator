import { documentsPath, documentsSearchParam, routes } from "@/app/routes";
import {
  type DocumentListQuery,
  type DocumentListView,
  DocumentSort,
  defaultDocumentListQuery,
  firstDocumentDirection,
  isDocumentListFiltered,
} from "@/domain/document/list";
import { documentLanguages, documentTypes } from "@/domain/document/model";
import { SortDirection } from "@/lib/sort-direction";
import type { DocumentListControls } from "@/ui/documents/DocumentList";
import type { SortLink } from "@/ui/SortableHead";

/**
 * Search, filters and counts for the list, each control's link built here.
 * Every link starts the list over at its first page. Null while there is no
 * document at all.
 */
export function documentListControls(
  query: DocumentListQuery,
  list: DocumentListView,
): DocumentListControls | null {
  if (list.total === 0) {
    return null;
  }
  const path = (changed: Partial<DocumentListQuery>) => documentsPath({ ...query, ...changed });
  // A value filtered on stays offered, so it can be switched off, even once no document holds it.
  const typeCounts = new Map(list.typeCounts.map(({ value, count }) => [value, count]));
  const languageCounts = new Map(list.languageCounts.map(({ value, count }) => [value, count]));

  return {
    search: {
      action: routes.documents,
      name: documentsSearchParam.search,
      value: query.search,
      hiddenFields: [...new URLSearchParams(path({ search: "" }).split("?")[1])],
    },
    types: documentTypes
      .filter((type) => typeCounts.has(type) || query.types.includes(type))
      .map((type) => ({
        type,
        count: typeCounts.get(type) ?? 0,
        on: query.types.includes(type),
        href: path({ types: toggled(documentTypes, query.types, type) }),
      })),
    languages: documentLanguages
      .filter((language) => languageCounts.has(language) || query.languages.includes(language))
      .map((language) => ({
        language,
        count: languageCounts.get(language) ?? 0,
        on: query.languages.includes(language),
        href: path({ languages: toggled(documentLanguages, query.languages, language) }),
      })),
    clearHref: isDocumentListFiltered(query)
      ? path({
          search: defaultDocumentListQuery.search,
          types: defaultDocumentListQuery.types,
          languages: defaultDocumentListQuery.languages,
        })
      : null,
    total: list.total,
    matching: list.matching,
    filtered: isDocumentListFiltered(query),
  };
}

/** Each sortable column's header link: the ordered column reverses, any other starts in its first direction. */
export function documentSortLinks(query: DocumentListQuery): Record<DocumentSort, SortLink> {
  const link = (sort: DocumentSort): SortLink => {
    const ordered = query.sort === sort;
    const direction = ordered ? reversed(query.direction) : firstDocumentDirection(sort);
    return {
      href: documentsPath({ ...query, sort, direction }),
      direction: ordered ? query.direction : null,
    };
  };
  return {
    [DocumentSort.Title]: link(DocumentSort.Title),
    [DocumentSort.Uploaded]: link(DocumentSort.Uploaded),
    [DocumentSort.Type]: link(DocumentSort.Type),
    [DocumentSort.Language]: link(DocumentSort.Language),
  };
}

// The chosen values with `value` switched, kept in list order.
function toggled<T extends string>(all: readonly T[], chosen: readonly T[], value: T): T[] {
  return all.filter((candidate) =>
    candidate === value ? !chosen.includes(value) : chosen.includes(candidate),
  );
}

function reversed(direction: SortDirection): SortDirection {
  return direction === SortDirection.Ascending ? SortDirection.Descending : SortDirection.Ascending;
}
