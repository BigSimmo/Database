import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE STATISTICS SCREEN CALLED A STATE "ORDINARY" THAT NO RECORD IN THE PROTOTYPE IS IN.**
 *
 * The referral-to-bed paragraph read: *"An admission carries the referral it came from, or nothing
 * at all — and nothing at all is an ordinary state HERE, meaning that admission came from a movement
 * rather than from a referral."* Measured on the seeded state: **0 of 267 admissions carry a null
 * `referralId`.** The seed writes `RF-${suffix}` for every generated admission, so the branch has no
 * producer at all. 267 of 267 is not ordinary; it is universal.
 *
 * ⚠️ **THE CLAIM WAS TRUE OF THE TYPE AND FALSE OF THE DATA, AND THE REGISTER ONLY EVIDENCED THE
 * TYPE.** `statistics-claims-register.ts` pinned it to `referralId: string | null` in
 * `ward-admissions.ts` — real evidence for "the pointer is nullable", and no evidence at all for
 * "ordinary here". A source comment beside the paragraph even said the claim was "a property of the
 * field rather than of the fixture". **That scope note was true of the comment and false of the
 * sentence, and only the sentence is on screen.**
 *
 * ⚠️ **THE PROJECT ALREADY HAD THIS RULE, THREE HUNDRED LINES AWAY, ON THE SIBLING FIELD.**
 * `tests/ward-admissions-seed.test.ts` requires `tentativeDiagnosis` to be null on SOME seeded
 * people and not all, and says why in terms: *"a fixture where everybody carried a value would leave
 * the 'none recorded' branch — the ordinary state — with no seeded case at all, which is the branch
 * a reader is most likely to see wrong."* `referralId` had no such guard.
 *
 * **This file is the implication rather than either half**, so it stays green under both honest
 * futures: describe the null branch as ordinary AND seed one, or describe it as the type permits it
 * and seed none. It goes red only for the combination that is a false statement about the data.
 */

const ORDINARY_CLAIM = /\b(ordinary|common|usual|typical|often|frequently)\b/iu;

function nullReferralIdCount(): number {
  return seedWardFlowState().admissions.filter((admission) => admission.referralId === null).length;
}

function joinParagraphText(): string {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-statistics-referral-join-absent").textContent ?? "";
}

describe("the statistics screen's account of a null referral id", () => {
  it("reads the paragraph and the seed at all, so the implication below is not vacuous", () => {
    /*
     * ⚠️ Floors on both OPERANDS, because this test is an implication and an implication is
     * satisfied by an absent antecedent. If the paragraph vanished, or the seed could not be read,
     * the assertion below would pass while measuring nothing.
     */
    const paragraph = joinParagraphText();
    expect(
      paragraph.length,
      "the referral-join paragraph rendered no text, so nothing below is being checked",
    ).toBeGreaterThan(200);
    expect(
      seedWardFlowState().admissions.length,
      "the seed produced no admissions, so the null count below is trivially zero",
    ).toBeGreaterThan(0);
  });

  it("catches the wording it exists for, and passes the wording that replaced it", () => {
    /*
     * The positive control ships here rather than in a scratch script, in the exact form the scan
     * matches. Without it a detector that had silently stopped matching would report the page clean.
     */
    expect(
      ORDINARY_CLAIM.test("and nothing at all is an ordinary state here, meaning that admission came from a movement"),
      "the detector no longer sees the claim it was written for",
    ).toBe(true);
    expect(
      ORDINARY_CLAIM.test("the pointer is nullable, and a null would mean that admission came from a movement"),
      "the detector fires on wording that claims nothing about how often, which would make it noise",
    ).toBe(false);
  });

  it("never calls a null referral id ordinary while no admission has one", () => {
    const nulls = nullReferralIdCount();
    if (nulls > 0) return; // The fixture exercises the branch; the page may describe it however it likes.

    expect(
      ORDINARY_CLAIM.exec(joinParagraphText())?.[0] ?? null,
      `no seeded admission carries a null referralId (0 of ${seedWardFlowState().admissions.length}), so the ` +
        "page must not tell a reader that state is ordinary. Either seed one — the discipline " +
        "`ward-admissions-seed.test.ts` already applies to `tentativeDiagnosis` — or describe the pointer's " +
        "type rather than the frequency of a state the data never reaches.",
    ).toBeNull();
  });
});
