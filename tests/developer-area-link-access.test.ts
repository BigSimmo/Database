import { describe, expect, it } from "vitest";

import {
  DEVELOPER_ACCESS_COOKIE_MAX_AGE_SECONDS,
  developerAccessKeyMatches,
  developerAccessTokenValid,
  issueDeveloperAccessToken,
  resolveDeveloperAccessKey,
} from "../src/lib/developer-area/link-access";

// The passwordless route into the developer-gated /mockups subtrees. It is a
// real production credential on psychiatry.tools -- the thing standing between
// an unauthenticated visitor and the task ledger, the hazard notes, and the Ward
// Flow / Care Plan / Caring Contact prototypes -- so every way it could fail
// OPEN is asserted here, not just the happy path.

const KEY = "0123456789abcdef0123456789abcdef"; // exactly the 32-character floor
const OTHER_KEY = "fedcba9876543210fedcba9876543210";
const configured = { DEVELOPER_AREA_ACCESS_KEY: KEY };

describe("resolveDeveloperAccessKey", () => {
  it("returns the trimmed key when configured at sufficient length", () => {
    expect(resolveDeveloperAccessKey({ DEVELOPER_AREA_ACCESS_KEY: `  ${KEY}  ` })).toBe(KEY);
  });

  it("treats an unset, blank, or under-strength key as unconfigured", () => {
    expect(resolveDeveloperAccessKey({})).toBeNull();
    expect(resolveDeveloperAccessKey({ DEVELOPER_AREA_ACCESS_KEY: "   " })).toBeNull();
    // One character short of the floor. A weak secret in a URL must be refused
    // outright rather than accepted as "better than nothing".
    expect(resolveDeveloperAccessKey({ DEVELOPER_AREA_ACCESS_KEY: KEY.slice(0, 31) })).toBeNull();
  });
});

describe("issueDeveloperAccessToken", () => {
  it("mints a verifiable token under the configured key", () => {
    const token = issueDeveloperAccessToken(configured);
    expect(token).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]+$/);
    expect(developerAccessTokenValid(token, configured)).toBe(true);
  });

  it("mints nothing when no key is configured, rather than an unsigned token", () => {
    expect(issueDeveloperAccessToken({})).toBeNull();
    expect(issueDeveloperAccessToken({ DEVELOPER_AREA_ACCESS_KEY: "too-short" })).toBeNull();
  });
});

describe("developerAccessTokenValid", () => {
  it("rejects a token signed under a different key (rotation revokes every device)", () => {
    const token = issueDeveloperAccessToken(configured);
    expect(developerAccessTokenValid(token, { DEVELOPER_AREA_ACCESS_KEY: OTHER_KEY })).toBe(false);
  });

  it("rejects a tampered signature and a tampered issue time", () => {
    const now = 1_760_000_000_000;
    const token = issueDeveloperAccessToken(configured, now) as string;
    const [version, issuedAt, signature] = token.split(".");

    expect(developerAccessTokenValid(`${version}.${issuedAt}.${signature}x`, configured, now)).toBe(false);
    // Re-dating a genuine token is the attack the signature covers the issue
    // time for: without it, an expired cookie could be renewed by its holder.
    expect(developerAccessTokenValid(`${version}.${Number(issuedAt) + 10}.${signature}`, configured, now)).toBe(false);
  });

  it("rejects malformed, empty, and wrong-version values", () => {
    for (const value of ["", "v1", "v1.123", "v2.123.sig", "...", "v1..sig", "v1.notanumber.sig"]) {
      expect(developerAccessTokenValid(value, configured)).toBe(false);
    }
    expect(developerAccessTokenValid(undefined, configured)).toBe(false);
    expect(developerAccessTokenValid(null, configured)).toBe(false);
  });

  it("rejects every token when no key is configured (fail closed)", () => {
    const token = issueDeveloperAccessToken(configured);
    expect(developerAccessTokenValid(token, {})).toBe(false);
  });

  it("enforces the expiry server-side, not by trusting the browser to drop the cookie", () => {
    const issuedAt = 1_760_000_000_000;
    const token = issueDeveloperAccessToken(configured, issuedAt) as string;
    const justInside = issuedAt + (DEVELOPER_ACCESS_COOKIE_MAX_AGE_SECONDS - 60) * 1000;
    const justOutside = issuedAt + (DEVELOPER_ACCESS_COOKIE_MAX_AGE_SECONDS + 60) * 1000;

    expect(developerAccessTokenValid(token, configured, justInside)).toBe(true);
    expect(developerAccessTokenValid(token, configured, justOutside)).toBe(false);
  });

  it("rejects a token stamped far in the future", () => {
    const now = 1_760_000_000_000;
    const postDated = issueDeveloperAccessToken(configured, now + 86_400_000) as string;
    expect(developerAccessTokenValid(postDated, configured, now)).toBe(false);
  });
});

describe("developerAccessKeyMatches", () => {
  it("accepts the exact configured key and nothing else", () => {
    expect(developerAccessKeyMatches(KEY, configured)).toBe(true);
    expect(developerAccessKeyMatches(OTHER_KEY, configured)).toBe(false);
    // A prefix must not pass: the comparison is length-checked before the
    // constant-time compare, so a truncated guess cannot match.
    expect(developerAccessKeyMatches(KEY.slice(0, 20), configured)).toBe(false);
  });

  it("matches nothing when unconfigured, including the empty string", () => {
    expect(developerAccessKeyMatches(KEY, {})).toBe(false);
    expect(developerAccessKeyMatches("", {})).toBe(false);
    expect(developerAccessKeyMatches(undefined, configured)).toBe(false);
  });
});
