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
});
