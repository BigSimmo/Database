#!/usr/bin/env node
/**
 * list-database-skills.mjs — list Database workflow skills under .agents/skills
 * and verify the catalog stays in sync.
 *
 * npm run skills        — print skill names and descriptions
 * npm run check:skills  — fail if filesystem skills and database-skills.md diverge
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, ".agents", "skills");
const catalogPath = path.join(skillsRoot, "database-skills.md");

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

/** Discover workflow skills from immediate child directories containing SKILL.md. */
export function discoverSkills(root = skillsRoot, readFile = (filePath) => readFileSync(filePath, "utf8")) {
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return entries.map((id) => {
    const skillPath = path.join(root, id, "SKILL.md");
    if (!statSync(skillPath, { throwIfNoEntry: false })?.isFile()) {
      return { id, name: id, description: "", missingSkillFile: true };
    }
    const frontmatter = parseFrontmatter(readFile(skillPath));
    return {
      id,
      name: frontmatter.name ?? id,
      description: frontmatter.description ?? "",
      missingSkillFile: false,
    };
  });
}

/** Extract backtick skill ids from the maintained catalog markdown. */
export function extractCatalogSkillIds(catalogMarkdown) {
  const ids = new Set();
  for (const match of catalogMarkdown.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)) {
    ids.add(match[1]);
  }
  return [...ids].sort();
}

/** Return drift between discovered skills and the catalog. */
export function findSkillDrift(skills, catalogIds) {
  const discoveredIds = skills.filter((skill) => !skill.missingSkillFile).map((skill) => skill.id);
  const discovered = new Set(discoveredIds);
  const catalog = new Set(catalogIds);
  const missingFromCatalog = discoveredIds.filter((id) => !catalog.has(id));
  const missingFromDisk = catalogIds.filter((id) => !discovered.has(id));
  const nameMismatches = skills
    .filter((skill) => !skill.missingSkillFile && skill.name !== skill.id)
    .map((skill) => ({ id: skill.id, name: skill.name }));
  const missingSkillFiles = skills.filter((skill) => skill.missingSkillFile).map((skill) => skill.id);
  return { missingFromCatalog, missingFromDisk, nameMismatches, missingSkillFiles };
}

function printSkills(skills) {
  const available = skills.filter((skill) => !skill.missingSkillFile);
  console.log(`Database skills (${available.length}):`);
  for (const skill of available) {
    const description = skill.description || "(no description)";
    console.log(`- ${skill.id} — ${description}`);
  }
}

function main() {
  const checkMode = process.argv.includes("--check");
  const skills = discoverSkills();
  const catalogMarkdown = readFileSync(catalogPath, "utf8");
  const catalogIds = extractCatalogSkillIds(catalogMarkdown);
  const drift = findSkillDrift(skills, catalogIds);

  if (!checkMode) {
    printSkills(skills);
    return;
  }

  const problems = [];
  if (drift.missingSkillFiles.length) {
    problems.push(`missing SKILL.md: ${drift.missingSkillFiles.join(", ")}`);
  }
  if (drift.nameMismatches.length) {
    problems.push(
      `frontmatter name mismatch: ${drift.nameMismatches.map((item) => `${item.id} -> ${item.name}`).join(", ")}`,
    );
  }
  if (drift.missingFromCatalog.length) {
    problems.push(`not listed in database-skills.md: ${drift.missingFromCatalog.join(", ")}`);
  }
  if (drift.missingFromDisk.length) {
    problems.push(`catalog entries without skill directories: ${drift.missingFromDisk.join(", ")}`);
  }

  if (problems.length > 0) {
    console.error("skills check FAILED:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  console.log(`skills check passed: ${skills.length} workflow skill(s) match database-skills.md.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
