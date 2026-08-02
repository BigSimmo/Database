import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDirectory, "..");
export const skillsRoot = path.join(repositoryRoot, ".agents", "skills");
export const catalogPath = path.join(skillsRoot, "catalog.json");

function wordCount(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function readAgentMetadata(metadataFile) {
  const content = fs.readFileSync(metadataFile, "utf8");
  return {
    content,
    shortDescription: content.match(/short_description:\s*"([^"]+)"/)?.[1] || "",
    defaultPrompt: content.match(/default_prompt:\s*"([^"]+)"/)?.[1] || "",
  };
}

function readFrontmatter(skillFile) {
  const content = fs.readFileSync(skillFile, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`Missing YAML frontmatter: ${skillFile}`);

  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

export function loadSkillCatalog(file = catalogPath) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function discoverSkillDefinitions(root = skillsRoot) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillFile = path.join(root, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) return null;
      const frontmatter = readFrontmatter(skillFile);
      return { directory: entry.name, name: frontmatter.name, description: frontmatter.description };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function validateSkillCatalog(catalog = loadSkillCatalog(), discovered = discoverSkillDefinitions()) {
  const errors = [];
  if (catalog.version !== 1) errors.push(`Unsupported catalog version: ${catalog.version}`);
  const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
  if (categories.length === 0) errors.push("Catalog must contain at least one category");
  for (const category of categories) {
    if (typeof category.name !== "string" || !category.name.trim()) errors.push("Catalog category is missing a name");
    if (!Array.isArray(category.skills) || category.skills.length === 0) {
      errors.push(`Catalog category has no skills: ${category.name || "unnamed"}`);
    }
  }

  const categoryNames = categories.map((category) => category.name);
  const canonical = categories.flatMap((category) =>
    (Array.isArray(category.skills) ? category.skills : []).map((name) => ({ name, category: category.name })),
  );
  const canonicalNames = canonical.map((skill) => skill.name);
  const aliases = Object.entries(catalog.aliases || {});
  const aliasNames = aliases.map(([alias]) => alias);
  const aliasTargets = new Map(aliases);
  const discoveredByName = new Map(discovered.map((skill) => [skill.name, skill]));
  const discoveredNames = discovered.map((skill) => skill.name);
  const descriptions = new Map();

  for (const [label, names] of [
    ["category", categoryNames],
    ["canonical skill", canonicalNames],
    ["alias", aliasNames],
    ["discovered skill", discoveredNames],
  ]) {
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length) errors.push(`Duplicate ${label} names: ${[...new Set(duplicates)].join(", ")}`);
  }

  for (const skill of canonical) {
    if (!/^[a-z0-9-]+$/.test(skill.name)) errors.push(`Invalid canonical skill name: ${skill.name}`);
    const discoveredSkill = discoveredByName.get(skill.name);
    if (!discoveredSkill) errors.push(`Missing canonical skill folder: ${skill.name}`);
    else if (discoveredSkill.directory !== skill.name) {
      errors.push(`Canonical skill directory mismatch: ${skill.name} is in ${discoveredSkill.directory}`);
    } else {
      descriptions.set(skill.name, discoveredSkill.description);
    }
  }

  for (const [alias, target] of aliases) {
    if (!canonicalNames.includes(target)) errors.push(`Alias ${alias} targets missing canonical skill ${target}`);
    if (canonicalNames.includes(alias)) errors.push(`Alias duplicates canonical skill: ${alias}`);
    if (!discoveredByName.has(alias)) errors.push(`Missing compatibility alias folder: ${alias}`);
  }

  const allowed = new Set([...canonicalNames, ...aliasNames]);
  for (const skill of discovered) {
    if (!allowed.has(skill.name)) errors.push(`Uncatalogued Database skill: ${skill.name}`);
    if (skill.name !== skill.directory)
      errors.push(`Skill name/directory mismatch: ${skill.directory} declares ${skill.name}`);
    if (!skill.description?.trim()) errors.push(`Missing skill description: ${skill.name}`);
    if (wordCount(skill.description) > 60) errors.push(`Skill description exceeds 60 words: ${skill.name}`);

    const skillFile = path.join(skillsRoot, skill.directory, "SKILL.md");
    const skillContent = fs.readFileSync(skillFile, "utf8");
    const lineCount = skillContent.split(/\r?\n/).length;
    const metadataFile = path.join(skillsRoot, skill.directory, "agents", "openai.yaml");
    if (!fs.existsSync(metadataFile)) {
      errors.push(`Missing agents/openai.yaml: ${skill.name}`);
      continue;
    }

    const metadata = readAgentMetadata(metadataFile);
    if (metadata.shortDescription.length < 25 || metadata.shortDescription.length > 64) {
      errors.push(`Invalid short_description length for ${skill.name}: ${metadata.shortDescription.length}`);
    }
    if (!metadata.defaultPrompt.includes(`$${skill.name}`)) {
      errors.push(`default_prompt does not mention $${skill.name}`);
    }

    const aliasTarget = aliasTargets.get(skill.name);
    if (aliasTarget) {
      if (!skillContent.includes(`.agents/skills/${aliasTarget}/SKILL.md`)) {
        errors.push(`Alias ${skill.name} does not redirect to ${aliasTarget}`);
      }
      if (lineCount > 15) errors.push(`Alias skill is too long: ${skill.name} (${lineCount} lines)`);
      if (skillContent.includes("npm run")) errors.push(`Alias duplicates executable procedure: ${skill.name}`);
      if (!metadata.content.includes("allow_implicit_invocation: false")) {
        errors.push(`Alias allows implicit invocation: ${skill.name}`);
      }
    } else {
      if (lineCount > 30) errors.push(`Canonical skill is too long: ${skill.name} (${lineCount} lines)`);
      if (wordCount(skillContent) > 220) errors.push(`Canonical skill exceeds 220 words: ${skill.name}`);
    }
  }

  return { errors, canonical, aliases, discovered, descriptions };
}

export function summarizeSkillDescription(description) {
  return String(description || "")
    .split(/\.\s+Use\b/, 1)[0]
    .trim()
    .replace(/\.$/, "");
}

export function renderSkillCatalog(catalog = loadSkillCatalog(), discovered = discoverSkillDefinitions()) {
  const validation = validateSkillCatalog(catalog, discovered);
  if (validation.errors.length) throw new Error(validation.errors.join("\n"));

  const descriptions = validation.descriptions;
  const lines = [`Database skills (${validation.canonical.length})`, ""];
  for (const category of catalog.categories) {
    lines.push(category.name);
    for (const name of category.skills) {
      lines.push(`- ${name} — ${summarizeSkillDescription(descriptions.get(name))}.`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function run(argv = process.argv.slice(2)) {
  const catalog = loadSkillCatalog();
  const validation = validateSkillCatalog(catalog);
  if (validation.errors.length) {
    console.error(validation.errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ count: validation.canonical.length, categories: catalog.categories }, null, 2));
    return;
  }
  if (argv.includes("--check")) {
    console.log(
      `Database skill catalog valid: ${validation.canonical.length} canonical skills, ${validation.aliases.length} aliases.`,
    );
    return;
  }
  console.log(renderSkillCatalog(catalog));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) run();
