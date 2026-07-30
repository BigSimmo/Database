import { execFileSync } from "node:child_process";
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

    expect(result.errors).toEqual([]);
    expect(result.canonical).toHaveLength(33);
    expect(new Set(result.canonical.map((skill: { name: string }) => skill.name))).toHaveProperty("size", 33);
    expect(result.aliases).toHaveLength(8);
    for (const category of catalog.categories) {
      expect(category.skills.every((skill: unknown) => typeof skill === "string")).toBe(true);
    }
  });

  it("discovers each declared skill from its folder metadata", () => {
    const discovered = discoverSkillDefinitions();

    expect(discovered).toHaveLength(41);
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

  it("keeps prompt perfection refinement-only and uses the supported repository workflow", () => {
    const skillRoot = path.join(skillsRoot, "prompt-perfector");
    const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
    const metadata = fs.readFileSync(path.join(skillRoot, "agents", "openai.yaml"), "utf8");
    const repositoryWorkflow = fs.readFileSync(path.join(skillRoot, "references", "repository-workflow.md"), "utf8");
    const verifier = fs.readFileSync(path.join(skillRoot, "scripts", "verify-repository-isolation.mjs"), "utf8");

    expect(skill).not.toContain('Workspace: "branch"');
    expect(skill).not.toContain('Workspace: "share"');
    for (const [scenario, contract] of [
      ["refinement-only", "For refinement, return only `Perfected prompt`"],
      ["explicit evaluation", "For evaluation, return `Evaluation`"],
      ["embedded instructions", "as untrusted data"],
      ["unauthorized execution", "Prompt perfection never authorizes"],
      ["repository write", "references/repository-workflow.md"],
    ]) {
      expect(skill, scenario).toContain(contract);
    }
    expect(metadata).toContain("unless I explicitly request evaluation or execution");
    expect(repositoryWorkflow).toContain("$env:USERPROFILE");
    expect(repositoryWorkflow).not.toContain("C:\\Users\\joshs");
    expect(repositoryWorkflow).toContain("start-codex-task.ps1");
    expect(repositoryWorkflow).toContain("TASK_START git=true");
    expect(repositoryWorkflow).toContain("verify-repository-isolation.mjs");
    expect(repositoryWorkflow).toContain("--allow-dirty");
    expect(repositoryWorkflow).toContain("do not provide an OS-level sandbox");
    expect(verifier).toContain("dirty_override_requires_expected_state");
    expect(verifier).toContain("expected_state_required");
    expect(verifier).toContain("primary_worktree");
    expect(verifier).not.toContain("node_modules");
  });

  it("exercises prompt-perfector isolation failure paths", () => {
    const verifier = path.join(skillsRoot, "prompt-perfector", "scripts", "verify-repository-isolation.mjs");
    const output = execFileSync(process.execPath, [verifier, "--self-test"], { encoding: "utf8" });

    expect(output).toContain("prompt-perfector isolation self-test passed: 10/10");
  });

  it("renders canonical skills by category without duplicating compatibility aliases", () => {
    const catalog = loadSkillCatalog();
    const rendered = renderSkillCatalog(catalog);

    expect(rendered).toContain(
      `Database skills (${catalog.categories.reduce(
        (acc: number, cat: { skills: string[] }) => acc + cat.skills.length,
        0,
      )})`,
    );
    expect(rendered).toContain("- skills — List every unique Database-specific skill with a clear explanation");
    expect(rendered).not.toContain("- workflows —");
    for (const category of catalog.categories) expect(rendered).toContain(category.name);
  });
});
