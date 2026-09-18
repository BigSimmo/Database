import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { minHeightPixels } from "../scripts/design-system-contract-utils.mjs";

/**
 * #SFFGYD — the services result card's actions measured 40px on a tablet.
 *
 * Bookmark, "Review referral" and "Add to shortlist" all carried
 * `min-h-12 … sm:min-h-10`, so they met the 48px floor on a phone and dropped to
 * 40px from 640px up — the width a tablet is held at. TOKENS.md §2 is explicit:
 * every primary CTA is 48px at EVERY breakpoint, and a prefixed compact class is
 * an override, not desktop polish. `min-h-compact-meta` remains the named 40px
 * role for metadata and disclosure; none of these controls is that.
 *
 * `check:design-system-contract` does not catch this shape: its responsive-band
 * floor IS the 40px compact-meta value, so a step-down to exactly 40 sits on the
 * line rather than under it. That is why this assertion exists separately, and
 * why removing the step-down did not move `interactiveTapFloorDeclarations`.
 *
 * The reference is `src/components/therapy-compass/therapy-card.tsx`, which
 * varies padding by breakpoint and lets its shared control recipe own height.
 *
 * Scoped to interactive elements through the AST rather than a whole-file regex:
 * `sm:min-h-0` on the composer portal slot in this same file is a container
 * reset, and a gate that cannot tell it from a shrunken button is a gate that
 * gets deleted the first time it cries wolf.
 */
const SERVICES_PAGE = "src/components/services/services-navigator-page.tsx";
const INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "summary", "textarea", "Link"]);
const RESPONSIVE_PREFIX = /^(?:sm|md|lg|xl|2xl|tablet|desktop):/;
const TAP_FLOOR_PX = 48;

/** Every string literal reachable from a `className` attribute, `cn(…)` included. */
function classTexts(source: ts.SourceFile): Array<{ tag: string; text: string }> {
  const found: Array<{ tag: string; text: string }> = [];

  const collectStrings = (node: ts.Node, sink: string[]) => {
    if (ts.isStringLiteralLike(node)) sink.push(node.text);
    ts.forEachChild(node, (child) => collectStrings(child, sink));
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (INTERACTIVE_TAGS.has(tag)) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || attribute.name.getText(source) !== "className") continue;
          const strings: string[] = [];
          if (attribute.initializer) collectStrings(attribute.initializer, strings);
          for (const text of strings) found.push({ tag, text });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

describe("services navigator tap floor", () => {
  const sourceText = readFileSync(resolve(process.cwd(), SERVICES_PAGE), "utf8");
  const source = ts.createSourceFile(SERVICES_PAGE, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const interactiveClasses = classTexts(source);

  it("finds the controls it claims to measure", () => {
    // A zero-length scan would make every assertion below vacuously true.
    expect(interactiveClasses.length).toBeGreaterThan(5);
  });

  it("steps no control height below the 48px tap floor at any breakpoint", () => {
    const belowFloor: string[] = [];
    for (const { tag, text } of interactiveClasses) {
      for (const token of text.split(/\s+/)) {
        if (!RESPONSIVE_PREFIX.test(token)) continue;
        const utility = token.replace(RESPONSIVE_PREFIX, "");
        if (!utility.startsWith("min-h-")) continue;
        const pixels = minHeightPixels(utility);
        // An unresolvable height is reported rather than passed: this must not
        // go quiet because someone wrote the value a way it cannot read.
        if (pixels === null || pixels < TAP_FLOOR_PX) belowFloor.push(`<${tag}> ${token}`);
      }
    }

    expect(belowFloor, `${SERVICES_PAGE} steps a control below ${TAP_FLOOR_PX}px at a breakpoint`).toEqual([]);
  });

  it("keeps the square bookmark control square at the tap floor", () => {
    // The bookmark is icon-only, so its width is as load-bearing as its height —
    // `sm:min-w-10` narrowed it to 40px alongside the height drop.
    const narrowed: string[] = [];
    for (const { tag, text } of interactiveClasses) {
      for (const token of text.split(/\s+/)) {
        if (!RESPONSIVE_PREFIX.test(token)) continue;
        const utility = token.replace(RESPONSIVE_PREFIX, "");
        if (!/^min-w-\d/.test(utility)) continue;
        narrowed.push(`<${tag}> ${token}`);
      }
    }

    expect(narrowed, `${SERVICES_PAGE} narrows a control below the tap floor at a breakpoint`).toEqual([]);
  });

  it("still floors those controls at 48px in the base band", () => {
    // The step-down removal must not be read as "heights are optional here":
    // every control the defect named still declares the floor unprefixed.
    expect(sourceText).toContain("min-h-12 min-w-12 place-items-center");
    expect(sourceText.match(/\bmin-h-12\b/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });
});
