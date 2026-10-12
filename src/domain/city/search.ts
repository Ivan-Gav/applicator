import { normalizeForSearch } from "@/lib/normalize-for-search";
import type { City, CityMatch } from "./model";

type Entry = {
  city: City;
  /** The canonical name first, then the alternate names in the order the city has them. */
  names: readonly string[];
  /** `names` passed through normalizeForSearch(), in the same order. */
  normalizedNames: readonly string[];
};

/** The reference list, prepared for searching. */
export type CityIndex = {
  readonly entries: readonly Entry[];
  /** Every normalized canonical name to the cities it names. */
  readonly byOwnName: ReadonlyMap<string, readonly Entry[]>;
  /** Normalized country names and codes to the country code. */
  readonly countries: ReadonlyMap<string, string>;
};

export function cityIndex(cities: readonly City[]): CityIndex {
  const byOwnName = new Map<string, Entry[]>();
  const countries = new Map<string, string>();
  const entries = cities.map((city) => {
    const names = [city.name, ...city.alternateNames];
    const entry: Entry = { city, names, normalizedNames: names.map(normalizeForSearch) };
    const ownName = entry.normalizedNames[0] ?? "";
    const named = byOwnName.get(ownName);
    if (named) {
      named.push(entry);
    } else {
      byOwnName.set(ownName, [entry]);
    }
    countries.set(normalizeForSearch(city.country), city.countryCode);
    countries.set(normalizeForSearch(city.countryCode), city.countryCode);
    return entry;
  });
  return { entries, byOwnName, countries };
}

// How well a name matches a query; lower is better.
const MatchQuality = {
  Exact: 0,
  StartsWith: 1,
  WordStartsWith: 2,
} as const;
type MatchQuality = (typeof MatchQuality)[keyof typeof MatchQuality];

/** How well a normalized name matches a normalized query; null when it does not. */
function matchQuality(name: string, query: string): MatchQuality | null {
  if (name === query) {
    return MatchQuality.Exact;
  }
  if (name.startsWith(query)) {
    return MatchQuality.StartsWith;
  }
  return name.includes(` ${query}`) ? MatchQuality.WordStartsWith : null;
}

/** One name of a city that matches a query. */
type NameMatch = {
  /** The name's position in `Entry.names`. */
  index: number;
  quality: MatchQuality;
  /** Whether the name is written as typed, accents included. */
  writtenAsTyped: boolean;
};

/**
 * The name of `entry` that matches `query` best, or null when none does. At
 * equal quality the name written as typed wins, then the earlier name: the
 * city's own name, then its alternate names most useful first.
 */
function bestMatchingName(entry: Entry, query: string, queryAsTyped: string): NameMatch | null {
  // Every match contains the query; most cities have no such name at all.
  if (!entry.normalizedNames.some((name) => name.includes(query))) {
    return null;
  }
  const matches = entry.names
    .map((name, index) => ({
      index,
      quality: matchQuality(entry.normalizedNames[index] ?? "", query),
      writtenAsTyped: name.toLocaleLowerCase().includes(queryAsTyped),
    }))
    .filter((match): match is NameMatch => match.quality !== null);
  matches.sort(
    (a, b) =>
      a.quality - b.quality ||
      Number(b.writtenAsTyped) - Number(a.writtenAsTyped) ||
      a.index - b.index,
  );
  return matches[0] ?? null;
}

/**
 * Cities going by a name that is, or starts with, the search, or has a word
 * that does; accents and case do not matter. Exact names come first, then
 * names that start with the search, then the rest. Within each, cities whose
 * own name matches come before those found only by another name, which may be
 * a foreign or historical one; then the larger first.
 */
export function searchCities(index: CityIndex, search: string, limit: number): CityMatch[] {
  const query = normalizeForSearch(search);
  if (query === "") {
    return [];
  }
  // Accents kept, to report the name a city was found by as it was written.
  const queryAsTyped = search.trim().toLocaleLowerCase();

  const found = index.entries.flatMap((entry) => {
    const best = bestMatchingName(entry, query, queryAsTyped);
    if (best === null) {
      return [];
    }
    const ownNameMatches = matchQuality(entry.normalizedNames[0] ?? "", query) !== null;
    return [{ entry, best, ownNameMatches }];
  });

  return found
    .sort(
      (a, b) =>
        a.best.quality - b.best.quality ||
        Number(b.ownNameMatches) - Number(a.ownNameMatches) ||
        b.entry.city.population - a.entry.city.population ||
        a.entry.city.name.localeCompare(b.entry.city.name) ||
        a.entry.city.id - b.entry.city.id,
    )
    .slice(0, limit)
    .map(({ entry, best }) => {
      const foundByOwnName = entry.normalizedNames[best.index] === entry.normalizedNames[0];
      return {
        id: entry.city.id,
        name: entry.city.name,
        country: entry.city.country,
        region: entry.city.region,
        district: entry.city.district,
        matchedName: foundByOwnName ? null : (entry.names[best.index] ?? null),
      };
    });
}

/**
 * Whether the place stored as `city` in `country` goes by another name that
 * matches `search` from the start of a word, as in searchCities(). Only a city
 * stored by its canonical name, in a country the list knows, with no
 * same-named city there, has other names; for any other place this is false.
 */
export function alternateNameMatches(
  index: CityIndex,
  city: string,
  country: string | null,
  search: string,
): boolean {
  const query = normalizeForSearch(search);
  const countryCode =
    country === null ? undefined : index.countries.get(normalizeForSearch(country));
  if (query === "" || countryCode === undefined) {
    return false;
  }
  const sameName = (index.byOwnName.get(normalizeForSearch(city)) ?? []).filter(
    (entry) => entry.city.countryCode === countryCode,
  );
  const [only, ...others] = sameName;
  if (only === undefined || others.length > 0) {
    return false;
  }
  return only.normalizedNames.slice(1).some((name) => matchQuality(name, query) !== null);
}

/**
 * Where a match is, as much as tells it apart from the matches shown with it:
 * region and country, and the district too when another shares its name and region.
 */
export function placeDetails(match: CityMatch, shownWith: readonly CityMatch[]): string[] {
  const twin = shownWith.some(
    (other) => other !== match && other.name === match.name && other.region === match.region,
  );
  return [twin ? match.district : null, match.region, match.country].filter(
    (part): part is string => part !== null,
  );
}
