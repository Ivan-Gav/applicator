/** Surrounding whitespace removed and each run of it inside made one space; case and spelling kept. */
export function cleanSource(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** What spellings of one source share: lowercase, without whitespace. "Linked In" becomes "linkedin". */
export function sourceKey(text: string): string {
  return text.toLocaleLowerCase("en").replace(/\s+/g, "");
}

// How well a key matches a query; lower is better.
const MatchQuality = {
  Exact: 0,
  StartsWith: 1,
  Contains: 2,
} as const;
type MatchQuality = (typeof MatchQuality)[keyof typeof MatchQuality];

function matchQuality(key: string, query: string): MatchQuality | null {
  if (key === query) {
    return MatchQuality.Exact;
  }
  if (key.startsWith(query)) {
    return MatchQuality.StartsWith;
  }
  return key.includes(query) ? MatchQuality.Contains : null;
}

type Candidate = { source: string; key: string; own: boolean };

/**
 * Sources containing the search, case and whitespace ignored: exact ones
 * first, then those starting with it, then the rest; within each, the user's
 * own before the known ones, then alphabetically. Spellings sharing a
 * sourceKey() are suggested once: the first of `used`, else the known one.
 * A blank search lists every known source in its own order, without `limit`.
 */
export function suggestSources(
  known: readonly string[],
  used: readonly string[],
  search: string,
  limit: number,
): string[] {
  const query = sourceKey(search);
  if (query === "") {
    return [...known];
  }
  const candidates = new Map<string, Candidate>();
  const offer = (source: string, own: boolean) => {
    const key = sourceKey(source);
    if (!candidates.has(key)) {
      candidates.set(key, { source, key, own });
    }
  };
  for (const source of used) {
    offer(source, true);
  }
  for (const source of known) {
    offer(source, false);
  }

  return [...candidates.values()]
    .flatMap((candidate) => {
      const quality = matchQuality(candidate.key, query);
      return quality === null ? [] : [{ ...candidate, quality }];
    })
    .sort(
      (a, b) =>
        a.quality - b.quality ||
        Number(b.own) - Number(a.own) ||
        a.source.localeCompare(b.source, undefined, { sensitivity: "base" }),
    )
    .slice(0, limit)
    .map(({ source }) => source);
}
