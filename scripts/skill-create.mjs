#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const skillsRoot = path.join(repositoryRoot, ".agents", "skills");
const catalogPath = path.join(skillsRoot, "catalog.json");

function toDisplayName(skillName) {
  return skillName
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createSkill(skillName) {
  if (!/^[a-z0-9-]+$/.test(skillName)) {
    console.error(`Invalid skill name: ${skillName}. Only lowercase letters, numbers, and dashes are allowed.`);
    process.exit(1);
  }

  const skillDir = path.join(skillsRoot, skillName);
  if (fs.existsSync(skillDir)) {
    console.error(`Skill directory already exists: ${skillDir}`);
    process.exit(1);
  }

  fs.mkdirSync(path.join(skillDir, "agents"), { recursive: true });

  const displayName = toDisplayName(skillName);
  const shortDescription = `Run the ${displayName} Database skill workflow`.slice(0, 64);
  const paddedShortDescription =
    shortDescription.length < 25 ? `${shortDescription} for this repository task` : shortDescription;

  const skillMdContent = `---
name: ${skillName}
description: ${displayName} helper for Database work. Use this skill when the task matches ${skillName}.
---
# ${displayName}

1. Inspect the current branch, status, and touched paths.
2. Apply the smallest safe change for ${skillName}.
3. Run the narrowest local verification before widening.
`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMdContent, "utf8");

  const openaiYamlContent = `interface:
  display_name: "${displayName}"
  short_description: "${paddedShortDescription}"
  default_prompt: "Use $${skillName} for this Database task."
`;
  fs.writeFileSync(path.join(skillDir, "agents", "openai.yaml"), openaiYamlContent, "utf8");

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const everydayCategory = catalog.categories.find((category) => category.name === "Everyday");
  if (!everydayCategory) {
    console.error('Catalog is missing the "Everyday" category.');
    process.exit(1);
  }
  if (!everydayCategory.skills.includes(skillName)) {
    everydayCategory.skills.push(skillName);
    fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  }

  const canonicalCount = new Set(catalog.categories.flatMap((category) => category.skills)).size;
  console.log(`Successfully created skill: ${skillName}`);
  console.log(`Catalog now lists ${canonicalCount} canonical skills.`);
  console.log("Next: refine SKILL.md, then update AGENTS.md and tests/database-skills.test.ts counts if needed.");
  console.log("Verify with: npm run check:skills");
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: npm run skill:create -- <skill-name>");
  process.exit(1);
}

createSkill(args[0]);
