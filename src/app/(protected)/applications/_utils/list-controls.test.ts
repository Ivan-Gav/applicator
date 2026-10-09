import { describe, expect, it } from "vitest";
import {
  ApplicationsView,
  applicationsListStateOf,
  applicationsPageSize,
  applicationsSearchParam,
  routes,
} from "@/app/routes";
import {
  type ApplicationListQuery,
  type ApplicationListView,
  ApplicationSort,
  defaultListQuery,
  SortDirection,
} from "@/domain/application/list";
import { applicationListControls, applicationSortLinks } from "./list-controls";

const view = ApplicationsView.Active;

function aView(overrides: Partial<ApplicationListView> = {}): ApplicationListView {
  return {
    shown: [],
    total: 5,
    matching: 5,
    statusCounts: [
      { status: "applied", count: 3 },
      { status: "rejected", count: 2 },
    ],
    waitingLongCount: 0,
    ...overrides,
  };
}

// What the list would ask for after following `href`.
function stateAt(href: string) {
  return applicationsListStateOf(
    Object.fromEntries(new URL(href, "http://localhost").searchParams),
  );
}

function controlsFor(query: ApplicationListQuery, list = aView()) {
  const controls = applicationListControls({ view, query }, list);
  if (!controls) {
    throw new Error("expected controls");
  }
  return controls;
}

describe("applicationListControls", () => {
  it("offers nothing to search or filter in an empty view", () => {
    expect(
      applicationListControls({ view, query: defaultListQuery }, aView({ total: 0 })),
    ).toBeNull();
  });

  it("offers a chip per status the view holds, each switching only itself", () => {
    const query = { ...defaultListQuery, statuses: ["applied"] as const };

    const [applied, rejected] = controlsFor(query).filters.statuses;

    expect(applied).toMatchObject({ status: "applied", count: 3, on: true });
    expect(rejected).toMatchObject({ status: "rejected", count: 2, on: false });
    expect(stateAt(applied!.href).query.statuses).toEqual([]);
    expect(stateAt(rejected!.href).query.statuses).toEqual(["applied", "rejected"]);
  });

  it("keeps a chip that is on even when the view no longer holds its status", () => {
    const query = { ...defaultListQuery, statuses: ["offer"] as const };

    expect(controlsFor(query).filters.statuses.map(({ status, count }) => [status, count])).toEqual(
      [
        ["applied", 3],
        ["offer", 0],
        ["rejected", 2],
      ],
    );
  });

  it("offers the long-wait filter only while some application waits long, or it is on", () => {
    expect(controlsFor(defaultListQuery).filters.waitingLong).toBeNull();

    const offered = controlsFor(defaultListQuery, aView({ waitingLongCount: 1 })).filters
      .waitingLong;
    expect(offered?.on).toBe(false);
    expect(stateAt(offered!.href).query.waitingLong).toBe(true);

    expect(controlsFor({ ...defaultListQuery, waitingLong: true }).filters.waitingLong?.on).toBe(
      true,
    );
  });

  it("clears search and filters but keeps the order", () => {
    const query = {
      search: "acme",
      statuses: ["applied"] as const,
      waitingLong: true,
      sort: ApplicationSort.Company,
      direction: SortDirection.Ascending,
    };

    const { clearHref } = controlsFor(query).filters;

    expect(stateAt(clearHref!).query).toEqual({
      ...defaultListQuery,
      sort: ApplicationSort.Company,
      direction: SortDirection.Ascending,
    });
    expect(controlsFor(defaultListQuery).filters.clearHref).toBeNull();
  });

  it("starts every filter's list over at its first page", () => {
    const controls = controlsFor(defaultListQuery);

    for (const { href } of controls.filters.statuses) {
      expect(stateAt(href).shown).toBe(applicationsPageSize);
    }
  });

  it("sends the rest of the list's state along with a search, but not the old search", () => {
    const query = {
      ...defaultListQuery,
      search: "old",
      statuses: ["applied"] as const,
      sort: ApplicationSort.City,
    };

    const { search } = controlsFor(query);

    expect(search).toMatchObject({
      action: routes.applications,
      name: applicationsSearchParam.search,
      value: "old",
    });
    expect(Object.fromEntries(search.hiddenFields)).toEqual({
      [applicationsSearchParam.status]: "applied",
      [applicationsSearchParam.sort]: ApplicationSort.City,
      [applicationsSearchParam.direction]: SortDirection.Descending,
    });
  });

  it("counts the view and what the filters let through", () => {
    const controls = controlsFor({ ...defaultListQuery, search: "x" }, aView({ matching: 2 }));

    expect(controls).toMatchObject({ total: 5, matching: 2, filtered: true });
  });
});

describe("applicationSortLinks", () => {
  it("marks the ordered column and reverses it on a click", () => {
    const links = applicationSortLinks({ view, query: defaultListQuery });

    expect(links[ApplicationSort.AppliedAt].direction).toBe(SortDirection.Descending);
    expect(stateAt(links[ApplicationSort.AppliedAt].href).query).toMatchObject({
      sort: ApplicationSort.AppliedAt,
      direction: SortDirection.Ascending,
    });
  });

  it.each([
    [ApplicationSort.Company, SortDirection.Ascending],
    [ApplicationSort.City, SortDirection.Ascending],
    [ApplicationSort.Status, SortDirection.Ascending],
    [ApplicationSort.Waiting, SortDirection.Descending],
  ])("orders by %s, %s first, from another column", (sort, direction) => {
    const link = applicationSortLinks({ view, query: defaultListQuery })[sort];

    expect(link.direction).toBeNull();
    expect(stateAt(link.href).query).toMatchObject({ sort, direction });
  });

  it("keeps search and filters when the order changes", () => {
    const query = { ...defaultListQuery, search: "acme", statuses: ["offer"] as const };

    const link = applicationSortLinks({ view, query })[ApplicationSort.Company];

    expect(stateAt(link.href).query).toMatchObject({ search: "acme", statuses: ["offer"] });
  });
});
