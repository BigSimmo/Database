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

  it("ignores caller-controlled Cloudflare identity when the proxy address is stable", () => {
    const first = anonymousApiSubjectKey(forwardedRequest("192.0.2.10, 198.51.100.20", "203.0.113.10"));
    const second = anonymousApiSubjectKey(forwardedRequest("192.0.2.10, 198.51.100.20", "203.0.113.99"));

    expect(second).toBe(first);
  });

  it("keeps distinct client addresses separate when the proxy appends the same hop", () => {
    const first = anonymousApiSubjectKey(forwardedRequest("192.0.2.10, 198.51.100.20", "203.0.113.10"));
    const second = anonymousApiSubjectKey(forwardedRequest("192.0.2.99, 198.51.100.20", "203.0.113.10"));

    expect(second).not.toBe(first);
  });
});
