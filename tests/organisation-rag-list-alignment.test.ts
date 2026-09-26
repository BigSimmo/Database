// tests/organisation-rag-list-alignment.test.ts
//
// AGENTS.md "# RAG ranking protection" tells every agent which files are ranking-protected, and
// `ragRankingPatterns` in scripts/pr-policy.mjs is the list the PR gate actually enforces. When
// the two drift, an agent is told a file is protected while a PR changing it sails through with
// no `RAG impact:` prompt. This test checks one direction: every code path the section names in
// backticks is classified `ragRanking` by pr-policy. (The other direction is deliberately not
// checked: pr-policy may protect more than the prose lists.)
//
// Parsing rules, kept small on purpose:
// - Only backticked paths under src/, scripts/, worker/, tests/ or supabase/ count. Docs paths and prose
//   ("the retrieval RPCs", `pr-policy`, `applyMemoryCardBoosts`) are ignored.
// - A trailing `/**` or `/` marks a folder; a probe file inside it must be classified.
// - A bare file name such as `keyword-query.ts` is shorthand for the folder of the nearest
//   backticked path before it in the same list item, which is how the section writes lists. The
//   file it resolves to must exist, so a wrong guess fails instead of checking a made-up path.
// - `scripts/pr-policy.mjs` is named as the home of the list, not as a protected file.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { classifyPullRequestFiles } from "../scripts/pr-policy.mjs";

const SECTION_HEADING = "# RAG ranking protection";
const CODE_ROOTS = /^(?:src|scripts|worker|tests|supabase)\//;
const BARE_FILE_NAME = /^[\w.-]+\.(?:ts|tsx|mts|cts|js|mjs|cjs|py|json|sql)$/;
const FOLDER_PROBE = "__organisation_alignment_probe__.ts";

// Named in the section as where the list lives, not as a protected surface.
const NAMED_AS_LIST_HOME = new Set(["scripts/pr-policy.mjs"]);

function ragSection(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === SECTION_HEADING);
  if (start === -1) return "";
  let fenced = false;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*(?:```|~~~)/.test(lines[index])) fenced = !fenced;
    if (!fenced && /^# /.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

type NamedPath = { written: string; path: string; folder: boolean; bare: boolean };

function namedCodePaths(section: string): NamedPath[] {
  const named: NamedPath[] = [];
  // Each top-level list item (or the text before the first one) is its own context for shorthand.
  for (const item of section.split(/\n(?=- )/)) {
    let lastFolder = "";
    for (const match of item.matchAll(/`([^`\n]+)`/g)) {
      const written = match[1].trim();
      if (CODE_ROOTS.test(written)) {
        const folder = written.endsWith("/**") || written.endsWith("/");
        const path = written.replace(/\/\*\*$/, "").replace(/\/$/, "");
        lastFolder = folder ? path : path.slice(0, path.lastIndexOf("/"));
        named.push({ written, path, folder, bare: false });
      } else if (BARE_FILE_NAME.test(written) && lastFolder) {
        named.push({ written, path: `${lastFolder}/${written}`, folder: false, bare: true });
      } else if (BARE_FILE_NAME.test(written)) {
        named.push({ written, path: "", folder: false, bare: true });
      }
    }
  }
  return named;
}

const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const section = ragSection(agents);
const named = namedCodePaths(section);
const checked = [
  ...new Map(
    named.filter((entry) => !NAMED_AS_LIST_HOME.has(entry.path)).map((entry) => [entry.path || entry.written, entry]),
  ).values(),
];

describe("AGENTS.md RAG ranking protection section can be read", () => {
  it("finds the section and the code paths it names", () => {
    expect(section, `AGENTS.md has no "${SECTION_HEADING}" heading`).not.toBe("");
    // A floor, so a parser regression cannot pass by finding nothing to check.
    expect(
      checked.length,
      "the section parser found almost no code paths; was the section restructured?",
    ).toBeGreaterThan(10);
  });

  it("can tell which folder every bare file name belongs to", () => {
    const unresolved = named.filter((entry) => entry.path === "").map((entry) => entry.written);
    expect(
      unresolved,
      "these bare file names come before any full path in their list item, so their folder is unknown; write the full path in AGENTS.md",
    ).toEqual([]);
  });

  it("resolves every bare file name to a file that exists", () => {
    const missing = named
      .filter((entry) => entry.bare && entry.path !== "")
      .filter((entry) => !existsSync(new URL(`../${entry.path}`, import.meta.url)))
      .map((entry) => `${entry.written} (read as ${entry.path})`);
    expect(
      missing,
      "these bare file names were read as files in the folder of the path before them, but no such file exists; write the full path in AGENTS.md",
    ).toEqual([]);
  });

  it("names every path it exempts as the list's home", () => {
    for (const exempt of NAMED_AS_LIST_HOME) {
      expect(section, `${exempt} is no longer named in the section; drop it from NAMED_AS_LIST_HOME`).toContain(
        `\`${exempt}\``,
      );
    }
  });
});

describe("every code path AGENTS.md names as ranking-protected is on ragRankingPatterns", () => {
  it.each(checked.filter((entry) => entry.path !== "").map((entry) => [entry.written, entry] as const))(
    "%s",
    (_written, entry) => {
      const probe = entry.folder ? `${entry.path}/${FOLDER_PROBE}` : entry.path;
      expect(
        classifyPullRequestFiles([probe]).ragRanking,
        `AGENTS.md "${SECTION_HEADING}" names \`${entry.written}\`${entry.written === entry.path ? "" : ` (read as ${entry.path})`}, but scripts/pr-policy.mjs does not classify ${entry.folder ? "files in that folder" : "it"} as ranking-protected. Add it to ragRankingPatterns in scripts/pr-policy.mjs. Never remove it from AGENTS.md to make this pass.`,
      ).toBe(true);
    },
  );
});
