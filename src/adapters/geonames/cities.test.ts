import { describe, expect, it } from "vitest";
import { searchCities } from "@/domain/city/search";
import { citiesOf, geonamesCityIndex } from "./cities";

describe("citiesOf", () => {
  it("replaces the extract's codes with the names they stand for", () => {
    expect(
      citiesOf({
        countries: { DE: "Germany" },
        regions: { "DE.02": "Bavaria" },
        districts: { "DE.02.091": "Upper Bavaria" },
        cities: [
          [2867714, "Munich", "DE", "02", "091", 1505005, "München|Muenchen"],
          [2814668, "Walldorf", "DE", "15", "00", 2281, ""],
        ],
      }),
    ).toEqual([
      {
        id: 2867714,
        name: "Munich",
        countryCode: "DE",
        country: "Germany",
        region: "Bavaria",
        district: "Upper Bavaria",
        population: 1505005,
        alternateNames: ["München", "Muenchen"],
      },
      {
        id: 2814668,
        name: "Walldorf",
        countryCode: "DE",
        country: "Germany",
        region: null,
        district: null,
        population: 2281,
        alternateNames: [],
      },
    ]);
  });

  it("refuses an extract of another shape", () => {
    expect(() => citiesOf({ cities: [["Munich"]] })).toThrow();
  });
});

describe("the committed extract", () => {
  const index = geonamesCityIndex();

  it.each([
    ["Herzogenaurach", "Bavaria"],
    ["Unterföhring", "Bavaria"],
    ["Oberkochen", "Baden-Wurttemberg"],
    ["Künzelsau", "Baden-Wurttemberg"],
    ["Hagenberg im Mühlkreis", "Upper Austria"],
  ])("knows the small town %s", (name, region) => {
    expect(searchCities(index, name, 8)[0]).toMatchObject({ name, region });
  });

  it.each([
    ["Мюнхен", "Munich"],
    ["Кёльн", "Köln"],
    ["Вена", "Vienna"],
    ["Алма-Ата", "Almaty"],
  ])("finds a city by its Cyrillic name %s", (search, name) => {
    expect(searchCities(index, search, 8)[0]).toMatchObject({ name, matchedName: search });
  });

  it("reports the German name, not a dialect one, for a city found by its beginning", () => {
    expect(searchCities(index, "Nürn", 8)[0]).toMatchObject({
      name: "Nuremberg",
      matchedName: "Nürnberg",
    });
  });

  it("finds Munich first by its German name", () => {
    expect(searchCities(index, "München", 8)[0]).toMatchObject({
      name: "Munich",
      country: "Germany",
    });
  });
});
