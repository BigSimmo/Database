import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverSkillDefinitions,
  loadSkillCatalog,
  renderSkillCatalog,
  skillsRoot,
  validateSkillCatalog,
} from "../scripts/list-database-skills.mjs";

describe("Database skill catalog", () => {
  it("contains every canonical skill exactly once and validates every alias", () => {
    const catalog = loadSkillCatalog();
    const result = validateSkillCatalog();
    const discovered = discoverSkillDefinitions();

    const canonicalCount = result.canonical.length;
    expect(result.errors).toEqual([]);
    expect(canonicalCount + result.aliases.length).toBe(discovered.length);
    expect(new Set(result.canonical.map((skill: { name: string }) => skill.name))).toHaveProperty(
      "size",
      canonicalCount,
    );
    for (const category of catalog.categories) {
      expect(category.skills.every((skill: unknown) => typeof skill === "string")).toBe(true);
    }
  });

  it("discovers each declared skill from its folder metadata", () => {
    const discovered = discoverSkillDefinitions();
    const result = validateSkillCatalog();

    expect(discovered).toHaveLength(result.canonical.length + result.aliases.length);
    for (const skill of discovered) {
      if (!skill) continue;
      const metadataPath = path.join(skillsRoot, skill.name, "agents", "openai.yaml");
      expect(skill.directory).toBe(skill.name);
      expect(skill.description).toBeTruthy();
      expect(fs.existsSync(metadataPath)).toBe(true);

      const metadata = fs.readFileSync(metadataPath, "utf8");
      const shortDescription = metadata.match(/short_description:\s*"([^"]+)"/)?.[1] || "";
      const defaultPrompt = metadata.match(/default_prompt:\s*"([^"]+)"/)?.[1] || "";
      expect(shortDescription.length).toBeGreaterThanOrEqual(25);
      expect(shortDescription.length).toBeLessThanOrEqual(64);
      expect(defaultPrompt).toContain(`$${skill.name}`);
    }
  });

  it("keeps canonical skills compact and compatibility aliases as one-hop redirects", () => {
    const result = validateSkillCatalog();

    for (const skill of result.canonical) {
      const content = fs.readFileSync(path.join(skillsRoot, skill.name, "SKILL.md"), "utf8");
      expect(content.split(/\r?\n/).length).toBeLessThanOrEqual(30);
      expect(content.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(220);
    }

    for (const [alias, target] of result.aliases) {
      const content = fs.readFileSync(path.join(skillsRoot, alias, "SKILL.md"), "utf8");
      const metadata = fs.readFileSync(path.join(skillsRoot, alias, "agents", "openai.yaml"), "utf8");
      expect(content).toContain(`.agents/skills/${target}/SKILL.md`);
      expect(content.split(/\r?\n/).length).toBeLessThanOrEqual(15);
      expect(content).not.toContain("npm run");
      expect(metadata).toContain("allow_implicit_invocation: false");
    }
  });

  it("renders canonical skills by category without duplicating compatibility aliases", () => {
    const catalog = loadSkillCatalog();
    const rendered = renderSkillCatalog(catalog);

    expect(rendered).toContain(
      `Database skills (${catalog.categories.reduce((acc, cat) => acc + cat.skills.length, 0)})`,
    );
    expect(rendered).toContain("- skills — List every unique Database-specific skill with a clear explanation");
    expect(rendered).not.toContain("- workflows —");
    for (const category of catalog.categories) expect(rendered).toContain(category.name);
  });
});
