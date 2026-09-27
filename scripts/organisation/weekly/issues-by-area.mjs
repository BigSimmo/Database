// Weekly report section: open outstanding-issues items grouped by area (organisation framework
// suggestion 4, "one health view per area"). It adds no ledger and edits nothing: it reads the
// committed snapshot's open[] list, and only each item's summary and detail text.
//
// An item's areas come from the tracked files its text names, looked up in the organisation map.
// Files the map ignores do not count, and docs/** or a root instruction file counts only when no
// other named path gives an area. An `[area:<id>]` tag anywhere in the text overrides the
// lookup. Items naming no placed file land in "No area"; items reaching two or more areas land in
// "Spans areas" (and are not also counted inside each area).
import fs from "node:fs";
import path from "node:path";
import { areasOf, inlineCode, loadPlacement, oneLine, orderedSystems } from "../weekly-lib.mjs";

export const SNAPSHOT_PATH = "data/outstanding-issues-snapshot.json";
const AREA_TAG = /\[area:\s*([A-Za-z0-9_-]+)\s*\]/g;

/** The open items, reduced to id, priority and the summary + detail text. */
export function loadOpenItems(root) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(root, SNAPSHOT_PATH), "utf8"));
  } catch (error) {
    throw new Error(`${SNAPSHOT_PATH} could not be read: ${error.message}`);
  }
  if (!Array.isArray(data?.open)) throw new Error(`${SNAPSHOT_PATH} has no open[] list`);
  const items = data.open.map((row, index) => {
    if (!row || typeof row.id !== "string" || !row.id.trim())
      throw new Error(`${SNAPSHOT_PATH} open[${index}] has no id`);
    const priority = typeof row.priority === "string" && row.priority.trim() ? row.priority.trim() : "unprioritised";
    const text = [row.summary, row.detail].filter((part) => typeof part === "string").join("\n");
    return { id: row.id.trim(), priority, text };
  });
  const revision = typeof data.ledger_revision?.committed_at === "string" ? data.ledger_revision.committed_at : null;
  return { items, revision };
}

/** Lookup tables for turning a path named in prose into areas. */
export function buildPathIndex(files, placement) {
  const fileAreas = new Map();
  const byBasename = new Map();
  const dirAreas = new Map();
  for (const file of files) {
    // Ignored files stay in the tables (so a basename is only "unique" if it really is) but never
    // contribute an area.
    const areas = placement[file] === "(ignored)" ? [] : areasOf(placement[file]);
    fileAreas.set(file, areas);
    const base = file.slice(file.lastIndexOf("/") + 1);
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base).push(file);
    for (let slash = file.indexOf("/"); slash !== -1; slash = file.indexOf("/", slash + 1)) {
      const dir = file.slice(0, slash);
      if (!dirAreas.has(dir)) dirAreas.set(dir, new Set());
      for (const area of areas) dirAreas.get(dir).add(area);
    }
  }
  return { fileAreas, byBasename, dirAreas };
}

// The spellings a path takes in prose: wrapped in brackets or quotes, followed by punctuation, a
// line number (`rag.ts:40-59`), an anchor (`#L10`), or a trailing glob (`src/lib/rag/**`).
function candidatesFor(token) {
  const out = [];
  const add = (value) => {
    if (value && !out.includes(value)) out.push(value);
  };
  add(token);
  let clean = token.replace(/^[([{'"]+/, "").replace(/[)\]}.,;:!?'"]+$/, "");
  add(clean);
  clean = clean
    .replace(/#.*$/, "")
    .replace(/:\d+(?:[-–]\d+)?(?::\d+)?$/, "")
    .replace(/\/\*\*?$/, "")
    .replace(/\/$/, "")
    .replace(/^\.\//, "");
  add(clean);
  return out.filter((value) => value.length >= 4 && /[A-Za-z]/.test(value) && !value.includes("*"));
}

/** The first tracked file or folder a prose token names, with the areas it stands for. */
export function resolvePathToken(token, index) {
  for (const candidate of candidatesFor(token)) {
    if (index.fileAreas.has(candidate)) return { path: candidate, areas: index.fileAreas.get(candidate) };
    // A folder counts only when every placed file beneath it sits in one area.
    const dir = index.dirAreas.get(candidate);
    if (dir) return { path: `${candidate}/`, areas: dir.size === 1 ? [...dir] : [] };
    // A bare file name, or the tail of a path (`rag/rag-provider.ts`), counts only when exactly one
    // tracked file ends that way.
    const base = candidate.slice(candidate.lastIndexOf("/") + 1);
    if (!/\.[A-Za-z0-9]+$/.test(base)) continue;
    const sameName = index.byBasename.get(base) ?? [];
    const matches = candidate.includes("/") ? sameName.filter((file) => file.endsWith(`/${candidate}`)) : sameName;
    if (matches.length === 1) return { path: matches[0], areas: index.fileAreas.get(matches[0]) };
    if (matches.length > 1) return null;
  }
  return null;
}

const ROOT_INSTRUCTION_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);

/** A document or root instruction file: `docs/**`, `AGENTS.md` or `CLAUDE.md`. */
export function isDocPath(file) {
  return ROOT_INSTRUCTION_FILES.has(file) || file === "docs/" || file.startsWith("docs/");
}

/**
 * The areas one item belongs to.
 * @returns {{ areas: string[], by: "tag" | "paths", paths: string[], unknownTags: string[] }}
 */
export function deriveAreas(text, index, knownAreas) {
  const tags = [...text.matchAll(AREA_TAG)].map((match) => match[1].toLowerCase());
  const valid = [...new Set(tags.filter((id) => knownAreas.has(id)))].sort();
  const unknownTags = [...new Set(tags.filter((id) => !knownAreas.has(id)))].sort();
  if (valid.length) return { areas: valid, by: "tag", paths: [], unknownTags };
  const hits = [];
  for (const token of text.split(/[\s`<>|,;]+/)) {
    if (!/[/.]/.test(token)) continue;
    const hit = resolvePathToken(token, index);
    if (hit) hits.push(hit);
  }
  // Items often cite a document or the root instructions beside the code they are about. When a
  // non-document path gives an area, those citations do not add areas of their own, so an item
  // does not "span areas" merely because it points at a doc.
  const code = hits.filter((hit) => !isDocPath(hit.path));
  const counted = code.some((hit) => hit.areas.length) ? code : hits;
  const areas = new Set(counted.flatMap((hit) => hit.areas));
  const paths = new Set(counted.map((hit) => hit.path));
  return { areas: [...areas].sort(), by: "paths", paths: [...paths].sort(), unknownTags };
}

function priorityOrder(a, b) {
  const rank = (p) => (/^P\d+$/i.test(p) ? Number(p.slice(1)) : p === "unprioritised" ? 10_000 : 1_000);
  return rank(a) - rank(b) || a.localeCompare(b);
}

const safeId = (id) => inlineCode(oneLine(id, 40));

function byPriority(items, priorities) {
  const lines = [];
  for (const priority of priorities) {
    const ids = items.filter((item) => item.priority === priority).map((item) => safeId(item.id));
    if (ids.length) lines.push(`- **${oneLine(priority, 20)}** (${ids.length}): ${ids.join(", ")}`);
  }
  return lines;
}

/** Groups items and renders the section. Exported for tests; `section` wires it to the repo. */
export function renderIssuesByArea({ items, revision, systems, index }) {
  const ordered = orderedSystems(systems);
  const known = new Set(ordered.map((system) => system.id));
  const groups = new Map(ordered.map((system) => [system.id, []]));
  const spans = [];
  const none = [];
  const unknown = [];
  for (const item of items) {
    const derived = deriveAreas(item.text, index, known);
    if (derived.unknownTags.length) unknown.push({ item, tags: derived.unknownTags });
    if (derived.areas.length === 0) none.push(item);
    else if (derived.areas.length === 1) groups.get(derived.areas[0]).push(item);
    else spans.push({ item, areas: derived.areas });
  }
  const priorities = [...new Set(items.map((item) => item.priority))].sort(priorityOrder);
  const count = (list, priority) => list.filter((item) => item.priority === priority).length;
  const row = (label, list, spanning) =>
    `| ${label} | ${list.length} | ${priorities.map((p) => count(list, p)).join(" | ")} | ${spanning} |`;

  const lines = [
    `${items.length} open item${items.length === 1 ? "" : "s"} in the outstanding-issues snapshot${revision ? ` (ledger revision ${oneLine(revision, 40)})` : ""}. Each item is placed by the tracked files its summary and detail name, looked up in the organisation map; files the map ignores do not count, and an \`[area:<id>]\` tag in the item's text overrides the lookup. Nothing here edits the ledger.`,
    "",
    `| Area | Open | ${priorities.map((p) => oneLine(p, 20)).join(" | ")} | Also in items spanning areas |`,
    `| --- | ---: | ${priorities.map(() => "---:").join(" | ")} | ---: |`,
  ];
  for (const system of ordered) {
    const spanning = spans.filter((entry) => entry.areas.includes(system.id)).length;
    const label = `${oneLine(system.name, 60)}${system.kind === "workstream" ? " (workstream)" : ""} (${inlineCode(system.id)})`;
    lines.push(row(label, groups.get(system.id), spanning));
  }
  lines.push(
    row(
      "**Spans areas**",
      spans.map((entry) => entry.item),
      "",
    ),
  );
  lines.push(row("**No area**", none, ""));

  for (const system of ordered) {
    const list = groups.get(system.id);
    if (!list.length) continue;
    lines.push("", `### ${oneLine(system.name, 60)} (${inlineCode(system.id)})`, "", ...byPriority(list, priorities));
  }
  lines.push("", "### Spans areas", "");
  if (spans.length) {
    for (const { item, areas } of [...spans].sort((a, b) => priorityOrder(a.item.priority, b.item.priority))) {
      lines.push(`- ${safeId(item.id)} (${oneLine(item.priority, 20)}): ${areas.map(inlineCode).join(", ")}`);
    }
  } else lines.push("None.");
  lines.push("", "### No area", "");
  if (none.length) {
    lines.push(
      "These name no tracked file the map places. Add an `[area:<id>]` tag to an item's text to place it.",
      "",
      ...byPriority(none, priorities),
    );
  } else lines.push("None.");
  if (unknown.length) {
    lines.push("", "### Unknown area tags", "");
    for (const { item, tags } of unknown) {
      lines.push(
        `- ${safeId(item.id)} names ${tags.map(inlineCode).join(", ")}, which is not an area, so the files it names decided instead.`,
      );
    }
  }
  return lines.join("\n");
}

export async function section({ root }) {
  const { items, revision } = loadOpenItems(root);
  const { files, placement, systems } = loadPlacement(root);
  const index = buildPathIndex(files, placement);
  return { title: "Open issues by area", markdown: renderIssuesByArea({ items, revision, systems, index }) };
}
