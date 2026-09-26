#!/usr/bin/env node
// Generated "Areas" section of docs/codebase-index.md (organisation framework, stage 3).
//
// It lists only slow-changing facts from docs/organisation/systems/*.json: each area, the job it
// owns and its canonical docs. No file counts and no file lists, so moving, adding or renaming
// files never makes it stale; only editing an area file does. Canonical docs are plain text,
// not code spans, so the docs link checker never turns a PR red because a doc moved (moves are
// warnings in the organisation check, never failures).
//
// The section sits between two marker comments that are placed by hand OUTSIDE every range that
// scripts/check-codebase-index-coverage.mjs reads, so it can never satisfy that coverage check.
//
// Usage: node scripts/organisation/codebase-index-section.mjs [--write] [--root <dir>]
//   (no flag)  print the section
//   --write    rewrite the section in place (the pre-commit docs sync runs this)
// Exit: 0 done; 1 the map or the markers cannot be read (nothing is written).
//
// Node built-ins only, so the pre-commit hook can run it before dependencies are installed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INDEX_PATH = "docs/codebase-index.md";
export const SYSTEMS_DIR = "docs/organisation/systems";
export const SECTION_START = "<!-- organisation-areas:start -->";
export const SECTION_END = "<!-- organisation-areas:end -->";
const GENERATOR = "node scripts/organisation/codebase-index-section.mjs --write";

class SectionError extends Error {}

function oneLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

/** Reads every area file in the working tree and keeps only the fields the section shows. */
export function readAreas(root) {
  const dir = path.join(root, SYSTEMS_DIR);
  if (!fs.existsSync(dir)) throw new SectionError(`${SYSTEMS_DIR}/ does not exist`);
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new SectionError(`${SYSTEMS_DIR}/ has no area files`);
  return files.map((name) => {
    const where = `${SYSTEMS_DIR}/${name}`;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    } catch (error) {
      throw new SectionError(`${where} is not valid JSON: ${error.message}`);
    }
    for (const field of ["id", "name", "owns"]) {
      if (typeof data?.[field] !== "string" || !data[field].trim()) {
        throw new SectionError(`${where} needs a \`${field}\``);
      }
    }
    if (!["area", "workstream"].includes(data.kind)) {
      throw new SectionError(`${where}: kind must be \`area\` or \`workstream\``);
    }
    const docs = Array.isArray(data.canonicalDocs) ? data.canonicalDocs : [];
    if (docs.some((doc) => typeof doc !== "string" || !doc.trim())) {
      throw new SectionError(`${where}: every canonical doc must be a path`);
    }
    return {
      id: oneLine(data.id),
      name: oneLine(data.name),
      kind: data.kind,
      owns: oneLine(data.owns),
      canonicalDocs: docs.map(oneLine),
    };
  });
}

function areaItem(area) {
  const docs = area.canonicalDocs.length ? area.canonicalDocs.join(", ") : "none listed";
  return [`- **${area.name}** (\`${area.id}\`): ${area.owns}`, `  Canonical docs: ${docs}`];
}

/** The whole generated block, markers included, as lines. Deterministic for a given map. */
export function renderAreasSection(areas) {
  const byName = (a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en");
  const mainAreas = areas.filter((area) => area.kind === "area").sort(byName);
  const workstreams = areas.filter((area) => area.kind === "workstream").sort(byName);
  const lines = [
    SECTION_START,
    `<!-- Generated from the area files in ${SYSTEMS_DIR}/ by ${GENERATOR} (the pre-commit docs sync runs it). Edit those files, not this section. -->`,
    "",
    "## Areas (organisation map)",
    "",
    "Every tracked file belongs to one area of the organisation map, and an area describes a job, never a page or a mode. " +
      "The guide is `docs/organisation/README.md`; `npm run check:organisation -- --files <path>` names the area that owns a file. " +
      "This section lists only each area's job and canonical docs, so moving files never makes it stale.",
    "",
    ...mainAreas.flatMap(areaItem),
  ];
  if (workstreams.length) lines.push("", "Workstreams cut across the areas:", "", ...workstreams.flatMap(areaItem));
  lines.push("", SECTION_END);
  return lines;
}

function markerLines(lines, marker) {
  return lines.flatMap((line, index) => (line.trim() === marker ? [index] : []));
}

/** Replaces the block between the markers. Refuses unless each marker appears exactly once, in order. */
export function replaceSection(indexText, sectionLines) {
  const eol = indexText.includes("\r\n") ? "\r\n" : "\n";
  const lines = indexText.split(/\r?\n/);
  const starts = markerLines(lines, SECTION_START);
  const ends = markerLines(lines, SECTION_END);
  if (starts.length !== 1 || ends.length !== 1 || starts[0] > ends[0]) {
    throw new SectionError(
      `${INDEX_PATH} must hold \`${SECTION_START}\` and \`${SECTION_END}\` exactly once each, in that order ` +
        `(found ${starts.length} and ${ends.length}); place them by hand outside the ranges the index coverage check reads`,
    );
  }
  return [...lines.slice(0, starts[0]), ...sectionLines, ...lines.slice(ends[0] + 1)].join(eol);
}

function readIndex(root) {
  const file = path.join(root, INDEX_PATH);
  if (!fs.existsSync(file)) throw new SectionError(`${INDEX_PATH} does not exist`);
  return fs.readFileSync(file, "utf8");
}

/** The index text with the section regenerated from the current map. */
export function regeneratedIndex(root) {
  return replaceSection(readIndex(root), renderAreasSection(readAreas(root)));
}

/**
 * A warning when the generated section no longer matches the map (or cannot be checked), else
 * null. Advisory only: it never throws, so a caller can show it without failing.
 */
export function indexSectionDrift({ root }) {
  try {
    if (regeneratedIndex(root) === readIndex(root)) return null;
    return `the Areas section of ${INDEX_PATH} is out of date with the organisation map; run \`${GENERATOR}\``;
  } catch (error) {
    return `the Areas section of ${INDEX_PATH} could not be checked: ${error.message}`;
  }
}

/** Rewrites the section in place when it differs. Returns true when the file changed. */
export function writeSection(root) {
  const current = readIndex(root);
  const next = regeneratedIndex(root);
  if (next === current) return false;
  fs.writeFileSync(path.join(root, INDEX_PATH), next);
  return true;
}

export function main(argv = process.argv.slice(2)) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  let write = false;
  try {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--write") write = true;
      else if (argv[i] === "--root" && argv[i + 1]) root = path.resolve(argv[++i]);
      else throw new SectionError(`unknown argument ${argv[i]}`);
    }
    if (!write) {
      console.log(renderAreasSection(readAreas(root)).join("\n"));
      return 0;
    }
    const changed = writeSection(root);
    console.log(`codebase-index-section: ${changed ? "regenerated" : "already current"} (${INDEX_PATH})`);
    return 0;
  } catch (error) {
    const message = error instanceof SectionError ? error.message : `crashed: ${error?.stack ?? error}`;
    console.error(`codebase-index-section: ${message}`);
    return 1;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
