import { describe, expect, it } from "vitest";

import { DECLINE_REASON_LABELS, referralDestinationLabel } from "../src/components/ward-management/ward-referrals";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";

/**
 * ⚠️ OWNER RULING, 2026-09-03, and he called it important: "it is not a bed request when a patient
 * is referred to the ED from community or from another ED doctor."
 *
 * `referralDestinationLabel` returned the KIND alone, so every board composing a row from it
 * rendered a declined ED referral as "Emergency department: No suitable bed" — whatever the
 * referral had actually asked for. A request for psychiatric review, read back as a refused bed.
 *
 * ⚠️ THE RULE WAS ALREADY WRITTEN DOWN, ONE FUNCTION AWAY, AND THIS CALLER DID NOT FOLLOW IT.
 * `referralPurposeLabel`'s own docblock states it as a SAFETY rule: every row showing an ED
 * referral must show the purpose, because since the FD-18 correction EVERY referral is declinable
 * — so a declinable row with no stated purpose is indistinguishable from a bed request. The label
 * every board builds its rows from was the one place still dropping it.
 *
 * These tests read the SEEDED referrals rather than hand-built destinations, so they cannot pass
 * against a shape the reducer could never produce.
 */
describe("an ED referral is a notification, not a bed request", () => {
  const state = seedWardFlowState();
  const edDestinations = state.referrals
    .flatMap((referral) => referral.destinations)
    .filter((addressing) => addressing.destination.kind === "emergency_department");
  const wardDestinations = state.referrals
    .flatMap((referral) => referral.destinations)
    .filter((addressing) => addressing.destination.kind === "psychiatric_ward");

  it("the seed contains both kinds, or neither assertion below means anything", () => {
    // ⚠️ Anti-vacuity on the property each test rests on, not on the state being non-empty. A seed
    // with no ED destination would make the first test below pass over an empty loop.
    expect(edDestinations.length, "no seeded ED destination — the ruling's case is unexercised").toBeGreaterThan(0);
    expect(wardDestinations.length, "no seeded ward destination — the control is unexercised").toBeGreaterThan(0);
  });

  it("states what the ED referral is FOR, so a row cannot be read as a refused bed", () => {
    for (const addressing of edDestinations) {
      const label = referralDestinationLabel(addressing.destination);
      const destination = addressing.destination as { purpose: string };

      expect(
        label,
        `an ED row reads "${label}" and never says what it was for — since FD-18 every referral is ` +
          `declinable, so this is indistinguishable from a bed request`,
      ).not.toBe("Emergency department");

      if (destination.purpose !== "bed") {
        // ⚠️ THE DISCRIMINATOR. A non-bed ED referral must not carry bed language into the row at
        // all: that is the whole of the owner's ruling, and the word is the thing a clinician reads.
        expect(
          label.toLowerCase().includes("bed"),
          `the ED row for a "${destination.purpose}" referral still says "bed" — "${label}"`,
        ).toBe(false);
      }
    }
  });

  it("CONTROL: a ward destination is still rendered as a refused bed when one is refused", () => {
    // Without this, the test above is satisfied by deleting bed language everywhere. A psychiatric
    // ward refusing "No suitable bed" is a true and necessary sentence; only the ED case is wrong.
    const wardLine = `${referralDestinationLabel(wardDestinations[0]!.destination)}: ${DECLINE_REASON_LABELS.no_suitable_bed}`;
    expect(
      wardLine.toLowerCase().includes("bed"),
      "a ward refusal no longer reads as a bed refusal, which is a true sentence that was removed",
    ).toBe(true);
    expect(wardLine).toContain("Psychiatric ward");
  });
});
