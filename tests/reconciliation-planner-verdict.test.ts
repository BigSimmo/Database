/**
 * The reconciliation planner must not blame the catalogue for the control plane's state.
 *
 * WHAT HAPPENED. Run against the live project on 2026-09-21, the planner reported
 * "triage snapshots 0 / needs owner review 222 / adoptable 0" and refused with the words
 * "222 group(s) diverge from the published snapshot. Which text becomes public is a clinical
 * judgement". Nothing had diverged. A group is only comparable when its adapter canonical
 * candidate satisfies ALL FOUR of `publicationState === "published"`, `renderedByPublicSite`,
 * `explicitlyReconciled` and `rowOwnerId === null` — and on live, all 222 service rows and all 54
 * form rows carry a non-null `owner_id`, `site_content_publications` has 0 rows and
 * `site_content_public_records` has 0 rows. So no snapshot could be built, every group fell to
 * `divergent_requires_administrator_review`, and the count measured the state rather than the
 * records.
 *
 * WHY IT IS WORTH A TEST RATHER THAN A REWORDING. That refusal is the shape that invites the next
 * reader to "fix" it by relaxing the triage, which would mark owner-scoped rows canonical for a
 * clinical publication. The distinction between "nothing was comparable" and "things disagree"
 * therefore has to survive, and a message is not a contract until something asserts it.
 */
import { describe, expect, it } from "vitest";

import { plannerVerdict } from "../scripts/build-site-content-reconciliation-plan";

describe("plannerVerdict", () => {
  it("calls the live situation not_comparable rather than divergence", () => {
    // The exact counts from the 2026-09-21 run: 222 groups, 3 with nothing published, no snapshots.
    expect(
      plannerVerdict({ groups: 222, missing: 3, triageSnapshots: 0, needsReview: 222, ownerScopedRows: 222 }),
    ).toEqual({ kind: "not_comparable", comparableGroups: 219, ownerScopedRows: 222 });
  });

  it("does not reach for not_comparable when snapshots were actually built", () => {
    // One snapshot is enough to make "these disagree" a real statement about content.
    expect(
      plannerVerdict({ groups: 222, missing: 0, triageSnapshots: 1, needsReview: 221, ownerScopedRows: 222 }),
    ).toEqual({ kind: "needs_review", needsReview: 221, missing: 0 });
  });

  it("is not_comparable only when something published was there to compare", () => {
    // Every group unpublished: zero snapshots is then the honest answer, not a broken comparison,
    // and the existing "these are new publications, not adoptions" refusal is the right one.
    expect(plannerVerdict({ groups: 3, missing: 3, triageSnapshots: 0, needsReview: 3, ownerScopedRows: 3 })).toEqual({
      kind: "needs_review",
      needsReview: 3,
      missing: 3,
    });
  });

  it("still refuses on genuine divergence, which this change must not soften", () => {
    expect(plannerVerdict({ groups: 10, missing: 0, triageSnapshots: 10, needsReview: 2, ownerScopedRows: 0 })).toEqual(
      { kind: "needs_review", needsReview: 2, missing: 0 },
    );
  });

  it("still refuses when a group has an owner row but nothing published", () => {
    expect(plannerVerdict({ groups: 10, missing: 1, triageSnapshots: 9, needsReview: 0, ownerScopedRows: 0 })).toEqual({
      kind: "needs_review",
      needsReview: 0,
      missing: 1,
    });
  });

  it("proceeds only when everything is comparable and nothing needs a person", () => {
    expect(plannerVerdict({ groups: 10, missing: 0, triageSnapshots: 10, needsReview: 0, ownerScopedRows: 0 })).toEqual(
      { kind: "proceed" },
    );
  });

  it("is not vacuous: the verdicts are distinguishable, and only one of them writes a plan", () => {
    // Each assertion above is an equality against a hand-written object, which would also pass if
    // every branch returned the same shape with different numbers. This pins that the three kinds
    // are genuinely different outcomes and that "proceed" is the narrow one.
    const kinds = new Set(
      [
        plannerVerdict({ groups: 222, missing: 3, triageSnapshots: 0, needsReview: 222, ownerScopedRows: 222 }).kind,
        plannerVerdict({ groups: 10, missing: 0, triageSnapshots: 10, needsReview: 2, ownerScopedRows: 0 }).kind,
        plannerVerdict({ groups: 10, missing: 0, triageSnapshots: 10, needsReview: 0, ownerScopedRows: 0 }).kind,
      ].map(String),
    );
    expect(kinds).toEqual(new Set(["not_comparable", "needs_review", "proceed"]));
  });
});
