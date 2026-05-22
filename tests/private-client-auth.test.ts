import { describe, expect, it } from "vitest";
import { authorizationHeadersForAccessToken } from "../src/lib/supabase/client";

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
});
