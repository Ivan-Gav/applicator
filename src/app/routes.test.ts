import { describe, expect, it } from "vitest";
import {
  ApplicationSort,
  defaultListQuery,
  firstDirection,
  SortDirection,
} from "@/domain/application/list";
import { SignInFailureReason } from "@/domain/user/model";
import {
  ApplicationsView,
  afterSignInPath,
  afterSignInRoute,
  applicationPath,
  applicationsListStateOf,
  applicationsPageSize,
  applicationsPath,
  applicationsSearchParam,
  applicationsViewOf,
  magicLinkCallbackPath,
  redirectToIn,
  redirectToParam,
  routes,
  signInPath,
  signInSearchParam,
} from "./routes";

function parse(path: string): URL {
  return new URL(path, "http://localhost");
}

describe("signInPath", () => {
  it("is the bare sign-in route without options", () => {
    expect(signInPath()).toBe(routes.signIn);
  });

  it("carries the reason as a search parameter", () => {
    const url = parse(signInPath({ reason: SignInFailureReason.VerifierMissing }));

    expect(url.pathname).toBe(routes.signIn);
    expect(url.searchParams.get(signInSearchParam.reason)).toBe(
      SignInFailureReason.VerifierMissing,
    );
  });

  it("carries the destination after sign-in, query included", () => {
    const destination = "/applications?status=rejected&sort=date";
    const url = parse(
      signInPath({ reason: SignInFailureReason.SessionExpired, redirectTo: destination }),
    );

    expect(url.searchParams.get(signInSearchParam.reason)).toBe(SignInFailureReason.SessionExpired);
    expect(url.searchParams.get(signInSearchParam.redirectTo)).toBe(destination);
  });
});

describe("magicLinkCallbackPath", () => {
  it("is the bare callback route without a destination", () => {
    expect(magicLinkCallbackPath()).toBe(routes.authCallback);
    expect(magicLinkCallbackPath(null)).toBe(routes.authCallback);
  });

  it("carries the destination as a search parameter", () => {
    const url = parse(magicLinkCallbackPath("/applications?status=offer"));

    expect(url.pathname).toBe(routes.authCallback);
    expect(url.searchParams.get(redirectToParam)).toBe("/applications?status=offer");
  });
});

describe("afterSignInPath", () => {
  it("keeps a same-site destination", () => {
    expect(afterSignInPath("/applications/42")).toBe("/applications/42");
  });

  it.each([null, undefined, "", "//evil.com", "https://evil.com"])(
    "falls back to the default for %j",
    (value) => {
      expect(afterSignInPath(value)).toBe(afterSignInRoute);
    },
  );
});

describe("redirectToIn", () => {
  it("reads the destination from a path's query", () => {
    expect(redirectToIn(signInPath({ redirectTo: "/applications?status=offer" }))).toBe(
      "/applications?status=offer",
    );
  });

  it("is null for a path without it", () => {
    expect(redirectToIn(routes.signIn)).toBeNull();
    expect(redirectToIn(signInPath({ reason: SignInFailureReason.LinkExpired }))).toBeNull();
  });
});

describe("applicationPath", () => {
  it("is the application's id below the list", () => {
    expect(applicationPath("00000000-0000-4000-8000-0000000000a1")).toBe(
      `${routes.applications}/00000000-0000-4000-8000-0000000000a1`,
    );
  });

  it("keeps an id within one path segment", () => {
    expect(parse(applicationPath("../x?y")).pathname).toBe(`${routes.applications}/..%2Fx%3Fy`);
  });
});

describe("applicationsPath", () => {
  it("is the bare list for the active view", () => {
    expect(applicationsPath()).toBe(routes.applications);
    expect(applicationsPath(ApplicationsView.Active)).toBe(routes.applications);
  });

  it("carries the archived view as a search parameter that reads back as itself", () => {
    const url = parse(applicationsPath(ApplicationsView.Archived));

    expect(url.pathname).toBe(routes.applications);
    expect(applicationsViewOf(url.searchParams.get(applicationsSearchParam.view))).toBe(
      ApplicationsView.Archived,
    );
  });
});

describe("applicationsViewOf", () => {
  it.each([undefined, null, "", "deleted", ["archived"]])(
    "reads %j as the active view",
    (value) => {
      expect(applicationsViewOf(value)).toBe(ApplicationsView.Active);
    },
  );
});

describe("applicationsListStateOf", () => {
  function stateOf(path: string) {
    const params = Object.fromEntries(parse(path).searchParams);
    return applicationsListStateOf(params);
  }

  it("reads a bare list as the active view, unfiltered, newest first, one page long", () => {
    expect(stateOf(routes.applications)).toEqual({
      view: ApplicationsView.Active,
      query: defaultListQuery,
      shown: applicationsPageSize,
    });
  });

  it("reads back every part of a path it built", () => {
    const state = {
      view: ApplicationsView.Archived,
      query: {
        search: "platform engineer",
        statuses: ["applied", "interview"] as const,
        waitingLong: true,
        sort: ApplicationSort.Company,
        direction: SortDirection.Descending,
      },
      shown: 150,
    };

    expect(stateOf(applicationsPath(state.view, state.query, state.shown))).toEqual(state);
  });

  it("writes the order whole, column and direction, whenever it is not the default", () => {
    const { sort, direction } = applicationsSearchParam;

    expect(
      applicationsPath(ApplicationsView.Active, {
        ...defaultListQuery,
        sort: ApplicationSort.Waiting,
        direction: firstDirection(ApplicationSort.Waiting),
      }),
    ).toBe(`${routes.applications}?${sort}=${ApplicationSort.Waiting}&${direction}=desc`);
    expect(
      applicationsPath(ApplicationsView.Active, {
        ...defaultListQuery,
        direction: SortDirection.Ascending,
      }),
    ).toBe(`${routes.applications}?${sort}=${ApplicationSort.AppliedAt}&${direction}=asc`);
  });

  it("leaves the default order out of the path", () => {
    expect(applicationsPath(ApplicationsView.Active, defaultListQuery)).toBe(routes.applications);
  });

  it.each(["company", "applied", "waiting"])(
    "reads a missing direction as descending, for sort=%s too",
    (sort) => {
      expect(stateOf(`${routes.applications}?sort=${sort}`).query.direction).toBe(
        SortDirection.Descending,
      );
    },
  );

  it("ignores what it does not know", () => {
    expect(
      stateOf(
        `${routes.applications}?status=applied,hired,,offer&waiting=yes&sort=salary&dir=up&shown=abc`,
      ),
    ).toEqual({
      view: ApplicationsView.Active,
      query: { ...defaultListQuery, statuses: ["applied", "offer"] },
      shown: applicationsPageSize,
    });
  });

  it.each(["0", "-50", "10", "1e3", "2.5"])("shows one page for shown=%s", (shown) => {
    expect(stateOf(`${routes.applications}?shown=${shown}`).shown).toBe(applicationsPageSize);
  });

  it("takes the first of repeated parameters", () => {
    expect(applicationsListStateOf({ q: ["acme", "globex"] }).query.search).toBe("acme");
  });
});
