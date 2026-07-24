import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkillDefinitions, catalogPath, loadSkillCatalog, skillsRoot } from "./list-database-skills.mjs";

function ensureYamlManifest(skill) {
  const metadataDir = path.join(skillsRoot, skill.directory, "agents");
  const metadataFile = path.join(metadataDir, "openai.yaml");

  if (!fs.existsSync(metadataFile)) {
    fs.mkdirSync(metadataDir, { recursive: true });

    // Create a 25-64 character short description
    let shortDesc = skill.description.trim().split(".")[0];
    if (shortDesc.length < 25) {
      shortDesc = (shortDesc + " for the Database app").slice(0, 64);
    } else if (shortDesc.length > 64) {
      shortDesc = shortDesc.slice(0, 61) + "...";
    }

    const yaml = `name: "${skill.name}"
short_description: "${shortDesc}"
default_prompt: "Run $${skill.name}"
allow_implicit_invocation: true
`;
    fs.writeFileSync(metadataFile, yaml, "utf8");
    console.log(`Created manifest for ${skill.name}`);
  }
}

function syncSkills() {
  const discovered = discoverSkillDefinitions();
  const catalog = loadSkillCatalog();

  const existingCanonical = new Set(catalog.categories.flatMap((cat) => (Array.isArray(cat.skills) ? cat.skills : [])));
  const aliases = new Set(Object.keys(catalog.aliases || {}));

  const newSkills = discovered.filter((skill) => !existingCanonical.has(skill.name) && !aliases.has(skill.name));

  if (newSkills.length > 0) {
    // Put new skills in a generic category or the last category
    let targetCategory = catalog.categories.find((cat) => cat.name === "Maintenance & Code Quality");
    if (!targetCategory) {
      targetCategory = catalog.categories[catalog.categories.length - 1];
    }

    for (const skill of newSkills) {
      targetCategory.skills.push(skill.name);
      targetCategory.skills.sort();
      console.log(`Added ${skill.name} to catalog under ${targetCategory.name}`);
    }

    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  } else {
    console.log("Skill catalog is already up to date.");
  }

  for (const skill of discovered) {
    ensureYamlManifest(skill);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  syncSkills();
}
