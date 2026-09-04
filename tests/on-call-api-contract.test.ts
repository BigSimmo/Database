import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const list = readFileSync("src/app/api/on-call/entries/route.ts", "utf8");
const detail = readFileSync("src/app/api/on-call/entries/[id]/route.ts", "utf8");
const verify = readFileSync("src/app/api/on-call/entries/[id]/verify/route.ts", "utf8");

describe("On Call entries route", () => {
  it("never reads the database for an anonymous caller", () => {
    expect(list).toContain("if (!access.ownerId)");
    expect(list).toMatch(/signedOut:\s*true/);
  });

  it("takes the owner from the access context, never from the request", () => {
    expect(list).not.toMatch(/body\.(owner_id|ownerId)/);
    expect(list).not.toMatch(/searchParams\.get\(\s*["']owner/);
  });

  it("uses the admin client and scopes through the repository helper", () => {
    expect(list).toContain("createAdminClient");
    expect(list).toContain("fetchOwnerOnCallEntries");
  });

  it("maps AuthenticationError to a 401 and falls through to jsonError otherwise", () => {
    expect(list).toContain("AuthenticationError");
    expect(list).toContain("unauthorizedResponse()");
    expect(list).toContain("jsonError(error)");
  });
});

describe("On Call entry [id] route", () => {
  it("takes the owner from the session only, never the body or a query string", () => {
    for (const source of [detail, verify]) {
      expect(source).not.toMatch(/body\.(owner_id|ownerId)/);
      expect(source).not.toMatch(/searchParams\.get\(\s*["']owner/);
      expect(source).toContain("requireAuthenticatedUser");
    }
  });

  it('scopes every mutation by id AND owner_id on the same chain as .from("on_call_entries")', () => {
    const chains = [...detail.matchAll(/\.from\("on_call_entries"\)([\s\S]*?)(?:;\n|\n\n)/g)];
    expect(chains.length).toBeGreaterThan(0);
    for (const [, chainTail] of chains) {
      expect(chainTail).toContain('.eq("owner_id", user.id)');
    }
  });

  it("returns 404 identically for a missing id and an id owned by someone else", () => {
    expect(detail).toContain("On Call entry not found.");
    // A single not-found branch fed by the same scoped lookup — no separate existence check
    // that would let a caller distinguish "missing" from "not yours".
    expect(detail.match(/On Call entry not found\./g)?.length).toBe(2);
  });
});

describe("On Call entry verify route", () => {
  it("sets last_verified_at to the current time and scopes by id and owner_id", () => {
    expect(verify).toContain("last_verified_at: new Date().toISOString()");
    expect(verify).toContain('.eq("id", id)');
    expect(verify).toContain('.eq("owner_id", user.id)');
  });
});
