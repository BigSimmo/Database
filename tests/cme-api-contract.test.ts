import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = [
  "src/app/api/cme/entries/route.ts",
  "src/app/api/cme/entries/[id]/route.ts",
  "src/app/api/cme/year/route.ts",
].map((path) => ({ path, source: readFileSync(path, "utf8") }));

describe("the CME API", () => {
  for (const { path, source } of routes) {
    it(`${path} takes the owner from the session, never the request`, () => {
      expect(source).toMatch(/requireAuthenticatedUser\(/);
      expect(source).not.toMatch(/body\.(owner_id|ownerId)/);
      expect(source).not.toMatch(/searchParams\.get\("owner/);
    });

    it(`${path} refuses writes in demo mode rather than faking them`, () => {
      if (!/export async function (POST|PATCH|DELETE|PUT)/.test(source)) return;
      expect(source).toMatch(/isDemoMode\(\)/);
      expect(source).toMatch(/demo_mode_unavailable/);
    });
  }
});
