import { describe, expect, it } from "vitest";
import { anonymousApiSubjectKey } from "@/lib/public-api-access";

function anonymousRequest(ip: string, userAgent: string) {
  return new Request("http://localhost/api/answer", {
    headers: {
      "x-real-ip": ip,
      "user-agent": userAgent,
    },
  });
}

function forwardedRequest(forwardedFor: string, cloudflareIp: string) {
  return new Request("http://localhost/api/upload", {
    headers: {
      "x-forwarded-for": forwardedFor,
      "cf-connecting-ip": cloudflareIp,
    },
  });
}

function headersOnlyRequest(headers: Record<string, string>) {
  return new Request("http://localhost/api/upload", { headers });
}

describe("anonymous API rate-limit identity", () => {
  it("does not let callers rotate the quota by changing user-agent", () => {
    const first = anonymousApiSubjectKey(anonymousRequest("198.51.100.10", "client-a"));
    const second = anonymousApiSubjectKey(anonymousRequest("198.51.100.10", "client-b"));

    expect(second).toBe(first);
  });

  it("keeps distinct network identities separate", () => {
    const first = anonymousApiSubjectKey(anonymousRequest("198.51.100.10", "client"));
    const second = anonymousApiSubjectKey(anonymousRequest("198.51.100.11", "client"));

    expect(second).not.toBe(first);
  });

  it("ignores caller-controlled identity entries before Railway's appended address", () => {
    const first = anonymousApiSubjectKey(forwardedRequest("192.0.2.10, 198.51.100.20", "203.0.113.10"));
    const second = anonymousApiSubjectKey(forwardedRequest("192.0.2.99, 198.51.100.20", "203.0.113.99"));

    expect(second).toBe(first);
  });

  it("keeps distinct Railway-appended client addresses separate", () => {
    const first = anonymousApiSubjectKey(forwardedRequest("192.0.2.10, 198.51.100.20", "203.0.113.10"));
    const second = anonymousApiSubjectKey(forwardedRequest("192.0.2.10, 198.51.100.99", "203.0.113.10"));

    expect(second).not.toBe(first);
  });

  it("never trusts cf-connecting-ip: callers sharing only that header collapse to the unknown-ip bucket", () => {
    const first = anonymousApiSubjectKey(headersOnlyRequest({ "cf-connecting-ip": "203.0.113.10" }));
    const second = anonymousApiSubjectKey(headersOnlyRequest({ "cf-connecting-ip": "203.0.113.99" }));

    // Prior to trusting only the deployment proxy's entry, distinct cf-connecting-ip values
    // would have produced distinct keys. Now both fall through to the shared "unknown-ip" signal.
    expect(second).toBe(first);
  });

  it("falls back to a shared unknown-ip signal when no proxy header is present", () => {
    const first = anonymousApiSubjectKey(headersOnlyRequest({ "user-agent": "client-a" }));
    const second = anonymousApiSubjectKey(headersOnlyRequest({ "user-agent": "client-b" }));

    expect(second).toBe(first);
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    const request = new Request("http://localhost/api/upload", {
      headers: {
        "x-forwarded-for": "192.0.2.10, 198.51.100.20",
        "x-real-ip": "203.0.113.55",
      },
    });
    const usesForwardedFor = anonymousApiSubjectKey(request);
    const matchesForwardedForTail = anonymousApiSubjectKey(forwardedRequest("203.0.113.10, 198.51.100.20", "unused"));
    const matchesRealIpOnly = anonymousApiSubjectKey(headersOnlyRequest({ "x-real-ip": "203.0.113.55" }));

    expect(usesForwardedFor).toBe(matchesForwardedForTail);
    expect(usesForwardedFor).not.toBe(matchesRealIpOnly);
  });

  it("trims whitespace and ignores empty entries in x-forwarded-for", () => {
    const padded = anonymousApiSubjectKey(headersOnlyRequest({ "x-forwarded-for": "  198.51.100.20 ,  " }));
    const clean = anonymousApiSubjectKey(headersOnlyRequest({ "x-forwarded-for": "198.51.100.20" }));

    expect(padded).toBe(clean);
  });
});
