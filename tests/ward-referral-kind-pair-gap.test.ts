// tests/ward-referral-kind-pair-gap.test.ts
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
/**
 * ⚠️ THIS TEST PINS A GAP. IT DOES NOT ASSERT CORRECT BEHAVIOUR — READ BEFORE TOUCHING IT.
 *
 * Owner rulings 13 and 14 (`docs/ward-flow/owner-rulings-2026-09-01-bed-states-and-community.md`,
 * quoted at `RF-007`'s split comment in `src/components/ward-management/ward-movements.ts`) forbid
 * a referral addressed to both `psychiatric_ward` and `community_team` at once: *"a community
 * referral would never be requested if a patient is needing a bed as community referral is for
 * discharge."* `RF-011`'s own comment in the same file restates it as the one forbidden pair:
 * "The forbidden pair is `{psychiatric_ward, community_team}` (owner rulings 13/14: a community
 * referral is for discharge, so it can never accompany a bed request)".
 *
 * That refusal exists ONLY on screen, in
 * `src/components/ward-management/referrals/referral-intake.tsx`'s `wardAndCommunityBothChosen()`,
 * which disables the intake form's Send button and nothing else:
 *
 *   export function wardAndCommunityBothChosen(kinds: readonly ReferralDestinationKind[]): boolean {
 *     return kinds.includes("psychiatric_ward") && kinds.includes("community_team");
 *   }
 *
 * `RECEIVE_REFERRAL` in `src/components/ward-management/ward-flow-reducer.ts` validates ageBand,
 * destination count (1..PARALLEL_REFERRAL_CAP), duplicate kinds, kind membership, the ED arm's
 * `edId`/`purpose`, the ward arm's `sex`, `source`, `homeRegion`, `suburb`, `urgency`,
 * `originSiteCode`, `triagedAt` and `patientId` — but performs no check at all on which SET of
 * kinds was chosen together. A caller that bypasses the form (a script, a demo control, a
 * Playwright fixture, a future screen) can dispatch `RECEIVE_REFERRAL` with exactly this forbidden
 * pair and the referral is created, silently, with both destinations live.
 *
 * The reducer states this exact discipline about itself elsewhere, in `PULL_PATIENT`'s
 * bed-readiness refusal (`ward-flow-reducer.ts`, case `"PULL_PATIENT"`):
 *
 *   "The refusal lives HERE and not on a screen, and that is the whole point. A test asserting
 *   that a ward's page says "pending" passes against a build in which this refusal was never
 *   written. The property that matters is that the state transition cannot happen."
 *
 * and again, word for word except "only", on the same case's specialling-capacity refusal:
 *
 *   "The refusal lives HERE and not only on that screen, and that is the whole point. A test
 *   asserting a ward's page shows a specialling gate passes against a build where this refusal
 *   was never written."
 *
 * `{psychiatric_ward, community_team}` fails exactly that standard today: the state transition
 * CAN happen, because nothing at this layer stops it.
 *
 * Confirmed while writing this test: `tests/ward-referral-visibility.test.ts`'s
 * `multiDestinationReferral()` helper already dispatches a real `RECEIVE_REFERRAL` whose
 * `destinations` carry `psychiatric_ward`, `emergency_department` AND `community_team` together —
 * so it already contains the forbidden pair, alongside a third arm — and asserts
 * `received.rejections` is `[]`. That fixture exists for FD-23 (ward/coordinator visibility), not
 * for this rule, and is not evidence the pair was ever considered there; it is a second place that
 * will need rewriting the day this gap closes, in addition to this file.
 *
 * WHAT A FUTURE RED HERE MEANS: somebody has added the `{psychiatric_ward, community_team}`
 * refusal to `RECEIVE_REFERRAL` in the reducer — closing the gap this test exists to pin. When
 * that happens:
 *   1. Do NOT revert the reducer change to make this test pass again.
 *   2. Rewrite this test (and its title/description below) to assert the REJECTION instead —
 *      that `received.rejections` gains one entry naming the forbidden pair, and that no referral
 *      with both destinations is created.
 *   3. Check `tests/ward-referral-visibility.test.ts`'s `multiDestinationReferral()` too: it will
 *      start failing its own `toEqual([])` assertion on `received.rejections` and needs a
 *      three-destination fixture that no longer pairs `psychiatric_ward` with `community_team`
 *      (the same repair `RF-007` already went through in `ward-movements.ts`, splitting the
 *      community arm out to `RF-010`).
 */
describe("RECEIVE_REFERRAL — GAP: the reducer does not reject {psychiatric_ward, community_team}", () => {
  it("PINS CURRENT (WRONG) BEHAVIOUR: a referral addressed to both a psychiatric ward and a community team at once is created with zero rejections, though owner rulings 13/14 forbid the pair", () => {
    const seeded = seedWardFlowState();
    const rejectionsBefore = seeded.rejections.length;
    const referralsBefore = seeded.referrals.length;

    const result = wardFlowReducer(seeded, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: 1_000,
      ageBand: "Adult",
      destinations: [
        { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
        { kind: "community_team", teamName: "Inner City Clinic" },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });

    // The gap: no rejection is raised for the forbidden combination. Once the refusal is
    // written into the reducer, this assertion is the one to invert (see the block comment
    // above for the exact rewrite).
    expect(result.rejections.length, "expected NO new rejection — this is the gap, not correct behaviour").toBe(
      rejectionsBefore,
    );

    // The referral IS created, with BOTH forbidden destinations intact and queued.
    expect(result.referrals.length).toBe(referralsBefore + 1);
    const created = result.referrals.at(-1)!;
    expect(created.destinations).toHaveLength(2);
    const kinds = created.destinations.map((addressing) => addressing.destination.kind).sort();
    expect(kinds).toEqual(["community_team", "psychiatric_ward"]);
    expect(created.destinations.every((addressing) => addressing.state === "queued")).toBe(true);
  });
});
