// tests/answer-verification-placement.dom.test.tsx
//
// The guard `src/components/ui/answer-card.tsx` says already exists.
//
// AnswerCard's `verificationPlacement` prop documents an obligation it cannot itself enforce:
//
//   **A surface that opts in MUST render `<VerificationNotice {...verification} />` itself**;
//   `tests/answer-verification-placement.dom.test.tsx` is what stops that obligation being
//   quietly dropped
//
// That file did not exist. The obligation was real, the enforcement was not, and a comment naming
// a safety guard that is absent is worse than no comment -- it is the reason nobody writes the
// guard. Found while verifying the 2026-09-17 external audit (its finding C8).
//
// What the card does when a surface opts in: it renders NOTHING at the header seam
// (`{verificationPlacement === "header" ? <VerificationNotice … /> : null}`). So a surface that
// takes placement and then forgets to render the notice does not fail, warn, or look wrong in
// review -- it simply stops showing the governed verification sentence on an answer a clinician
// is about to act on. That is the exact failure this scan exists to make impossible.
//
// This is a static scan rather than a render test on purpose. The property is "every opting-in
// surface, including one written next year", which no amount of rendering today's two call sites
// can establish.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(process.cwd(), "src");

/** The opt-in, and the render that must accompany it. */
const OPT_IN = /verificationPlacement=(?:"content"|\{"content"\})/;
const RENDERS_NOTICE = /<VerificationNotice\b/;

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (/\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/**
 * Mockups are excluded by construction rather than by a special case: `src/app/mockups/**` and
 * `src/components/*-mockups.tsx` are design scratch that production never routes to, and several
 * of them define their own private `VerificationNotice` shadow. Including them would make the
 * scan assert a contract about files the contract does not govern.
 */
function isProductionSurface(path: string): boolean {
  const rel = relative(process.cwd(), path).replaceAll("\\", "/");
  return !rel.includes("/mockups/") && !rel.endsWith("-mockups.tsx");
}

function optingInSurfaces(): Array<{ rel: string; source: string }> {
  return sourceFiles(SOURCE_ROOT)
    .filter(isProductionSurface)
    .map((path) => ({ rel: relative(process.cwd(), path).replaceAll("\\", "/"), source: readFileSync(path, "utf8") }))
    .filter(({ source }) => OPT_IN.test(source));
}

describe("answer verification placement", () => {
  it("finds the surfaces that take verification placement from the card", () => {
    // A scan that matches nothing passes vacuously for ever. If the opt-in is renamed or the last
    // caller is deleted, this fails and someone decides whether the contract still exists, rather
    // than the suite quietly asserting nothing about anything.
    const surfaces = optingInSurfaces();
    expect(surfaces.map(({ rel }) => rel)).toContain("src/components/clinical-dashboard/answer-result-surface.tsx");
  });

  it.each(optingInSurfaces())("$rel renders the governed verification sentence itself", ({ rel, source }) => {
    expect(
      RENDERS_NOTICE.test(source),
      `${rel} sets verificationPlacement="content", which stops AnswerCard rendering the ` +
        "verification notice at the header seam. It must render <VerificationNotice /> itself, " +
        "or the governed sentence disappears from that answer with nothing to show it has.",
    ).toBe(true);
  });

  it("fails a surface that takes placement without rendering the notice", () => {
    // The scan proved able to fail, not merely observed passing. Without this, a regex that
    // matched nothing -- a renamed prop, a changed quoting style -- would look identical to a
    // codebase in which every surface complies.
    const offending = '<AnswerCard verificationPlacement="content" answer={answer} />';
    expect(OPT_IN.test(offending)).toBe(true);
    expect(RENDERS_NOTICE.test(offending)).toBe(false);

    const compliant = `${offending}\n<VerificationNotice {...verification} />`;
    expect(RENDERS_NOTICE.test(compliant)).toBe(true);
  });

  it("still matches the opt-in when written as a JSX expression", () => {
    // `verificationPlacement={"content"}` is the same opt-in and must not slip past the scan.
    expect(OPT_IN.test('verificationPlacement={"content"}')).toBe(true);
    // A header placement is not an opt-in: the card renders the notice itself there.
    expect(OPT_IN.test('verificationPlacement="header"')).toBe(false);
  });
});
