import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { EscalationBoardPage } from "@/components/ward-management/escalation/escalation-board";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE REASON A BOARD GIVES FOR NOT BEING A MEDICAL DEVICE MUST STILL BE TRUE TOMORROW.
 *
 * 🔴 THE DEFECT, and it was a governance one rather than a wording one. Three boards supported
 * "not a medical device" with a promise that the software NEVER RANKS wards or NEVER SUGGESTS which
 * bed is best. The owner has since asked for exactly that capability, and the product ranks wards by
 * fit today on four surfaces. So the stated REASON for the device claim became false, in front of a
 * clinician, on screens about placing patients.
 *
 * ⚠️ WHY THE REPLACEMENT IS "IT PLACES NOBODY" AND NOT "IT DOES NOT RANK". Measured: none of these
 * screens sorts by suitability, so "this board does not rank" would have been TRUE of each of them.
 * It was rejected anyway — a per-screen truth that reads as a claim about the product is the same
 * trap as a disclaimer that survives strict parsing while misleading the person reading it. "It
 * places nobody" is checkable against the reducer, does not expire when matching ships, and the
 * software may rank and suggest as much as the owner wants without making it false.
 *
 * ⚠️ AND "ONE AT A TIME" IS LOAD-BEARING, NOT DECORATION. `ACCEPT_IN_PRINCIPLE` and
 * `ACCEPT_REFERRAL` each carry a single `unitId`, so no event in the reducer can place more than one
 * patient or accept more than one unit in a single act. It is also literally the owner's row-by-row
 * ruling rather than a paraphrase of it.
 *
 * This file pins the REASON and pins the withdrawn form as an ABSENCE, so the old promise cannot
 * return quietly. `referral-match.tsx`'s own banner is pinned in `ward-referral-screens.dom.test.tsx`
 * beside the comparative-language rule it used to be exempt from.
 */

afterEach(cleanup);

const WITHDRAWN = /never ranks|never suggests|never allocates|does not yet rank/i;

function renderIn(node: ReactNode) {
  render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

const BANNERS = [
  { name: "escalation board", testId: "ward-escalation-governance", node: <EscalationBoardPage /> },
  { name: "referral board", testId: "ward-referral-board-governance", node: <ReferralBoard /> },
] as const;

describe("a board's stated reason for not being a medical device", () => {
  it("walks both boards, or the loop below asserts nothing", () => {
    expect(BANNERS.length, "no banners under test").toBe(2);
  });

  for (const banner of BANNERS) {
    it(`${banner.name}: still claims not to be a medical device`, () => {
      renderIn(banner.node);
      expect(screen.getByTestId(banner.testId)).toHaveTextContent(/not a medical device/i);
    });

    it(`${banner.name}: gives a reason that survives the software ranking`, () => {
      renderIn(banner.node);
      const text = screen.getByTestId(banner.testId).textContent ?? "";
      expect(
        text,
        "the device claim must not be left unsupported — the reason is that a human places every " +
          "patient, which stays true however much the software ranks or suggests",
      ).toMatch(/places nobody/i);
      expect(text, "the owner's ruling is row by row, and the sentence should say so").toMatch(/one at a time/i);
    });

    it(`${banner.name}: does not promise the software will never rank or suggest`, () => {
      renderIn(banner.node);
      const text = screen.getByTestId(banner.testId).textContent ?? "";
      expect(
        text,
        "the product ranks wards by fit today, so any form of this promise is false — including " +
          '"does not yet rank", which claims a future it does not have',
      ).not.toMatch(WITHDRAWN);
    });
  }

  it("the withdrawn promise appears on no ward surface at all", () => {
    // Both boards rendered together, so a copy of the sentence that migrated to a neighbouring
    // element on either page is still caught.
    for (const banner of BANNERS) {
      renderIn(banner.node);
      const root = document.body.textContent ?? "";
      expect(root, `${banner.name} carries the withdrawn promise somewhere outside its banner`).not.toMatch(WITHDRAWN);
      cleanup();
    }
  });
});
