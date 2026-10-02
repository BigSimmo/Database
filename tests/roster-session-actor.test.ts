import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { rosterActionSchema } from "@/lib/roster/team/model";

const routesRoot = join(process.cwd(), "src/app/api/roster");

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

describe("Roster session identity contract", () => {
  it("keeps every Roster API route behind session authentication", () => {
    const routes = routeFiles(routesRoot);
    expect(routes.length).toBeGreaterThan(0);
    for (const path of routes) {
      const source = readFileSync(path, "utf8");
      expect(source, relative(routesRoot, path)).toMatch(
        /\b(?:withRosterApi|withRosterOwnerApi|requireAuthenticatedUser)\b/,
      );
      // An actor supplied in a query or body must never replace the session actor.
      expect(source, relative(routesRoot, path)).not.toMatch(
        /(?:searchParams|params)\.get\(["'](?:actorId|ownerId|p_actor_id)["']\)/,
      );
      expect(source, relative(routesRoot, path)).not.toMatch(/\b(?:body|payload)\.(?:actorId|ownerId|p_actor_id)\b/);
    }
  });

  it.each(["actorId", "ownerId", "p_actor_id", "user_id"])("rejects a caller-supplied %s in a team action", (field) => {
    const valid = {
      action: "seen.mark",
      publicationId: "11111111-1111-4111-8111-111111111111",
    };
    expect(rosterActionSchema.safeParse(valid).success).toBe(true);
    expect(rosterActionSchema.safeParse({ ...valid, [field]: "22222222-2222-4222-8222-222222222222" }).success).toBe(
      false,
    );
  });
});
