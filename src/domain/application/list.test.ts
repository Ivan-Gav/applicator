import { describe, expect, it } from "vitest";
import { cityIndex } from "@/domain/city/search";
import { anApplication } from "@/test/application.fixture";
import {
  ApplicationSort,
  applicationFilter,
  applicationListView,
  defaultListQuery,
  firstDirection,
  isFiltered,
  longWaitDays,
  matchesSearch,
  SortDirection,
  sortApplications,
  waitsLong,
} from "./list";
import type { Application } from "./model";

const now = new Date("2026-10-06T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const cities = cityIndex([
  {
    id: 1,
    name: "Munich",
    countryCode: "DE",
    country: "Germany",
    region: "Bavaria",
    district: null,
    population: 1_260_000,
    alternateNames: ["München", "Мюнхен"],
  },
]);

function companies(applications: readonly Application[]) {
  return applications.map((application) => application.companyName);
}

describe("matchesSearch", () => {
  const application = anApplication({
    companyName: "Globex",
    positionTitle: "Platform Engineer",
    city: "Berlin",
  });

  it.each(["globex", "PLATFORM", "engineer", "berl", "  Globex  "])(
    "finds %j in company, position or city, ignoring case and outer spaces",
    (search) => {
      expect(matchesSearch(application, search, cities)).toBe(true);
    },
  );

  it("finds nothing that is not there", () => {
    expect(matchesSearch(application, "Munich", cities)).toBe(false);
  });

  it("finds the city as stored, ignoring accents", () => {
    expect(matchesSearch(anApplication({ city: "Zürich" }), "zurich", cities)).toBe(true);
  });

  it("finds a city by another name the reference list knows it by, in a country it knows", () => {
    const inMunich = anApplication({ city: "Munich", country: "Germany" });

    expect(matchesSearch(inMunich, "münchen", cities)).toBe(true);
    expect(matchesSearch(inMunich, "мюнхен", cities)).toBe(true);
    expect(matchesSearch(anApplication({ city: "Munich", country: null }), "мюнхен", cities)).toBe(
      false,
    );
  });

  it("lets everything through a blank search", () => {
    expect(matchesSearch(anApplication({ city: null }), "   ", cities)).toBe(true);
  });
});

describe("waitsLong", () => {
  it(`counts from ${longWaitDays} days without a response`, () => {
    expect(waitsLong(anApplication({ appliedAt: daysAgo(longWaitDays) }), now)).toBe(true);
    expect(waitsLong(anApplication({ appliedAt: daysAgo(longWaitDays - 1) }), now)).toBe(false);
  });

  it("never counts a closed application", () => {
    expect(waitsLong(anApplication({ status: "rejected", appliedAt: daysAgo(90) }), now)).toBe(
      false,
    );
  });
});

describe("applicationFilter", () => {
  it("lets any of the chosen statuses through, and only those", () => {
    const query = { ...defaultListQuery, statuses: ["applied", "offer"] as const };
    const passes = applicationFilter(query, now, cities);

    expect(passes(anApplication({ status: "offer" }))).toBe(true);
    expect(passes(anApplication({ status: "applied" }))).toBe(true);
    expect(passes(anApplication({ status: "interview" }))).toBe(false);
  });

  it("asks every filter at once", () => {
    const query = {
      ...defaultListQuery,
      search: "acme",
      statuses: ["applied"] as const,
      waitingLong: true,
    };
    const passes = applicationFilter(query, now, cities);

    expect(passes(anApplication({ appliedAt: daysAgo(50) }))).toBe(true);
    expect(passes(anApplication({ appliedAt: daysAgo(5) }))).toBe(false);
    expect(passes(anApplication({ companyName: "Globex", appliedAt: daysAgo(50) }))).toBe(false);
  });

  it("lets through any of the chosen cities, ignoring case and accents, and only those", () => {
    const query = { ...defaultListQuery, cities: ["munchen", "Berlin"] };
    const passes = applicationFilter(query, now, cities);

    expect(passes(anApplication({ city: "München" }))).toBe(true);
    expect(passes(anApplication({ city: "berlin" }))).toBe(true);
    expect(passes(anApplication({ city: "Munich" }))).toBe(false);
    expect(passes(anApplication({ city: null }))).toBe(false);
  });
});

describe("isFiltered", () => {
  it("is false for the default query and for a different order alone", () => {
    expect(isFiltered(defaultListQuery)).toBe(false);
    expect(
      isFiltered({
        ...defaultListQuery,
        sort: ApplicationSort.Company,
        direction: SortDirection.Ascending,
      }),
    ).toBe(false);
    expect(isFiltered({ ...defaultListQuery, search: "  " })).toBe(false);
  });

  it.each([
    { search: "acme" },
    { cities: ["Munich"] },
    { statuses: ["draft"] as const },
    { waitingLong: true },
  ])("is true for %j", (narrowing) => {
    expect(isFiltered({ ...defaultListQuery, ...narrowing })).toBe(true);
  });
});

describe("firstDirection", () => {
  it.each([
    [ApplicationSort.AppliedAt, SortDirection.Descending],
    [ApplicationSort.Waiting, SortDirection.Descending],
    [ApplicationSort.Company, SortDirection.Ascending],
    [ApplicationSort.City, SortDirection.Ascending],
    [ApplicationSort.Status, SortDirection.Ascending],
  ])("sorts %s %s first", (sort, direction) => {
    expect(firstDirection(sort)).toBe(direction);
  });
});

describe("sortApplications", () => {
  const sorted = (applications: Application[], sort: ApplicationSort, direction: SortDirection) =>
    companies(sortApplications(applications, sort, direction, now));

  it("orders by applied day, the undated last either way", () => {
    const applications = [
      anApplication({ companyName: "Undated", appliedAt: null }),
      anApplication({ companyName: "Old", appliedAt: daysAgo(30) }),
      anApplication({ companyName: "New", appliedAt: daysAgo(2) }),
    ];

    expect(sorted(applications, ApplicationSort.AppliedAt, SortDirection.Descending)).toEqual([
      "New",
      "Old",
      "Undated",
    ]);
    expect(sorted(applications, ApplicationSort.AppliedAt, SortDirection.Ascending)).toEqual([
      "Old",
      "New",
      "Undated",
    ]);
  });

  it("orders companies alphabetically, ignoring case", () => {
    const applications = ["initech", "Acme", "globex"].map((companyName) =>
      anApplication({ companyName }),
    );

    expect(sorted(applications, ApplicationSort.Company, SortDirection.Ascending)).toEqual([
      "Acme",
      "globex",
      "initech",
    ]);
    expect(sorted(applications, ApplicationSort.Company, SortDirection.Descending)).toEqual([
      "initech",
      "globex",
      "Acme",
    ]);
  });

  it("orders by city, the ones without a city last either way", () => {
    const applications = [
      anApplication({ companyName: "Nowhere", city: null }),
      anApplication({ companyName: "Munich", city: "Munich" }),
      anApplication({ companyName: "Berlin", city: "Berlin" }),
    ];

    expect(sorted(applications, ApplicationSort.City, SortDirection.Ascending)).toEqual([
      "Berlin",
      "Munich",
      "Nowhere",
    ]);
    expect(sorted(applications, ApplicationSort.City, SortDirection.Descending)).toEqual([
      "Munich",
      "Berlin",
      "Nowhere",
    ]);
  });

  it("orders statuses along the process, not alphabetically", () => {
    const applications = (["withdrawn", "offer", "applied", "draft", "interview"] as const).map(
      (status) => anApplication({ companyName: status, status }),
    );

    expect(sorted(applications, ApplicationSort.Status, SortDirection.Ascending)).toEqual([
      "draft",
      "applied",
      "interview",
      "offer",
      "withdrawn",
    ]);
  });

  it("orders by days waited, those not waiting last either way", () => {
    const applications = [
      anApplication({ companyName: "Closed", status: "rejected", appliedAt: daysAgo(90) }),
      anApplication({ companyName: "Short", appliedAt: daysAgo(3) }),
      anApplication({ companyName: "Long", appliedAt: daysAgo(60) }),
    ];

    expect(sorted(applications, ApplicationSort.Waiting, SortDirection.Descending)).toEqual([
      "Long",
      "Short",
      "Closed",
    ]);
    expect(sorted(applications, ApplicationSort.Waiting, SortDirection.Ascending)).toEqual([
      "Short",
      "Long",
      "Closed",
    ]);
  });

  it("keeps the incoming order between equals, and leaves the input alone", () => {
    const applications = ["First", "Second", "Third"].map((companyName) =>
      anApplication({ companyName, status: "applied" }),
    );

    expect(sorted(applications, ApplicationSort.Status, SortDirection.Descending)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(companies(applications)).toEqual(["First", "Second", "Third"]);
  });
});

describe("applicationListView", () => {
  const applications = [
    anApplication({ companyName: "Acme", status: "applied", appliedAt: daysAgo(50) }),
    anApplication({ companyName: "Globex", status: "applied", appliedAt: daysAgo(10) }),
    anApplication({ companyName: "Hooli", status: "interview", appliedAt: daysAgo(20) }),
    anApplication({ companyName: "Initech", status: "rejected", appliedAt: daysAgo(70) }),
  ];

  it("shows the first matching applications in the query's order, and counts the rest", () => {
    const view = applicationListView(
      applications,
      { ...defaultListQuery, statuses: ["applied", "interview"] },
      now,
      2,
      cities,
    );

    expect(companies(view.shown)).toEqual(["Globex", "Hooli"]);
    expect(view.matching).toBe(3);
    expect(view.total).toBe(4);
  });

  it("counts every status the view holds, in process order, whatever the filters", () => {
    const view = applicationListView(
      applications,
      { ...defaultListQuery, search: "acme" },
      now,
      50,
      cities,
    );

    expect(view.statusCounts).toEqual([
      { status: "applied", count: 2 },
      { status: "interview", count: 1 },
      { status: "rejected", count: 1 },
    ]);
    expect(view.waitingLongCount).toBe(1);
  });

  it("counts every city of the view alphabetically, spellings differing in case or accents as one", () => {
    const view = applicationListView(
      [
        anApplication({ city: "München" }),
        anApplication({ city: "Munchen" }),
        anApplication({ city: "Munich", country: "Germany" }),
        anApplication({ city: "Berlin" }),
        anApplication({ city: "berlin" }),
        anApplication({ city: null }),
      ],
      { ...defaultListQuery, cities: ["Berlin"] },
      now,
      50,
      cities,
    );

    expect(view.cityCounts).toEqual([
      { city: "Berlin", count: 2 },
      { city: "München", count: 2 },
      { city: "Munich", count: 1 },
    ]);
    expect(view.matching).toBe(2);
  });
});
