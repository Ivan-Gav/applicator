/** A place of the reference list. */
export type City = {
  id: number;
  /** The canonical name, the one a picked suggestion fills in. */
  name: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  /** The canonical country name, the one a picked suggestion fills in. */
  country: string;
  /** The first-order division, such as a German state. */
  region: string | null;
  /** The second-order division, where the country has one. */
  district: string | null;
  population: number;
  /** Other names the place goes by, most useful first; matched, never stored. */
  alternateNames: readonly string[];
};

/** A city found by a search, with what tells it apart from same-named ones. */
export type CityMatch = {
  id: number;
  name: string;
  country: string;
  region: string | null;
  district: string | null;
  /** The other name the search found it by; null when it was found by its own. */
  matchedName: string | null;
};
