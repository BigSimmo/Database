import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { updateOnCallEntrySchema } from "@/app/api/on-call/entries/[id]/route";

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

describe("On Call entry PATCH schema (updateOnCallEntrySchema)", () => {
  const completeBody = {
    section: "contacts" as const,
    slug: "ward-4b",
    title: "Ward 4B",
    subtitle: null,
    body: null,
    details: { role: "Registrar" },
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a complete PATCH body", () => {
    expect(updateOnCallEntrySchema.safeParse(completeBody).success).toBe(true);
  });

  it("rejects a PATCH body that omits lastVerifiedAt instead of silently defaulting it to null", () => {
    const withoutLastVerifiedAt: Record<string, unknown> = { ...completeBody };
    delete withoutLastVerifiedAt.lastVerifiedAt;
    const result = updateOnCallEntrySchema.safeParse(withoutLastVerifiedAt);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "lastVerifiedAt")).toBe(true);
    }
  });

  it("rejects a PATCH body that omits any other defaulted field, not only lastVerifiedAt", () => {
    for (const field of [
      "subtitle",
      "body",
      "linkedDocumentIds",
      "tags",
      "isPersonal",
      "includeOnCard",
      "sortOrder",
    ] as const) {
      const partial: Record<string, unknown> = { ...completeBody };
      delete partial[field];
      expect(updateOnCallEntrySchema.safeParse(partial).success, `omitting ${field} should be rejected`).toBe(false);
    }
  });
});

describe("On Call entry verify route", () => {
  it("sets last_verified_at to the current time and scopes by id and owner_id", () => {
    expect(verify).toContain("last_verified_at: new Date().toISOString()");
    expect(verify).toContain('.eq("id", id)');
    expect(verify).toContain('.eq("owner_id", user.id)');
  });
});
