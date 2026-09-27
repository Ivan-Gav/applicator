import { describe, expect, it } from "vitest";
import { SignInFailureReason } from "@/domain/user/model";
import {
  afterSignInPath,
  afterSignInRoute,
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
