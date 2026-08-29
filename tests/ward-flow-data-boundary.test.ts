import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { allEmergencyDepartments, allUnits, wardSites } from "@/components/ward-management/ward-sites";

/**
 * Ward Flow's changeable data lives in the data files, and screens read it rather than stating it.
 *
 * WHY THIS EXISTS. The owner's instruction, in his words: make everything liable to change — wards,
 * distances, options, place names, bed numbers — "very easy to edit and change ... so they can be
 * edited in the future when i put in real parts, and also to allow real parts changing in real life
 * as well ... i.e. building another hospital or more beds". The whole invented network is a
 * placeholder for real WA figures he will supply.
 *
 * That is only cheap if every fact has ONE home. A hospital name typed into a screen reads as
 * clearer than a lookup at the moment it is written, and the next twelve tasks are all screen work —
 * so this is exactly the property that decays quietly. It is true today, which is the only moment it
 * is cheap to pin.
 *
 * WHAT THIS DOES NOT DO. It does not check that the data is right, or that a screen renders it. It
 * checks one thing: that no file outside the data layer STATES a name the data layer owns.
 *
 * HOW IT AVOIDS THE TRAP THAT NEARLY BROKE ITS OWN DESIGN. A plain text scan flags prose. Three
 * files outside the data layer legitimately DISCUSS specific wards in comments —
 * `ed/ed-screen.tsx` explains a cohort rule by naming Bentley, `morning/morning.module.css`
 * explains an empty state by naming Joondalup and Peel, and this repository has already had one
 * measurement go wrong by counting a comment as a use (an `exampleOnly:` count that read 3/4/3
 * because a comment described the flag). So this parses with the TypeScript compiler and inspects
 * STRING LITERALS ONLY. A comment naming a ward is documentation; a string literal naming one is a
 * second home for the fact.
 *
 * WHY THE EXPECTED NAMES COME FROM THE DATA. Deriving an expectation from the thing it checks is
 * usually how a check that cannot fail gets built — `ward-admissions-seed.ts` refuses exactly that
 * in its own header. It is safe here because the assertion is not about the data layer at all: the
 * names are the SUBJECT, and the claim is about every OTHER file. If a ward is renamed, this test
 * follows the rename automatically and keeps checking the same property, which is the behaviour the
 * owner asked for.
 */

/**
 * The data layer, named individually with what each owns. A tenth entry is a decision: it means a
 * new home for changeable facts, and it needs its reason written here beside the others.
 *
 * Nine, not the five an earlier survey reported — all nine verified present on this branch.
 */
const DATA_LAYER = new Map([
  ["src/components/ward-management/ward-sites.ts", "the network: sites, units, EDs, bed counts, sex mix"],
  ["src/components/ward-management/ward-model.ts", "the vocabulary: regions, cohorts, security levels, stages"],
  ["src/components/ward-management/ward-movements.ts", "the seeded movements through the network"],
  ["src/components/ward-management/ward-admissions-seed.ts", "the people occupying beds"],
  ["src/components/ward-management/ward-teams.ts", "a community team per WA region"],
  ["src/components/ward-management/ward-travel-bands.ts", "travel bands between regions"],
  ["src/components/ward-management/ward-distance.ts", "the region-to-site distance table"],
  ["src/components/ward-management/ward-referrals.ts", "the seeded referrals"],
  ["src/components/ward-management/ward-scenarios.ts", "named scenarios over the seeded network"],
]);

/**
 * Ward Flow's own folders, and nothing else. The first run of this test scanned all of `src` and
 * flagged eleven literals in `src/lib/document-organization.ts` and `src/lib/source-authority-registry.ts`
 * — the clinical knowledge base naming real WA hospitals because its documents come from them. Those
 * are the HOST application's own data, they predate Ward Flow, and they are none of its business.
 * The collision exists only because Ward Flow's invented network borrowed real hospital names.
 *
 * A check that fires is a question, not a verdict. The right answer was to scope the claim to what
 * it actually means — no WARD FLOW file outside the data layer states a name the data layer owns —
 * rather than to allowlist eleven innocent lines and leave the scope wrong.
 */
const WARD_DIRS = ["src/components/ward-management", "src/app/mockups/ward-flow"];

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function sourceFiles(): string[] {
  return WARD_DIRS.flatMap((dir) => walk(dir))
    .map(toPosix)
    .filter((file) => /\.tsx?$/.test(file));
}

/**
 * Every string literal in a file, from the TypeScript parser — so comments and identifiers are not
 * mistaken for uses. Template literals are included: a name interpolated into one is still stated.
 */
function stringLiterals(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const literals: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)) {
      literals.push(node.text);
    } else if (ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      literals.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return literals;
}

/** The names the data layer owns. Multi-word and distinctive; single common words are excluded
 *  below because "Peel" is both an emergency department and a WA region, and a bare token would
 *  produce false positives no reader could act on. */
function ownedNames(): string[] {
  const names = [
    ...wardSites.map((site) => site.name),
    ...allUnits().map((unit) => unit.name),
    ...allEmergencyDepartments().map((ed) => ed.name),
  ];
  return [...new Set(names)].filter((name) => name.trim().split(/\s+/).length > 1);
}

describe("ward flow keeps its changeable data in one place", () => {
  const owned = ownedNames();
  const files = sourceFiles();
  const outsideDataLayer = files.filter((file) => !DATA_LAYER.has(file));

  it("knows what it is checking and what it is checking against", () => {
    // The canary. Every assertion below passes by finding no violations, which reads identically to
    // an empty name list or a scan that found no files. An absent signal reads exactly like a
    // passing one.
    expect(owned.length).toBeGreaterThan(20);
    expect(DATA_LAYER.size).toBe(9);
    expect(outsideDataLayer.length).toBeGreaterThan(40);
    for (const file of DATA_LAYER.keys()) {
      expect(files, `${file} is named in DATA_LAYER but is not on disk`).toContain(file);
    }
  });

  it("has no file outside the data layer stating a ward, site or department name", () => {
    const offenders: string[] = [];
    for (const file of outsideDataLayer) {
      const stated = new Set(stringLiterals(file).filter((literal) => owned.includes(literal.trim())));
      for (const name of stated) offenders.push(`${file} states "${name}"`);
    }

    expect(
      offenders.sort(),
      "A file outside the data layer states a name the data layer owns. The owner will replace this " +
        "invented network with real WA figures, and every second home for a fact is a place that " +
        "silently disagrees with the first after that swap. Read the name from ward-sites.ts rather " +
        "than typing it — and if a file genuinely must own network facts, add it to DATA_LAYER with " +
        "its reason, which is a decision rather than a formality.",
    ).toEqual([]);
  });
});
