import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const skillsRoot = path.join(repositoryRoot, ".agents", "skills");
const catalogPath = path.join(skillsRoot, "catalog.json");

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

  // Create directories
  fs.mkdirSync(path.join(skillDir, "agents"), { recursive: true });

  // Create SKILL.md
  const skillMdContent = `---
name: ${skillName}
description: Description for ${skillName}. Use this skill to do something.
---
# ${skillName}

Detailed instructions for the ${skillName} skill.
`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMdContent, "utf8");

  // Create agents/openai.yaml
  const openaiYamlContent = `name: ${skillName}
short_description: "Short description for ${skillName} (25-64 chars)."
default_prompt: "Execute $${skillName} for this task."
`;
  fs.writeFileSync(path.join(skillDir, "agents", "openai.yaml"), openaiYamlContent, "utf8");

  // Update catalog.json (add to Everyday by default)
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const everydayCategory = catalog.categories.find(c => c.name === "Everyday");
  if (everydayCategory && !everydayCategory.skills.includes(skillName)) {
    everydayCategory.skills.push(skillName);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  }

  console.log(`Successfully created skill: ${skillName}`);
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: npm run skill:create <skill-name>");
  process.exit(1);
}

createSkill(args[0]);
