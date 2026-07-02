import { describe, expect, it } from "vitest";
import { authorizationHeadersForAccessToken, isUsableBrowserSupabaseKey } from "../src/lib/supabase/client";

describe("browser auth helpers", () => {
  it("adds a bearer token header for authenticated private API calls", () => {
    expect(authorizationHeadersForAccessToken("user-access-token")).toEqual({
      authorization: "Bearer user-access-token",
    });
  });

  it("does not create an authorization header without a session token", () => {
    expect(authorizationHeadersForAccessToken(null)).toEqual({});
    expect(authorizationHeadersForAccessToken(undefined)).toEqual({});
  });

  it("treats missing or placeholder browser Supabase keys as unconfigured", () => {
    expect(isUsableBrowserSupabaseKey(undefined)).toBe(false);
    expect(isUsableBrowserSupabaseKey("")).toBe(false);
    expect(isUsableBrowserSupabaseKey("your-publishable-or-anon-key")).toBe(false);
    expect(isUsableBrowserSupabaseKey("placeholder-ci-anon-key")).toBe(false);
    expect(isUsableBrowserSupabaseKey("replace-with-real-publishable-key")).toBe(false);
  });

  it("allows real-looking Supabase browser keys", () => {
    expect(isUsableBrowserSupabaseKey("sb_publishable_1234567890abcdef")).toBe(true);
    expect(isUsableBrowserSupabaseKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature")).toBe(true);
  });
});


