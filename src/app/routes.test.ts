import { describe, expect, it } from "vitest";
import { SignInFailureReason } from "@/domain/user/model";
import { routes, signInPath, signInSearchParam } from "./routes";

describe("signInPath", () => {
  it("is the bare sign-in route without a reason", () => {
    expect(signInPath()).toBe(routes.signIn);
  });

  it("carries the reason as a search parameter", () => {
    const url = new URL(signInPath(SignInFailureReason.VerifierMissing), "http://localhost");

    expect(url.pathname).toBe(routes.signIn);
    expect(url.searchParams.get(signInSearchParam.reason)).toBe(
      SignInFailureReason.VerifierMissing,
    );
  });
});
