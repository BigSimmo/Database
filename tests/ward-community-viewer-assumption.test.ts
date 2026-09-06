// tests/ward-community-viewer-assumption.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { stripAllComments } from "./helpers/strip-source-comments";

/**
 * THE ASSUMPTION THAT MAKES `CommunityHome` AND `CommunityTeamHub` SAFE AS TWO COMPONENTS RATHER
 * THAN ONE — INVERTED, NOT DELETED.
 *
 * The build plan's ORIGINAL Task 3 pinned the ABSENCE of a community-scoped projection: "no
 * community screen exists, so the shared scope component is still a single-viewer filter." That
 * absence has since been filled — `CommunityScopedReferral` was added in `66b10a439` and the owner
 * ruled community a first-class role the same day — so the assumption this file guards is now the
 * opposite one: **a component reached by both the coordinator and a community user is outside the
 * FD-23 guarded set by construction** ("a module both roles reach is shared infrastructure by
 * construction" — `ward-referral-visibility.ts`'s own header), so the guard at
 * `tests/ward-referral-screen-boundary.test.ts` cannot be what protects the distinction between
 * `CoordinatorScopedReferral` and `CommunityScopedReferral` on its own — something else has to keep
 * them apart, and this file is that something: it watches the same seam from the other side.
 *
 * A guard deleted because reality changed leaves nothing behind. This one is kept and rewritten so
 * the day either fact reverses — a `destinations` field creeps onto the community projection, or a
 * converter arrives taking a role/viewer/scope argument — something red names it.
 */

const VISIBILITY_PATH = resolve(process.cwd(), "src/components/ward-management/ward-referral-visibility.ts");
const BOUNDARY_TEST_PATH = resolve(process.cwd(), "tests/ward-referral-screen-boundary.test.ts");

function communityScopedReferralTypeBody(source: string): string {
  const match = /export type CommunityScopedReferral = \{([\s\S]*?)\n\};/u.exec(source);
  if (!match) throw new Error("CommunityScopedReferral type not found in ward-referral-visibility.ts");
  return match[1];
}

describe("the community-viewer assumption, inverted for the projection that now exists", () => {
  it("CommunityScopedReferral exists and is exported", () => {
    const source = readFileSync(VISIBILITY_PATH, "utf8");
    // Comment-stripped -- see tests/ward-guard-comment-blindness.test.ts. A comment quoting this
    // exact declaration text (e.g. a "kept for history" note beside a renamed/removed type) would
    // otherwise satisfy this match while the real declaration no longer exists. Proved by mutation:
    // renaming the real `export type CommunityScopedReferral` and adding a decoy comment with the
    // original text left this check green against the unstripped source.
    expect(stripAllComments(source)).toMatch(/export type CommunityScopedReferral = \{/u);
  });

  it("carries no `destinations` field -- the whole point of the owner's 2026-09-04 ruling", () => {
    const source = readFileSync(VISIBILITY_PATH, "utf8");
    const body = communityScopedReferralTypeBody(source);
    // Non-vacuity: the type must have SOME fields, or a body that matched nothing (an empty
    // capture from a broken regex) would trivially "not contain destinations" too. Comment-stripped
    // -- see tests/ward-guard-comment-blindness.test.ts -- because this is a count floor (`> 20`),
    // and a floor is exactly as easy for a comment to lift as a presence check: proved by mutation,
    // emptying the real type down to zero real fields but leaving ONE explanatory comment inside the
    // braces (itself over 20 characters) kept this floor satisfied against the unstripped body.
    const codeOnlyBody = communityScopedReferralTypeBody(stripAllComments(source));
    expect(
      codeOnlyBody.length,
      "CommunityScopedReferral's own body could not be read -- fix the extractor above",
    ).toBeGreaterThan(20);
    // Left reading the RAW (unstripped) body on purpose: a `.not.toMatch` gets MORE PERMISSIVE, not
    // less, if comments are stripped first -- it would stop firing on a `destinations` field that
    // crept in as a comment before it crept in as code. Erring toward a false alarm a human reads is
    // the safe direction here.
    expect(body).not.toMatch(/\bdestinations\b/u);
    // And the positive control this file's own comment demands: prove the same extractor sees a
    // field that IS legitimately there, so "not found" cannot be mistaken for "found nothing at
    // all". Comment-stripped, unlike `body` above -- this is a presence check, so a comment
    // mentioning `addressing` without the real field must not satisfy it. Proved by mutation: the
    // same rename-plus-decoy-comment trick used on the type declaration above also fooled this
    // exact assertion when it read the unstripped body.
    expect(codeOnlyBody).toMatch(/\baddressing\b/u);
  });

  it("declares no converter between the projections, and no exported function takes a role, viewer or scope argument", () => {
    const source = readFileSync(VISIBILITY_PATH, "utf8");
    // Every export in this module is one of: a type, or a function taking exactly one
    // referral-shaped parameter (a `Referral`, a `Referral[]`, or a `ReferralDestinationKind`).
    // A converter would need a SECOND parameter naming the viewer -- so this is pinned directly,
    // in the module's own words ("none of them takes a role, a scope or a viewer as an argument").
    //
    // Comment-stripped before scanning -- see tests/ward-guard-comment-blindness.test.ts. The count
    // below is a floor (`> 0`), and a floor is exactly as easy for a comment to lift as a presence
    // check: proved by mutation, renaming every real `export function` to break the match and then
    // adding ONE decoy comment ("// old signature, kept for history: export function ...") lifted
    // the count from 0 back to 1 and left this whole test green against the unstripped source.
    const exportedFunctionSignatures = [...stripAllComments(source).matchAll(/export function \w+\(([^)]*)\)/gu)].map(
      (m) => m[1],
    );
    expect(
      exportedFunctionSignatures.length,
      "no exported function found at all -- the extractor is broken, not the module",
    ).toBeGreaterThan(0);
    for (const signature of exportedFunctionSignatures) {
      expect(signature).not.toMatch(/\b(role|viewer|scope)\s*:/u);
    }
    // And no function literally named as a role-dispatching converter exists anywhere in the file.
    expect(source).not.toMatch(/scopedReferralFor|referralForRole|referralForViewer/u);
  });

  it("WARD_FACING in the screen-boundary guard now contains the community screen, so FD-23 covers it", () => {
    const source = readFileSync(BOUNDARY_TEST_PATH, "utf8");
    // Comment-stripped -- see tests/ward-guard-comment-blindness.test.ts. Proved by mutation:
    // renaming the real array entry away and adding a decoy comment carrying the original literal
    // text ("community/community-team-hub.tsx") inside the array body left this check green against
    // the unstripped source.
    const codeOnly = stripAllComments(source);
    const match = /const WARD_FACING: readonly string\[\] = \[([\s\S]*?)\]\.map/u.exec(codeOnly);
    expect(match, "WARD_FACING array literal not found -- the extractor above needs updating").toBeTruthy();
    const listBody = match![1];
    expect(listBody).toMatch(/community\/community-team-hub\.tsx/u);
  });
});
