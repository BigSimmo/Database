import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Ward Flow's seam with the rest of this repository.
 *
 * WHY THIS EXISTS. Ward Flow is a synthetic, offline prototype living inside a clinical knowledge
 * base that has nothing to do with bed flow. It stays here on purpose, because it gets the Next 16
 * setup, the design tokens, the test harness and the accumulated rules for free. The day it stops
 * being a prototype — a real address, real data, its own release cadence — it has to leave, and the
 * only thing deciding whether leaving costs an afternoon or a fortnight is how many places it
 * touches the host.
 *
 * Measured 2026-08-29 across `main`, `claude/ward-flow-ward-board` and
 * `claude/ward-flow-phases-6-7-design`, and identical on all three: SEVEN shared modules reached
 * outward across twelve import statements, ZERO imports reaching in, and FOUR hardcoded references
 * to the ward route outside Ward Flow's own folders. That is the entire bill for extraction.
 *
 * Nothing here protects correctness. It protects the exit door. A dependency added for convenience
 * is invisible at the time and expensive later — exactly the kind of cost nobody notices accruing —
 * so this test makes widening the seam a decision someone has to make out loud.
 *
 * THE TEST IS THE RULE. There is deliberately no prose copy in AGENTS.md or CLAUDE.md: a second
 * statement of the same fact drifts from the enforced one, and this project has already spent a day
 * discovering what happens when prose and code disagree about a number. The reasoning lives in this
 * header, where it travels with the assertions it explains.
 *
 * HOW TO READ A FAILURE. The three invariants below are exact and must never move. The
 * shared-module list is a CEILING, not a measurement: if it fires, the fix is a stated reason for
 * the new dependency, not a re-measurement. A ratchet that gets re-baselined whenever it fires is
 * not a ratchet — this repository has already produced several checks that could not fail, and
 * "somebody updated the expected number" is how the next one would arrive.
 */

const WARD_DIRS = ["src/components/ward-management", "src/app/mockups/ward-flow"];

/**
 * The shared modules Ward Flow may reach outward for, each with the reason it is not worth
 * duplicating. This is a ceiling. An eighth entry is not a measurement error to be corrected; it is
 * a decision, and it needs its reason written beside it here before this list grows.
 */
const APPROVED_SHARED_MODULES = new Map([
  ["@/components/ui-primitives", "the repository's buttons and form controls"],
  [
    "@/components/clinical-dashboard/brand",
    "the product wordmark, so the prototype is not misread as a separate product",
  ],
  ["@/components/ui/sheet", "the slide-over panel primitive"],
  ["@/components/developer-area/developer-area-gate", "the administrator gate that keeps Ward Flow out of production"],
  ["@/components/contextual-back-link", "shared back navigation"],
  ["@/lib/form-register", "shared form registration"],
  ["@/lib/client-store-factory", "shared client-side store helper"],
]);

/**
 * Files outside Ward Flow that hardcode its route. Not imports, so there is no code coupling — but
 * every one needs editing on the day Ward Flow leaves, so a guard counting only imports would
 * report a seam of seven when it is seven plus these. Named individually rather than counted,
 * because a count of four tells the next reader nothing about which four are legitimate.
 */
const APPROVED_ROUTE_REFERENCES = new Map([
  ["src/lib/developer-area/hub-panels.ts", "the developer hub tile linking to Ward Flow"],
  ["src/lib/developer-area/headers.ts", "route list for the developer-area header"],
  ["src/proxy.ts", "the constellation-to-network redirect kept for historical deep links"],
  ["src/app/mockups/mockups-layout-client.tsx", "hides the mockups chrome on ward routes"],
]);

const WARD_ROUTE_LITERAL = "mockups/ward-flow";

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function sourceFiles(dir: string): string[] {
  return walk(dir)
    .map(toPosix)
    .filter((file) => /\.tsx?$/.test(file));
}

function isWardPath(path: string): boolean {
  return WARD_DIRS.some((dir) => path === dir || path.startsWith(dir + "/"));
}

/**
 * Every static module specifier in a file: `import ... from`, bare `import "..."`, and
 * `export ... from`. Parsed with the TypeScript compiler rather than matched with a regex, so a
 * path named in a comment or a string is not mistaken for a dependency — several files here discuss
 * the ward route in prose, and one of them is on the approved list for an unrelated reason.
 */
function moduleSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

/** Resolve a specifier to a repo-relative path, or null when it is a bare package (react, next). */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return "src/" + specifier.slice(2);
  if (specifier.startsWith(".")) {
    return toPosix(relative(resolve("."), resolve(posix.dirname(fromFile), specifier)));
  }
  return null;
}

describe("ward flow keeps its seam with the rest of the repository", () => {
  const wardFiles = WARD_DIRS.flatMap(sourceFiles);
  const allSourceFiles = sourceFiles("src");

  it("reaches outward for no shared module beyond the approved seven", () => {
    const reached = new Map<string, string[]>();
    for (const file of wardFiles) {
      for (const specifier of moduleSpecifiers(file)) {
        if (!specifier.startsWith("@/")) continue;
        const target = resolveSpecifier(file, specifier);
        if (target && isWardPath(target)) continue;
        if (APPROVED_SHARED_MODULES.has(specifier)) continue;
        reached.set(specifier, [...(reached.get(specifier) ?? []), file]);
      }
    }

    expect(
      [...reached].map(([specifier, files]) => specifier + " <- " + files.join(", ")),
      "Ward Flow reached outward for a shared module that is not on the approved list. This is a " +
        "ceiling, not a measurement: do not add the module to APPROVED_SHARED_MODULES merely to " +
        "make this pass. Every entry is a line item in the cost of ever extracting Ward Flow, so " +
        "add it only with a stated reason beside it — or import nothing and leave the seam alone.",
    ).toEqual([]);
  });

  it("has nothing outside it importing ward code", () => {
    const inbound: string[] = [];
    for (const file of allSourceFiles) {
      if (isWardPath(file)) continue;
      for (const specifier of moduleSpecifiers(file)) {
        const target = resolveSpecifier(file, specifier);
        if (target && isWardPath(target)) inbound.push(file + " -> " + specifier);
      }
    }

    expect(
      inbound,
      "Something outside Ward Flow imported ward code. Invariant, not a budget: the prototype is a " +
        "leaf, and the moment the host app depends on it, extracting it stops being a folder move " +
        "and becomes a refactor of the host.",
    ).toEqual([]);
  });

  it("never reaches outward by relative path", () => {
    const escapes: string[] = [];
    for (const file of wardFiles) {
      for (const specifier of moduleSpecifiers(file)) {
        if (!specifier.startsWith(".")) continue;
        const target = resolveSpecifier(file, specifier);
        if (target && !isWardPath(target)) escapes.push(file + " -> " + specifier);
      }
    }

    expect(
      escapes,
      "Ward Flow reached outside its own folders with a relative import. Invariant: a relative " +
        "escape is a dependency the approved-module ceiling above cannot see, so it would widen the " +
        "seam without ever failing that check.",
    ).toEqual([]);
  });

  it("has its route hardcoded outside itself only in the four known places", () => {
    const unexpected = allSourceFiles
      .filter((file) => !isWardPath(file))
      .filter((file) => !APPROVED_ROUTE_REFERENCES.has(file))
      .filter((file) => readFileSync(file, "utf8").includes(WARD_ROUTE_LITERAL));

    expect(
      unexpected,
      "A file outside Ward Flow hardcoded its route. These are not imports, so nothing else catches " +
        "them, and each is a file needing an edit on the day Ward Flow leaves. Name it in " +
        "APPROVED_ROUTE_REFERENCES with its reason, or route around it.",
    ).toEqual([]);
  });

  it("still knows what the seam costs", () => {
    // A canary for the lists above being quietly emptied, and for the scan losing its place. A test
    // asserting only "no violations" passes exactly as cleanly when its allowlists have been
    // deleted, or when it scanned nothing at all, as when the code is right. An absent signal reads
    // exactly like a passing one.
    expect(APPROVED_SHARED_MODULES.size).toBe(7);
    expect(APPROVED_ROUTE_REFERENCES.size).toBe(4);
    expect(wardFiles.length).toBeGreaterThan(50);
    expect(allSourceFiles.length).toBeGreaterThan(wardFiles.length);
  });
});
