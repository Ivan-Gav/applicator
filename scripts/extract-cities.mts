/**
 * Builds src/adapters/geonames/cities.json, the reference list behind the city
 * suggestions, from the GeoNames dump. Run by hand when the data needs refreshing; it
 * is not part of the build:
 *
 *   npm run data:cities
 *
 * Source: GeoNames geographical database, https://www.geonames.org/, files from
 * https://download.geonames.org/export/dump/ (cities500.zip, countryInfo.txt,
 * admin1CodesASCII.txt, admin2Codes.txt, and alternatenames/<country>.zip for
 * each country in scope).
 * Licence: Creative Commons Attribution 4.0, https://creativecommons.org/licenses/by/4.0/.
 * The app credits GeoNames in its footer (messages.footer.placeData).
 */
import { writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const dumpUrl = "https://download.geonames.org/export/dump/";
const outputFile = new URL("../src/adapters/geonames/cities.json", import.meta.url);

/** Countries in scope, by ISO 3166-1 alpha-2 code. */
const countries = [
  // Europe
  "AD", // Andorra
  "AL", // Albania
  "AT", // Austria
  "AX", // Åland Islands
  "BA", // Bosnia and Herzegovina
  "BE", // Belgium
  "BG", // Bulgaria
  "BY", // Belarus
  "CH", // Switzerland
  "CY", // Cyprus
  "CZ", // Czechia
  "DE", // Germany
  "DK", // Denmark
  "EE", // Estonia
  "ES", // Spain
  "FI", // Finland
  "FO", // Faroe Islands
  "FR", // France
  "GB", // United Kingdom
  "GG", // Guernsey
  "GI", // Gibraltar
  "GR", // Greece
  "HR", // Croatia
  "HU", // Hungary
  "IE", // Ireland
  "IM", // Isle of Man
  "IS", // Iceland
  "IT", // Italy
  "JE", // Jersey
  "LI", // Liechtenstein
  "LT", // Lithuania
  "LU", // Luxembourg
  "LV", // Latvia
  "MC", // Monaco
  "MD", // Moldova
  "ME", // Montenegro
  "MK", // North Macedonia
  "MT", // Malta
  "NL", // Netherlands
  "NO", // Norway
  "PL", // Poland
  "PT", // Portugal
  "RO", // Romania
  "RS", // Serbia
  "SE", // Sweden
  "SI", // Slovenia
  "SK", // Slovakia
  "SM", // San Marino
  "UA", // Ukraine
  "VA", // Vatican City
  "XK", // Kosovo
  // Beyond Europe
  "AE", // United Arab Emirates
  "AM", // Armenia
  "GE", // Georgia
  "KZ", // Kazakhstan
  "RU", // Russia
];

/** Fewest inhabitants a place needs to be listed, by country. */
const defaultMinPopulation = 100_000;
const minPopulation: Record<string, number> = {
  // Where the applications go: deep enough for the small towns in real postings.
  DE: 1_000,
  AT: 1_000,
  CH: 1_000,
};

/** Listed whatever their population: capitals and seats of first-order divisions. */
const alwaysListedFeatures = new Set(["PPLC", "PPLG", "PPLA"]);
/** Populated places that are not towns: city districts, and historical, abandoned or destroyed places. */
const excludedFeatures = new Set(["PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"]);

/** Alternate names are kept in these languages everywhere, besides each country's own. */
const everywhereLanguages = ["en", "de", "ru"];

// A name as people write it: wholly Latin or wholly Cyrillic, starting with a
// capital. This drops lowercase romanisations of other scripts ("mwnkh") and
// every other script.
const writtenName =
  /^(\p{Lu}[\p{Script=Latin}\p{M}\s.'’()-]*|\p{Lu}[\p{Script=Cyrillic}\p{M}\s.'’()-]*)$/u;

type AlternateName = { name: string; rank: number };

type CityRecord = [
  id: number,
  name: string,
  country: string,
  region: string,
  district: string,
  population: number,
  alternateNames: string,
];

async function download(file: string): Promise<Buffer> {
  const response = await fetch(dumpUrl + file);
  if (!response.ok) {
    throw new Error(`${dumpUrl + file} answered ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** The file named `fileName` in a zip. */
function unzip(zip: Buffer, fileName: string): Buffer {
  const endOfDirectory = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const entries = zip.readUInt16LE(endOfDirectory + 10);
  let entry = zip.readUInt32LE(endOfDirectory + 16);
  for (let index = 0; index < entries; index++) {
    const nameLength = zip.readUInt16LE(entry + 28);
    if (zip.toString("utf8", entry + 46, entry + 46 + nameLength) === fileName) {
      const method = zip.readUInt16LE(entry + 10);
      const compressedSize = zip.readUInt32LE(entry + 20);
      const localHeader = zip.readUInt32LE(entry + 42);
      const dataStart =
        localHeader + 30 + zip.readUInt16LE(localHeader + 26) + zip.readUInt16LE(localHeader + 28);
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      // 0 is stored, 8 is deflate; GeoNames uses deflate.
      return method === 0 ? data : inflateRawSync(data);
    }
    entry += 46 + nameLength + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32);
  }
  throw new Error(`${fileName} is not in the zip`);
}

function rows(text: string): string[][] {
  return text
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

function namesByCode(text: string): Record<string, string> {
  return Object.fromEntries(rows(text).map(([key = "", name = ""]) => [key, name]));
}

function isListed(featureCode: string, country: string, population: number): boolean {
  if (excludedFeatures.has(featureCode)) {
    return false;
  }
  return (
    alwaysListedFeatures.has(featureCode) ||
    population >= (minPopulation[country] ?? defaultMinPopulation)
  );
}

/** A country's own languages, from countryInfo.txt: "de-CH,fr-CH" gives de and fr. */
function languagesOf(countryInfoLanguages: string): string[] {
  return countryInfoLanguages
    .split(",")
    .map((language) => language.split("-")[0] ?? "")
    .filter((language) => language !== "");
}

/**
 * How useful an alternate name is, lower first; null for one not kept. Kept:
 * names in an everywhere language or the country's own, and unlabelled ones,
 * which are spelling variants ("Nuernberg"). Dropped: other languages and
 * dialects ("Nürnbarg" is Low German), and colloquial names. Historic ones
 * stay: GeoNames flags them unevenly, and some are still in use ("Алма-Ата").
 */
function rankOf(row: readonly string[], ownLanguages: readonly string[]): number | null {
  const [, , language = "", name = "", preferred, , colloquial] = row;
  if (colloquial === "1" || !writtenName.test(name)) {
    return null;
  }
  const everywhere = everywhereLanguages.indexOf(language);
  const languageRank =
    everywhere !== -1
      ? everywhere
      : ownLanguages.includes(language)
        ? everywhereLanguages.length
        : language === ""
          ? everywhereLanguages.length + 1
          : null;
  if (languageRank === null) {
    return null;
  }
  // A preferred name, in any kept language, comes before every other.
  return (preferred === "1" ? 0 : everywhereLanguages.length + 2) + languageRank;
}

/** Alternate names, most useful first, each once, without the city's own name. */
function alternateNamesOf(name: string, alternates: readonly AlternateName[]): string {
  const seen = new Set([name.toLocaleLowerCase()]);
  const kept: string[] = [];
  for (const alternate of alternates.toSorted((a, b) => a.rank - b.rank)) {
    const key = alternate.name.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(alternate.name);
    }
  }
  return kept.join("|");
}

/** The alternate-names file of every country in scope, by country, a few downloads at a time. */
async function alternateNameFiles(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const atOnce = 8;
  for (let start = 0; start < countries.length; start += atOnce) {
    const batch = countries.slice(start, start + atOnce);
    const zips = await Promise.all(
      batch.map((country) => download(`alternatenames/${country}.zip`)),
    );
    for (const [index, country] of batch.entries()) {
      const zip = zips[index];
      if (zip) {
        files.set(country, unzip(zip, `${country}.txt`).toString("utf8"));
      }
    }
  }
  return files;
}

async function main() {
  const inScope = new Set(countries);
  const [citiesZip, countryInfo, admin1, admin2, alternateFiles] = await Promise.all([
    download("cities500.zip"),
    download("countryInfo.txt"),
    download("admin1CodesASCII.txt"),
    download("admin2Codes.txt"),
    alternateNameFiles(),
  ]);
  const countryInfoRows = rows(countryInfo.toString("utf8")).filter(([iso = ""]) =>
    inScope.has(iso),
  );

  const listed = new Map<number, { row: string[]; alternates: AlternateName[] }>();
  for (const row of rows(unzip(citiesZip, "cities500.txt").toString("utf8"))) {
    const [id, , , , , , featureClass, featureCode = "", country = ""] = row;
    const population = Number(row[14] ?? "0");
    if (
      featureClass === "P" &&
      inScope.has(country) &&
      isListed(featureCode, country, population)
    ) {
      listed.set(Number(id), { row, alternates: [] });
    }
  }
  for (const [country, file] of alternateFiles) {
    const ownLanguages = languagesOf(countryInfoRows.find(([iso]) => iso === country)?.[15] ?? "");
    for (const row of rows(file)) {
      const city = listed.get(Number(row[1]));
      const rank = city ? rankOf(row, ownLanguages) : null;
      if (city && rank !== null) {
        city.alternates.push({ name: row[3] ?? "", rank });
      }
    }
  }

  const cities: CityRecord[] = [...listed.values()].map(({ row, alternates }) => {
    const [id, name = "", , , , , , , country = ""] = row;
    const [region = "", district = "", , , population = "0"] = row.slice(10);
    return [
      Number(id),
      name,
      country,
      region,
      district,
      Number(population),
      alternateNamesOf(name, alternates),
    ];
  });
  cities.sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1], "en") || a[0] - b[0]);

  const countryNames = Object.fromEntries(
    countryInfoRows.map(([iso = "", , , , name = ""]) => [iso, name] as const),
  );
  const usedRegions = new Set(cities.map(([, , country, region]) => `${country}.${region}`));
  const usedDistricts = new Set(
    cities.map(([, , country, region, district]) => `${country}.${region}.${district}`),
  );
  const regions = Object.fromEntries(
    Object.entries(namesByCode(admin1.toString("utf8"))).filter(([key]) => usedRegions.has(key)),
  );
  const districts = Object.fromEntries(
    Object.entries(namesByCode(admin2.toString("utf8"))).filter(([key]) => usedDistricts.has(key)),
  );

  // One city per line, so that a refresh reads as a diff of the places it changed.
  const json = [
    "{",
    `"source": ${JSON.stringify({
      name: "GeoNames",
      url: "https://www.geonames.org/",
      licence: "CC BY 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      extractedOn: new Date().toISOString().slice(0, 10),
    })},`,
    `"countries": ${JSON.stringify(countryNames)},`,
    `"regions": ${JSON.stringify(regions)},`,
    `"districts": ${JSON.stringify(districts)},`,
    `"fields": ["id", "name", "country", "region", "district", "population", "alternateNames"],`,
    `"cities": [`,
    cities.map((city) => JSON.stringify(city)).join(",\n"),
    "]",
    "}",
    "",
  ].join("\n");
  writeFileSync(outputFile, json);

  console.log(`${cities.length} cities, ${(Buffer.byteLength(json) / 1024).toFixed(0)} KiB`);
}

await main();
