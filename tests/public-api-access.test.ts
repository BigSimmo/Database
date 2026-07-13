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

  it("trims whitespace around the appended x-forwarded-for entry", () => {
    const spaced = anonymousApiSubjectKey(
      new Request("http://localhost/api/upload", { headers: { "x-forwarded-for": "192.0.2.10 ,  198.51.100.20 " } }),
    );
    const tight = anonymousApiSubjectKey(
      new Request("http://localhost/api/upload", { headers: { "x-forwarded-for": "192.0.2.10,198.51.100.20" } }),
    );

    expect(spaced).toBe(tight);
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const first = anonymousApiSubjectKey(new Request("http://localhost/api/upload", { headers: { "x-real-ip": "198.51.100.30" } }));
    const second = anonymousApiSubjectKey(new Request("http://localhost/api/upload", { headers: { "x-real-ip": "198.51.100.31" } }));

    expect(first).not.toBe(second);
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    const withBoth = anonymousApiSubjectKey(
      new Request("http://localhost/api/upload", {
        headers: { "x-forwarded-for": "198.51.100.40", "x-real-ip": "198.51.100.41" },
      }),
    );
    const forwardedOnly = anonymousApiSubjectKey(
      new Request("http://localhost/api/upload", { headers: { "x-forwarded-for": "198.51.100.40" } }),
    );

    expect(withBoth).toBe(forwardedOnly);
  });

  it("shares a single conservative subject key when no trusted proxy IP is available at all", () => {
    const first = anonymousApiSubjectKey(new Request("http://localhost/api/upload", { headers: { "user-agent": "client-a" } }));
    const second = anonymousApiSubjectKey(new Request("http://localhost/api/upload", { headers: { "user-agent": "client-b" } }));

    expect(first).toBe(second);
  });

  it("ignores cf-connecting-ip entirely, even without any forwarded-for header", () => {
    const withCloudflareOnly = anonymousApiSubjectKey(
      new Request("http://localhost/api/upload", { headers: { "cf-connecting-ip": "203.0.113.50" } }),
    );
    const noHeaders = anonymousApiSubjectKey(new Request("http://localhost/api/upload"));

    expect(withCloudflareOnly).toBe(noHeaders);
  });

  it("produces a subject key namespaced with the anon: prefix", () => {
    const key = anonymousApiSubjectKey(new Request("http://localhost/api/upload", { headers: { "x-real-ip": "198.51.100.60" } }));

    expect(key.startsWith("anon:")).toBe(true);
  });
});
