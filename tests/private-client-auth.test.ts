import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import {
  authorizationHeadersForAccessToken,
  isUsableBrowserSupabaseKey,
  resolveInitialAuthState,
} from "../src/lib/supabase/client";

function fakeSession(userId: string, accessToken = "access-token"): Session {
  return {
    access_token: accessToken,
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: userId } as Session["user"],
  } as Session;
}

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

describe("resolveInitialAuthState — getUser-verified initial auth (audit D3)", () => {
  it("trusts the stored session only when the auth server verified the same user", () => {
    const session = fakeSession("user-1");
    expect(resolveInitialAuthState({ verifiedUserId: "user-1", session })).toEqual({
      status: "authenticated",
      session,
    });
  });

  it("treats a stored session with no server-verified user as signed out (stale/tampered token)", () => {
    // getUser() failed or returned no user, but a session still sits in local storage —
    // the exact case getSession() alone would have trusted as authenticated.
    expect(resolveInitialAuthState({ verifiedUserId: null, session: fakeSession("user-1") })).toEqual({
      status: "signed_out",
      session: null,
    });
  });

  it("does not trust a stored session for a different user than getUser() verified", () => {
    expect(resolveInitialAuthState({ verifiedUserId: "user-1", session: fakeSession("user-2") })).toEqual({
      status: "signed_out",
      session: null,
    });
  });

  it("is signed out when the verified user has no session, or when neither is present", () => {
    expect(resolveInitialAuthState({ verifiedUserId: "user-1", session: null })).toEqual({
      status: "signed_out",
      session: null,
    });
    expect(resolveInitialAuthState({ verifiedUserId: null, session: null })).toEqual({
      status: "signed_out",
      session: null,
    });
  });
});
