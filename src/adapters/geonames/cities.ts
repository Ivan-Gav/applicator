import { z } from "zod";
import type { City } from "@/domain/city/model";
import { type CityIndex, cityIndex } from "@/domain/city/search";
import extract from "./cities.json";

// The shape scripts/extract-cities.mts writes; `fields` names the tuple's parts.
const extractSchema = z.object({
  countries: z.record(z.string(), z.string()),
  regions: z.record(z.string(), z.string()),
  districts: z.record(z.string(), z.string()),
  cities: z.array(
    z.tuple([
      z.number(), // id
      z.string(), // name
      z.string(), // country code
      z.string(), // region code
      z.string(), // district code
      z.number(), // population
      z.string(), // alternate names, "|"-separated
    ]),
  ),
});

/** The cities of an extract, its codes replaced by the names they stand for. */
export function citiesOf(input: unknown): City[] {
  const { countries, regions, districts, cities } = extractSchema.parse(input);
  return cities.map(([id, name, countryCode, region, district, population, alternateNames]) => ({
    id,
    name,
    countryCode,
    country: countries[countryCode] ?? countryCode,
    region: regions[`${countryCode}.${region}`] ?? null,
    district: districts[`${countryCode}.${region}.${district}`] ?? null,
    population,
    alternateNames: alternateNames === "" ? [] : alternateNames.split("|"),
  }));
}

let index: CityIndex | undefined;

/** The reference list of cities, from the committed GeoNames extract; built on first use. */
export function geonamesCityIndex(): CityIndex {
  index ??= cityIndex(citiesOf(extract));
  return index;
}
