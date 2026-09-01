import { describe, expect, it } from "vitest";

import { safeCanonicalSourceUrl } from "@/lib/sources/source-url-policy";

describe("governed source URL query policy", () => {
  it.each(["https://www.health.gov.au/resource?language=en", "https://www.legislation.wa.gov.au/act?OpenElement"])(
    "allows the current benign query form %s",
    (value) => {
      expect(safeCanonicalSourceUrl(value)).toBe(value);
    },
  );

  it.each([
    "client_secret",
    "refresh_token",
    "session_token",
    "jwt",
    "access_key",
    "auth_token",
    "X-Amz-Credential",
    "X-Amz-Security-Token",
  ])("rejects the credential-shaped query key %s", (key) => {
    expect(safeCanonicalSourceUrl(`https://www.ranzcp.org/guidance?${key}=sensitive-value`)).toBeNull();
  });

  it.each([
    "https://www.ranzcp.org/guidance?view=summary",
    "https://www.ranzcp.org/guidance?next=https%3A%2F%2Fexample.invalid%2Fsigned%3Ftoken%3Dsecret",
    "https://www.health.gov.au/resource?language=english",
    "https://www.health.gov.au/resource?language=en&language=fr",
    "https://www.health.gov.au/resource?language=en&view=summary",
    "https://www.legislation.wa.gov.au/act?OpenElement=1",
    "https://www.legislation.wa.gov.au/act?OpenElement&view=summary",
  ])("rejects the non-allowlisted query shape %s", (value) => {
    expect(safeCanonicalSourceUrl(value)).toBeNull();
  });
});
