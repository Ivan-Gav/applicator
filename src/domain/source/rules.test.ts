import { describe, expect, it } from "vitest";
import { channels } from "@/domain/application/model";
import { knownSources } from "./known-sources";
import { cleanSource, sourceKey, suggestSources } from "./rules";

describe("cleanSource", () => {
  it("removes surrounding whitespace and makes each run inside one space", () => {
    expect(cleanSource("  Welcome   to\tthe \n Jungle ")).toBe("Welcome to the Jungle");
  });

  it("keeps case, punctuation and spelling as typed", () => {
    expect(cleanSource("linked In")).toBe("linked In");
    expect(cleanSource("HH.ru")).toBe("HH.ru");
  });
});

describe("sourceKey", () => {
  it("gives spellings differing in case or whitespace one key", () => {
    expect(new Set(["LinkedIn", "linkedin", "Linked In", " LINKED  IN "].map(sourceKey))).toEqual(
      new Set(["linkedin"]),
    );
  });

  it("keeps punctuation apart", () => {
    expect(sourceKey("hh.ru")).not.toBe(sourceKey("hh ru"));
  });
});

describe("suggestSources", () => {
  const known = ["LinkedIn", "Indeed", "Welcome to the Jungle", "hh.ru", "hh.ge"];

  it("surfaces the existing spelling for a search typed in another case or spacing", () => {
    expect(suggestSources(known, [], "linkedin", 8)).toEqual(["LinkedIn"]);
    expect(suggestSources(known, [], "Linked In", 8)).toEqual(["LinkedIn"]);
  });

  it("finds a search anywhere in the name, exact first, then names starting with it", () => {
    expect(suggestSources(["Jungle Jobs", "Jungle", ...known], [], "jungle", 8)).toEqual([
      "Jungle",
      "Jungle Jobs",
      "Welcome to the Jungle",
    ]);
  });

  it("puts the user's own sources first at equal match, then alphabetically", () => {
    expect(suggestSources(known, ["Hacker News", "hh.de"], "h", 8)).toEqual([
      "Hacker News",
      "hh.de",
      "hh.ge",
      "hh.ru",
      "Welcome to the Jungle",
    ]);
  });

  it("suggests one spelling per source, the user's own over the known one", () => {
    expect(suggestSources(known, ["linkedin", "Linked In"], "link", 8)).toEqual(["linkedin"]);
  });

  it("lists every known source in its own order for a blank search, the user's own and the limit aside", () => {
    expect(suggestSources(known, ["Meetup"], "  ", 2)).toEqual(known);
  });

  it("suggests at most `limit` sources", () => {
    expect(suggestSources(known, [], "e", 2)).toHaveLength(2);
  });
});

describe("knownSources", () => {
  it("names every source once, whatever the spelling", () => {
    const keys = knownSources.map(sourceKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("holds places a job is found, not how an application was routed", () => {
    const keys = new Set(knownSources.map(sourceKey));

    expect(channels.filter((channel) => keys.has(sourceKey(channel)))).toEqual([]);
  });

  it("holds sources already cleaned, so picking one stores it unchanged", () => {
    expect(knownSources.filter((source) => cleanSource(source) !== source)).toEqual([]);
  });
});
