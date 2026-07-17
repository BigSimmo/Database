import { describe, expect, it } from "vitest";

import { fixtureResponseHeaders } from "../src/lib/fixture-response-cache";

const publicFixtureCacheControl = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

describe("fixture response cache policy", () => {
  it("publicly caches only conclusively anonymous fixture responses", () => {
    const anonymous = fixtureResponseHeaders(new Request("http://localhost/api/fixture"), { fixture: true });
    const bearer = fixtureResponseHeaders(
      new Request("http://localhost/api/fixture", { headers: { Authorization: "Bearer token" } }),
      { fixture: true },
    );
    const sessionCookie = fixtureResponseHeaders(
      new Request("http://localhost/api/fixture", { headers: { Cookie: "sb-project-auth-token=opaque" } }),
      { fixture: true },
    );

    expect(anonymous.get("Cache-Control")).toBe(publicFixtureCacheControl);
    expect(anonymous.get("Vary")).toBe("Cookie, Authorization");
    expect(bearer.get("Cache-Control")).toBe("private, no-store");
    expect(sessionCookie.get("Cache-Control")).toBe("private, no-store");
  });

  it("keeps live values private and merges existing Vary values without duplicates", () => {
    const headers = fixtureResponseHeaders(new Request("http://localhost/api/live"), {
      headers: { Vary: "Accept-Encoding, cookie" },
    });

    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("Vary")).toBe("Accept-Encoding, cookie, Authorization");
  });
});
