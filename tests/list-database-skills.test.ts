import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { discoverSkills, extractCatalogSkillIds, findSkillDrift } from "../scripts/list-database-skills.mjs";

describe("list-database-skills", () => {
  it("extracts frontmatter-backed skill metadata from a directory listing", () => {
    const drift = findSkillDrift(
      [
        {
          id: "database-flightplan",
          name: "database-flightplan",
          description: "Plan safe work.",
          missingSkillFile: false,
        },
        { id: "workflows", name: "workflows", description: "List workflow skills.", missingSkillFile: false },
      ],
      ["database-flightplan", "workflows"],
    );
    expect(drift).toEqual({
      missingFromCatalog: [],
      missingFromDisk: [],
      nameMismatches: [],
      missingSkillFiles: [],
    });
  });

  it("extracts catalog skill ids from database-skills.md", () => {
    const catalog = readFileSync(new URL("../.agents/skills/database-skills.md", import.meta.url), "utf8");
    const ids = extractCatalogSkillIds(catalog);
    expect(ids).toContain("database-flightplan");
    expect(ids).toContain("workflows");
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });

  it("passes check mode against the committed skills catalog", () => {
    const catalog = readFileSync(new URL("../.agents/skills/database-skills.md", import.meta.url), "utf8");
    const drift = findSkillDrift(discoverSkills(), extractCatalogSkillIds(catalog));
    expect(drift.missingSkillFiles).toEqual([]);
    expect(drift.nameMismatches).toEqual([]);
    expect(drift.missingFromCatalog).toEqual([]);
    expect(drift.missingFromDisk).toEqual([]);
  });
});
