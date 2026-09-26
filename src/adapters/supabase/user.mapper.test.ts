import type { User as SupabaseUser } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { toUser } from "./user.mapper";

const row: SupabaseUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  aud: "authenticated",
  email: "alice@example.test",
  created_at: "2026-09-01T08:30:00.000Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
};

describe("toUser", () => {
  it("maps the storage shape to the domain shape", () => {
    expect(toUser(row)).toEqual({
      id: "00000000-0000-4000-8000-00000000000a",
      email: "alice@example.test",
      createdAt: new Date("2026-09-01T08:30:00.000Z"),
    });
  });

  it("refuses a user without an email address", () => {
    expect(() => toUser({ ...row, email: undefined })).toThrow(/no email/);
  });
});
