import { readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

/**
 * The whole-row click contract for search results.
 *
 * A result row is opened by stretching its existing link across the row with
 * `stretchedRowLinkClass` (see `src/components/card-recipes.ts`). Two things
 * about that are silent when they go wrong, which is why they are pinned here
 * rather than left to review:
 *
 * - The stretch is `position: absolute`, so it resolves against the nearest
 *   *positioned* ancestor. If the row container is not `relative`, the overlay
 *   escapes the row and covers whatever positioned block encloses it — a worse
 *   outcome than not stretching at all, and invisible until something is
 *   unexpectedly unclickable.
 * - The class is one string in one place on purpose. A second copy would go
 *   stale the first time the contract changes, which is exactly what happened
 *   before it was extracted out of `differentials-home.tsx`.
 */

const REPO_ROOT = path.resolve(__dirname, "..");

/** Every production surface that opens its rows by stretching a link. */
const ROW_CLICK_SURFACES = [
  "src/components/clinical-dashboard/differentials-home.tsx",
  "src/components/clinical-dashboard/document-results.tsx",
  "src/components/clinical-dashboard/document-search-results.tsx",
  "src/components/clinical-dashboard/favourites-command-library-page.tsx",
  "src/components/clinical-dashboard/favourites-hub.tsx",
  "src/components/dictionary/dictionary-result-row.tsx",
  "src/components/differentials/differential-stream-workspace.tsx",
  "src/components/dsm/dsm-search-page.tsx",
  "src/components/formulation/formulation-home-page.tsx",
  "src/components/forms/forms-search-results-page.tsx",
  "src/components/services/services-navigator-page.tsx",
  "src/components/therapy-compass/therapy-card.tsx",
  "src/components/tools/tools-search-results-page.tsx",
] as const;

function read(relativePath: string) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function toAst(source: string) {
  return parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
}

/** Collects `[element, ancestors]` for every JSX element mentioning `needle` in a className. */
function findElementsUsing(source: string, needle: string) {
  const ast = toAst(source);
  const found: Array<{ ancestorClassNames: string[] }> = [];
  const stack: Array<Record<string, unknown>> = [];

  const classNameSourceOf = (node: Record<string, unknown>): string => {
    const attributes = ((node.openingElement as Record<string, unknown> | undefined)?.attributes ?? []) as Array<
      Record<string, unknown>
    >;
    for (const attribute of attributes) {
      if (attribute.type !== "JSXAttribute") continue;
      if ((attribute.name as { name?: string } | undefined)?.name !== "className") continue;
      const value = attribute.value as { start?: number; end?: number } | undefined;
      if (typeof value?.start !== "number" || typeof value?.end !== "number") return "";
      return source.slice(value.start, value.end);
    }
    return "";
  };

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    const record = node as Record<string, unknown>;
    const isElement = record.type === "JSXElement";
    if (isElement && classNameSourceOf(record).includes(needle)) {
      found.push({ ancestorClassNames: stack.map((ancestor) => classNameSourceOf(ancestor)) });
    }
    if (isElement) stack.push(record);
    for (const key of Object.keys(record)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      walk(record[key]);
    }
    if (isElement) stack.pop();
  };

  walk(ast.program.body);
  return found;
}

describe("search result rows open from anywhere in the row", () => {
  it("keeps the stretch recipe in one place, so it cannot be forked and go stale", () => {
    const recipes = read("src/components/card-recipes.ts");
    expect(recipes).toContain("export const stretchedRowLinkClass");

    // Any other file spelling the overlay out by hand is a second copy of the
    // contract. Import the recipe instead.
    const forks = ROW_CLICK_SURFACES.filter((surface) => read(surface).includes("after:absolute after:inset-0"));
    expect(forks).toEqual([]);
  });

  it.each(ROW_CLICK_SURFACES)("stretches rows from the shared recipe in %s", (surface) => {
    const source = read(surface);
    expect(source).toContain('from "@/components/card-recipes"');
    expect(source).toContain("stretchedRowLinkClass");
  });

  it.each(ROW_CLICK_SURFACES)("anchors every stretched row link to a positioned row in %s", (surface) => {
    const source = read(surface);
    const stretched = findElementsUsing(source, "stretchedRowLinkClass");

    // Every listed surface must actually use it — otherwise this file has gone
    // stale against a refactor and stops guarding anything.
    expect(stretched.length).toBeGreaterThan(0);

    for (const element of stretched) {
      const hasPositionedRow = element.ancestorClassNames.some(
        (className) => /\brelative\b/.test(className) || /\bfixed\b/.test(className) || /\babsolute\b/.test(className),
      );
      expect(hasPositionedRow).toBe(true);
    }
  });
});
