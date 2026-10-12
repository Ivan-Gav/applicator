import { describe, expect, it } from "vitest";
import type { City } from "./model";
import type { CityMatch } from "./model";
import { alternateNameMatches, cityIndex, placeDetails, searchCities } from "./search";

function aCity(overrides: Partial<City> & Pick<City, "id" | "name">): City {
  return {
    countryCode: "DE",
    country: "Germany",
    region: null,
    district: null,
    population: 10_000,
    alternateNames: [],
    ...overrides,
  };
}

const munich = aCity({
  id: 1,
  name: "Munich",
  region: "Bavaria",
  population: 1_260_000,
  alternateNames: ["Munchen", "München", "Muenchen", "Monaco di Baviera", "Мюнхен"],
});
const cologne = aCity({
  id: 2,
  name: "Köln",
  region: "North Rhine-Westphalia",
  population: 1_024_000,
  alternateNames: ["Cologne", "Koeln"],
});
const muenster = aCity({ id: 3, name: "Münster", population: 315_000 });
const frankfurtMain = aCity({
  id: 4,
  name: "Frankfurt am Main",
  region: "Hesse",
  population: 650_000,
  alternateNames: ["Frankfurt"],
});
const frankfurtOder = aCity({
  id: 5,
  name: "Frankfurt (Oder)",
  region: "Brandenburg",
  population: 57_000,
  alternateNames: ["Frankfurt"],
});
const brestFrance = aCity({
  id: 6,
  name: "Brest",
  countryCode: "FR",
  country: "France",
  region: "Brittany",
  population: 140_000,
});
const brestBelarus = aCity({
  id: 7,
  name: "Brest",
  countryCode: "BY",
  country: "Belarus",
  region: "Brest Region",
  population: 340_000,
});
const walldorfBaden = aCity({
  id: 8,
  name: "Walldorf",
  region: "Baden-Württemberg",
  population: 14_800,
});
const walldorfThuringia = aCity({
  id: 9,
  name: "Walldorf",
  region: "Thuringia",
  population: 2_300,
});
const neustadtWeinstrasse = aCity({
  id: 10,
  name: "Neustadt an der Weinstraße",
  region: "Rhineland-Palatinate",
  population: 54_000,
  alternateNames: ["Neustadt"],
});
// Goes by "Neustadt" too, its historical German name.
const baiaMare = aCity({
  id: 11,
  name: "Baia Mare",
  countryCode: "RO",
  country: "Romania",
  population: 123_000,
  alternateNames: ["Neustadt", "Frauenbach"],
});

const index = cityIndex([
  munich,
  cologne,
  muenster,
  frankfurtMain,
  frankfurtOder,
  brestFrance,
  brestBelarus,
  walldorfBaden,
  walldorfThuringia,
  neustadtWeinstrasse,
  baiaMare,
]);

const limit = 10;

function namesFound(search: string) {
  return searchCities(index, search, limit).map(({ id }) => id);
}

describe("searchCities", () => {
  it("finds a city by its German and its English name, as the one canonical entry", () => {
    expect(searchCities(index, "München", limit)).toEqual([
      {
        id: munich.id,
        name: "Munich",
        country: "Germany",
        region: "Bavaria",
        district: null,
        matchedName: "München",
      },
    ]);
    expect(searchCities(index, "Munich", limit)).toEqual([
      expect.objectContaining({ id: munich.id, name: "Munich", matchedName: null }),
    ]);
    expect(namesFound("Cologne")).toEqual([cologne.id]);
    expect(namesFound("Köln")).toEqual([cologne.id]);
  });

  it("finds a city by its Cyrillic name", () => {
    expect(searchCities(index, "мюнх", limit)).toEqual([
      expect.objectContaining({ id: munich.id, name: "Munich", matchedName: "Мюнхен" }),
    ]);
  });

  it.each(["münchen", "MÜNCHEN", "munchen", "  Munchen "])(
    "ignores accents, case and outer spaces in %j",
    (search) => {
      expect(namesFound(search)).toEqual([munich.id]);
    },
  );

  it("keeps same-named cities of different countries apart", () => {
    expect(searchCities(index, "Brest", limit)).toEqual([
      expect.objectContaining({ id: brestBelarus.id, country: "Belarus" }),
      expect.objectContaining({ id: brestFrance.id, country: "France" }),
    ]);
  });

  it("puts exact names first, then names starting with the search, then words within, each by population", () => {
    // "Mün": Munich via "München" and Münster start with it; Munich is larger.
    expect(namesFound("mün")).toEqual([munich.id, muenster.id]);
    // "Frankfurt" is an exact alternate name of both, so the larger leads.
    expect(namesFound("frankfurt")).toEqual([frankfurtMain.id, frankfurtOder.id]);
    // A word inside the name: "Weinstraße", "Oder".
    expect(namesFound("weinstr")).toEqual([neustadtWeinstrasse.id]);
    expect(namesFound("oder")).toEqual([frankfurtOder.id]);
  });

  it("puts cities whose own name matches before those found by another name only", () => {
    // Baia Mare is larger, but only its historical name is "Neustadt".
    expect(namesFound("neustadt")).toEqual([neustadtWeinstrasse.id, baiaMare.id]);
  });

  it("reports the other name it was found by as typed, accents included", () => {
    expect(searchCities(index, "München", limit)[0]?.matchedName).toBe("München");
    expect(searchCities(index, "Munchen", limit)[0]?.matchedName).toBe("Munchen");
  });

  it("prefers the canonical name to report when it matches as well as an alternate", () => {
    expect(searchCities(index, "Köln", limit)[0]?.matchedName).toBeNull();
    expect(searchCities(index, "Koeln", limit)[0]?.matchedName).toBe("Koeln");
  });

  it("finds nothing for a name the list does not know, or a blank search", () => {
    expect(namesFound("Waldbronn")).toEqual([]);
    expect(namesFound("   ")).toEqual([]);
  });

  it("returns at most `limit` cities", () => {
    expect(searchCities(index, "m", 1)).toHaveLength(1);
  });
});

describe("alternateNameMatches", () => {
  it("finds a city stored by its canonical name by another of its names, from a word's start", () => {
    expect(alternateNameMatches(index, "Munich", "Germany", "мюнх")).toBe(true);
    expect(alternateNameMatches(index, "munich", "DE", "baviera")).toBe(true);
  });

  it("does not match inside a word", () => {
    expect(alternateNameMatches(index, "Munich", "Germany", "nchen")).toBe(false);
  });

  it("needs a country the list knows", () => {
    expect(alternateNameMatches(index, "Munich", null, "München")).toBe(false);
    expect(alternateNameMatches(index, "Munich", "Deutschland", "München")).toBe(false);
  });

  it("needs the city in that country", () => {
    expect(alternateNameMatches(index, "Munich", "France", "München")).toBe(false);
  });

  it("needs the city stored by its canonical name", () => {
    expect(alternateNameMatches(index, "München", "Germany", "Monaco")).toBe(false);
  });

  it("gives no other names to a name that several cities of the country share", () => {
    const twins = cityIndex([
      aCity({ id: 20, name: "Altdorf", region: "Bavaria", alternateNames: ["Alt"] }),
      aCity({ id: 21, name: "Altdorf", region: "Bavaria", alternateNames: ["Old"] }),
    ]);

    expect(alternateNameMatches(twins, "Altdorf", "Germany", "Old")).toBe(false);
  });
});

describe("placeDetails", () => {
  function aMatch(overrides: Partial<CityMatch> & Pick<CityMatch, "id">): CityMatch {
    return {
      name: "Altdorf",
      country: "Germany",
      region: "Bavaria",
      district: null,
      matchedName: null,
      ...overrides,
    };
  }

  it("gives region and country", () => {
    const match = aMatch({ id: 1, district: "Lower Bavaria" });

    expect(placeDetails(match, [match])).toEqual(["Bavaria", "Germany"]);
  });

  it("adds the district when another match shares name and region", () => {
    const lower = aMatch({ id: 1, district: "Lower Bavaria" });
    const middle = aMatch({ id: 2, district: "Middle Franconia" });

    expect(placeDetails(lower, [lower, middle])).toEqual(["Lower Bavaria", "Bavaria", "Germany"]);
  });

  it("leaves out what is unknown", () => {
    const match = aMatch({ id: 1, region: null });

    expect(placeDetails(match, [match])).toEqual(["Germany"]);
  });
});
