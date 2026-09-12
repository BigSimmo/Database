import { expect, test } from "playwright/test";

import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "../src/lib/api-csrf";

/**
 * Helper to derive base origin and host for simulated request headers.
 */
function resolveOriginAndHost(baseURL?: string) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  return {
    origin: url.origin,
    host: url.host,
  };
}

test.describe("API CSRF proxy integration (#72282V)", () => {
  test("matching Origin & Host -> allowed (or executes route handler)", async ({ request, baseURL }) => {
    const { origin, host } = resolveOriginAndHost(baseURL);
    const response = await request.post("/api/answer-feedback", {
      headers: {
        origin,
        host,
        "sec-fetch-site": "same-origin",
      },
      data: {},
    });

    // Allowed through proxy middleware to route handler; handler error code must not be cross_site_forbidden
    expect(response.status()).not.toBe(403);
    const data = await response.json().catch(() => ({}));
    expect(data.code).not.toBe("cross_site_forbidden");
  });

  test("Sec-Fetch-Site: cross-site -> 403 Forbidden", async ({ request, baseURL }) => {
    const { origin, host } = resolveOriginAndHost(baseURL);
    const response = await request.post("/api/answer-feedback", {
      headers: {
        origin,
        host,
        "sec-fetch-site": "cross-site",
      },
      data: {},
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.code).toBe("cross_site_forbidden");
    expect(data.error).toBe("Cross-site request blocked.");
  });

  test("Mismatched Origin vs Host -> 403 Forbidden", async ({ request, baseURL }) => {
    const { host } = resolveOriginAndHost(baseURL);
    const response = await request.post("/api/answer-feedback", {
      headers: {
        origin: "https://evil-attacker.example.com",
        host,
      },
      data: {},
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.code).toBe("cross_site_forbidden");
    expect(data.error).toBe("Cross-site request blocked.");
  });

  test("Host vs X-Forwarded-Host scenario where X-Forwarded-Host matches Origin -> allowed", async ({
    request,
    baseURL,
  }) => {
    const { host } = resolveOriginAndHost(baseURL);
    const externalDomain = "clinical-kb.up.railway.app";
    const externalOrigin = `https://${externalDomain}`;

    const response = await request.post("/api/answer-feedback", {
      headers: {
        origin: externalOrigin,
        host, // Internal host differs from external Origin
        "x-forwarded-host": externalDomain, // Forwarded host matches Origin
        "sec-fetch-site": "same-site",
      },
      data: {},
    });

    expect(response.status()).not.toBe(403);
    const data = await response.json().catch(() => ({}));
    expect(data.code).not.toBe("cross_site_forbidden");
  });
});

test.describe("apiMutationCsrfVerdict pure contract under simulated proxy headers", () => {
  const internalHost = "localhost:3000";
  const externalHost = "clinical-kb.up.railway.app";
  const externalOrigin = `https://${externalHost}`;

  test("isCsrfGuardedApiRequest guards state-changing API endpoints and excludes webhooks", () => {
    expect(isCsrfGuardedApiRequest("POST", "/api/answer-feedback")).toBe(true);
    expect(isCsrfGuardedApiRequest("PUT", "/api/account/preferences")).toBe(true);
    expect(isCsrfGuardedApiRequest("PATCH", "/api/clinical-quality")).toBe(true);
    expect(isCsrfGuardedApiRequest("DELETE", "/api/documents/123")).toBe(true);
    expect(isCsrfGuardedApiRequest("GET", "/api/documents")).toBe(false);
    expect(isCsrfGuardedApiRequest("POST", "/api/webhooks/incoming")).toBe(false);
  });

  test("matching Origin & Host -> allowed verdict", () => {
    const headers = new Headers({
      host: internalHost,
      origin: `http://${internalHost}`,
      "sec-fetch-site": "same-origin",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({ allowed: true });
  });

  test("Sec-Fetch-Site: cross-site -> rejected with cross_site reason", () => {
    const headers = new Headers({
      host: internalHost,
      origin: `http://${internalHost}`,
      "sec-fetch-site": "cross-site",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({
      allowed: false,
      reason: "cross_site",
    });
  });

  test("Mismatched Origin vs Host -> rejected with origin_mismatch reason", () => {
    const headers = new Headers({
      host: internalHost,
      origin: "https://evil-attacker.example.com",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({
      allowed: false,
      reason: "origin_mismatch",
    });
  });

  test("Host vs X-Forwarded-Host scenario where X-Forwarded-Host matches Origin -> allowed verdict", () => {
    const headers = new Headers({
      host: internalHost,
      "x-forwarded-host": `${externalHost}, internal-proxy`,
      origin: externalOrigin,
      "sec-fetch-site": "same-site",
    });
    expect(apiMutationCsrfVerdict(headers, internalHost)).toEqual({ allowed: true });
  });
});
