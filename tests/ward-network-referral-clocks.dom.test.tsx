import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-network-referral-placement.dom.test.tsx: the network workspace renders a
// next/link anchor and this suite never checks routing, so a plain <a> avoids requiring an App
// Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { referrals } from "@/components/ward-management/ward-movements";
import { referralClocks, referralQueueOrder, REFERRAL_CLOCK_TERMS } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 240;

/**
 * THE REFERRAL CLOCK ON THE NETWORK DIAGRAM, AND AN HONEST ACCOUNT OF WHAT IS AND IS NOT REACHABLE.
 *
 * The screen showed `referralWaitLabel` — `formatElapsed(minutesUntil(now, raisedAt))`, a clock
 * with no stop condition. It counts from the referral forever, including after the person has been
 * triaged and is sitting in a department.
 *
 * ⚠️ I NEARLY REPORTED THAT AS VISIBLE HERE AND IT IS NOT. Measuring the fixture found exactly one
 * referral whose clock should stop — `RF-003`, reading "4h 55m waiting" against a true referral
 * wait of 25 minutes, nearly twelvefold. But `RF-003` is `accepted`, and `referralQueueOrder`
 * filters to `queued`, so THIS SCREEN NEVER SHOWS IT. Every referral the network queue does show
 * was triaged BEFORE the mental-health referral was raised, so the old label gave the right number
 * for all of them.
 *
 * So the defect on this surface is LATENT, not live: the wrong function was wired in, and the
 * fixture happens to contain no queued referral that exposes it. It becomes visible the moment a
 * queued referral is triaged during a demonstration — `RF-001` is queued and not yet in a
 * department, so triaging it does exactly that.
 *
 * ⚠️ THAT DISTINCTION IS WHY THESE TESTS ASSERT ADOPTION RATHER THAN A CORRECTED NUMBER. There is
 * no seeded state on this screen where the old and new labels differ, so a test comparing them
 * would pass on the broken code. What CAN be pinned is that the page uses the clock vocabulary at
 * all — which is what makes the latent case come out right when it arrives.
 */
function queuedReferralRows() {
  const queued = referralQueueOrder(referrals);
  expect(
    queued.length,
    "no referral is queued in the seed any more, so the network queue is empty and every " +
      "assertion here would pass by describing nothing",
  ).toBeGreaterThan(0);
  return queued;
}

describe("the referral clocks on the network diagram", () => {
  it("words every queue row with a referral-clock term, so a stopped clock cannot read as a wait", () => {
    /*
     * The adoption assertion, and the one that would have caught the original defect. The old
     * `referralWaitLabel` produced a bare "4h 40m waiting" with no term at all — so requiring one of
     * the two terms fails on it, on every row, regardless of whether any row's NUMBER is wrong.
     */
    const queued = queuedReferralRows();

    render(
      <WardFlowProvider initialNow={NOW}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );

    for (const referral of queued) {
      const shown = screen.getAllByTestId(`ward-network-referral-${referral.id}`)[0].textContent ?? "";
      const running = referralClocks(referral, NOW).sinceReferralRunning;
      const expected = running ? REFERRAL_CLOCK_TERMS.sinceReferral : REFERRAL_CLOCK_TERMS.sinceReferralStopped;

      expect(shown, `${referral.id} does not say which clock it is showing`).toContain(expected);
      // And it must not carry the other term, which would be the wrong claim about the same number.
      const wrong = running ? REFERRAL_CLOCK_TERMS.sinceReferralStopped : REFERRAL_CLOCK_TERMS.sinceReferral;
      expect(shown, `${referral.id} is worded as the wrong clock`).not.toContain(wrong);
    }
  });

  it("never says a patient is 0m in department when they are not there at all", () => {
    /*
     * `inDepartment` is `number | undefined`, and undefined means NOT THERE — never 0. "0m in
     * department" reads as "just got there", the exact opposite of the truth, and would sort them
     * as the newest arrival while they are somewhere else entirely.
     */
    const absent = referralQueueOrder(referrals).filter(
      (referral) => referralClocks(referral, NOW).inDepartment === undefined,
    );
    expect(
      absent.length,
      "every queued referral is now in a department, so the not-yet-there wording is unexercised " +
        "and this guard proves nothing — restore a queued referral with no triage time",
    ).toBeGreaterThan(0);

    render(
      <WardFlowProvider initialNow={NOW}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );

    const shown = screen.getAllByTestId(`ward-network-referral-${absent[0].id}`)[0].textContent ?? "";
    expect(shown).not.toMatch(/\b0m in department\b/);
  });

  it("never words the department clock as arrival, because the field it reads is triage", () => {
    /*
     * A patient ARRIVES, waits, and is TRIAGED some time later — on a busy night that gap is not
     * small. `triagedAt` is the only timestamp available, so calling it arrival is a claim the data
     * cannot support. Asserted on the rendered rows rather than on the terms module, because the
     * module has its own guard and this is about what actually reaches a reader.
     */
    render(
      <WardFlowProvider initialNow={NOW}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );

    for (const referral of queuedReferralRows()) {
      const shown = screen.getAllByTestId(`ward-network-referral-${referral.id}`)[0].textContent ?? "";
      expect(shown, `${referral.id} words a triage time as arrival`).not.toMatch(/arriv/i);
    }
  });
});
