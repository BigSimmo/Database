import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { REFERRAL_DESTINATION_KINDS, type Referral } from "@/components/ward-management/ward-model";
import { referralClocks, referralState } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 THE SEED MUST REACH EVERY BRANCH, NOT MERELY EVERY FIELD.
 *
 * ⚠️ **THE HARDEST OF THE THREE BLINDNESSES, AND THE ONLY ONE WITH NO OWNER.** Three shapes of the
 * same failure turned up on Ward Flow in one night:
 *
 * ```
 * no producer          the field cannot be written at all
 * producer, no case    the field CAN be written and no seeded row does it   <- this file
 * neither              the guard inspects an arm no fixture produces
 * ```
 *
 * The first two have owners the moment anyone points at them. **This one belongs to nobody:** the
 * derivation's author sees green, the fixture's author is not thinking about branches, and the
 * screen's author sees a legitimate-looking state. **Every individual view is correct and complete,
 * and the defect lives only in the join.**
 *
 * It happened for real. `referralClocks` has a running branch and a stopped branch, both correct,
 * both unit-tested with hand-made referrals — and every one of the nine seeded referrals took the
 * running branch, so **half the derivation could not appear on the screen built to show both.**
 * Nothing in the derivation, its tests or the compiler looks at what the SEED contains. It surfaced
 * because a peer happened to be reading two surfaces at once and noticed one of two labels had never
 * once rendered. ⚠️ **That is luck, not method — and a class found only by luck is the one most
 * worth a mechanical guard.** This file is that guard.
 *
 * ⚠️ **AND THE NEAR-MISS IS WHY A FIELD-LEVEL CHECK WOULD NOT HAVE CAUGHT IT.** One fixture DID
 * carry `triagedAt`, which made the case look covered while being the opposite shape. **A fixture
 * that exercises a FIELD is not a fixture that exercises a BRANCH.** Two of three shapes present
 * reads as coverage, and the missing one is invisible precisely because the other two are there.
 *
 * **How to add to it:** name the branches a screen can render, say which the seed must reach, and
 * let the expected set be exact. An exact set fails in both directions — a shape that vanishes is
 * caught as well as one never seeded, which a "more than one" check would miss.
 *
 * **What it does NOT cover, stated so nobody reads it as more than it is:** only the referral
 * surface, only branches named here, and only the default scenario. It cannot know about a branch
 * nobody thought to list.
 */
const NOW = NOW_ANCHOR;

type Shape = {
  readonly branch: string;
  readonly of: (referral: Referral) => string;
  readonly expected: readonly string[];
  readonly why: string;
};

const SHAPES: readonly Shape[] = [
  {
    branch: "referralClocks · the referral clock",
    of: (referral) => (referralClocks(referral, NOW).sinceReferralRunning ? "running" : "stopped"),
    expected: ["running", "stopped"],
    why: "the board words a stopped span differently from a live wait, and a seed that only ever runs shows one wording forever",
  },
  {
    branch: "referralClocks · the department clock",
    of: (referral) => (referralClocks(referral, NOW).inDepartment === undefined ? "absent" : "present"),
    expected: ["absent", "present"],
    why: "P9-D7's whole point is that a not-yet-arrived expect renders no duration at all, which needs a seeded row with no triage",
  },
  {
    branch: "referralState",
    of: (referral) => referralState(referral),
    expected: ["accepted", "declined", "queued"],
    why: "the board has a queued table and a decided table, and a decline reads differently from an acceptance",
  },
  {
    branch: "Referral.suburb",
    of: (referral) => referral.suburb.kind,
    expected: ["named", "unknown"],
    why: "a patient of no fixed abode is the case the union exists for, and it renders a label rather than a place name",
  },
  {
    branch: "ReferralDestination.kind",
    of: (referral) => [...new Set(referral.destinations.map((a) => a.destination.kind))].sort().join("+"),
    expected: [...REFERRAL_DESTINATION_KINDS].sort(),
    why: "each destination kind is addressed by a different screen, and an unseeded kind leaves that screen empty and looking correct",
  },
];

describe("every branch a referral screen can render is reached by the seed", () => {
  const referrals = seedWardFlowState().referrals;

  it("has referrals to look at, or every assertion below is about the empty set", () => {
    expect(referrals.length).toBeGreaterThan(1);
  });

  for (const shape of SHAPES) {
    it(`${shape.branch} — the seed reaches every branch`, () => {
      const seen = [...new Set(referrals.flatMap((referral) => shape.of(referral).split("+")))].sort();
      const missing = shape.expected.filter((value) => !seen.includes(value));
      expect(
        missing,
        `${shape.branch} never takes ${missing.join(", ")} anywhere in the seed, so that branch ` +
          `renders on no screen — ${shape.why}. Seed a row that takes it, or remove it from this ` +
          "list with a reason if the branch is genuinely unreachable.",
      ).toEqual([]);
      expect(
        seen.filter((value) => !shape.expected.includes(value)),
        `${shape.branch} takes a value this list does not name. Add it, deliberately: an exact set ` +
          "is what makes a vanished branch fail as loudly as an unseeded one.",
      ).toEqual([]);
    });
  }
});
