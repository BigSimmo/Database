import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-capacity-view.dom.test.tsx,
// ward-escalation.dom.test.tsx, ward-screen.dom.test.tsx): `ClinicalRail` renders next/link
// anchors and this suite never checks routing, so a plain <a> avoids requiring an App Router
// context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Raises a real CHANGE_URGENCY event through the live reducer — mirrors `ClockAdvancer` in
 * ward-escalation.dom.test.tsx / ward-flow-provider.dom.test.tsx — so this suite proves the
 * governance board's change audit reacts to the same dispatch path the real screens use, not a
 * fixture snapshot frozen at render time. */
function UrgencyChanger({ movementId }: { movementId: string }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "CHANGE_URGENCY",
          role: "coordinator",
          now,
          movementId,
          urgency: 1,
          reason: "reassessed",
        })
      }
    >
      raise urgency change
    </button>
  );
}

function renderGovernance() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardModeWorkspace mode="governance" />
      <UrgencyChanger movementId="WF-002" />
    </WardFlowProvider>,
  );
}

describe("GovernanceView", () => {
  it("carries the not-a-medical-device statement, the same wording the coordinator screen uses", () => {
    renderGovernance();
    const notice = screen.getByTestId("ward-governance-medical-device-notice");
    expect(notice).toHaveTextContent("This screen is not a medical device. It orders operational placement work only");
    expect(notice.querySelector("strong")).toHaveTextContent("not a medical device");
  });

  // Fixture fact (Task 9 brief): exactly one movement, WF-010, carries a hand-authored
  // statusChanges entry; no movement carries a hand-authored urgencyChanges or unwinds entry.
  // So the board starts with exactly one row, and dispatching a real change grows the list —
  // newest first — rather than the row count being frozen or the new entry landing at the end.
  it("shows the real fixture's one hand-authored change (WF-010) and grows, newest first, once a new change is dispatched", () => {
    renderGovernance();

    const listBefore = screen.getByTestId("ward-governance-change-audit");
    expect(listBefore).toHaveTextContent("WF-010");
    // The explicit empty state must not render while at least one entry exists — both
    // directions of the same guard ward-capacity-view.dom.test.tsx checks for its own rows.
    expect(screen.queryByTestId("ward-governance-change-audit-empty")).not.toBeInTheDocument();
    expect(listBefore.querySelectorAll("li")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "raise urgency change" }));

    const listAfter = screen.getByTestId("ward-governance-change-audit");
    const itemsAfter = listAfter.querySelectorAll("li");
    expect(itemsAfter).toHaveLength(2);
    // Newest first: the just-dispatched urgency change is recorded at `now` (NOW_ANCHOR), which
    // sorts ahead of the fixture's own WF-010 entry, timestamped NOW_ANCHOR - 40. Checked as one
    // ordered pair per row (id + kind together), not two independent substring checks that a
    // swapped-row mutation could still satisfy.
    expect(itemsAfter[0]).toHaveTextContent("WF-002");
    expect(itemsAfter[0]).toHaveTextContent("Urgency change");
    expect(itemsAfter[1]).toHaveTextContent("WF-010");
    expect(itemsAfter[1]).toHaveTextContent("Legal status change");
  });

  it("renders the two effectiveness numbers, the synthetic-scenario caveat, and the dropped third measure", () => {
    renderGovernance();
    const effectiveness = screen.getByTestId("ward-governance-effectiveness");
    expect(effectiveness).toBeInTheDocument();

    // Real fixture fact: WF-006 is the only movement with a recoverable acceptance instant —
    // openedAt NOW_ANCHOR-500, its sole withdrawnReferrals entry at NOW_ANCHOR-470 — 30 minutes.
    // It is the only movement in the whole 48-record fixture with a non-empty withdrawnReferrals
    // array (and no movement carries a hand-authored `acceptedAt`), so the median is exactly this
    // one value, not the "not enough data" fallback.
    const acceptance = screen.getByTestId("ward-governance-effectiveness-acceptance");
    // ⚠️ AMENDED 2026-08-30. This asserted the screen shows "30" and NOT the fallback. The owner's
    // floor ruling reversed it: one recoverable acceptance is below MINIMUM_EFFECTIVENESS_SAMPLE,
    // so the board now suppresses the figure and says so.
    expect(acceptance).toHaveTextContent("Not enough data to compute");
    expect(acceptance, "the retired median is still being printed").not.toHaveTextContent("30 min");

    // ⚠️ AND A GUARD MOVED RATHER THAN VANISHED, WHICH IS THE PART WORTH WRITING DOWN. This block
    // also carried a sign-flip check — a duration computed as `openedAt - acceptedAt` would render
    // "-30" and still contain the substring "30" — and it existed precisely so the SCREEN caught it
    // rather than only the derivation. A suppressed figure cannot catch a sign flip at all, so that
    // coverage now rests entirely on `tests/ward-governance.test.ts`, which asserts exact positive
    // values (50, 30) and would fail on a negated duration. Checked before this line was removed;
    // stated here so the loss is visible rather than discovered later as an absence.

    // The real fixture carries several accepted/referred/declined movements, so this is
    // computable too — asserted as present and numeric rather than pinned to an exact value
    // this suite does not independently derive.
    const unitsContacted = screen.getByTestId("ward-governance-effectiveness-units-contacted");
    expect(unitsContacted).not.toHaveTextContent("Not enough data to compute");
    expect(unitsContacted.textContent).toMatch(/\d/);

    expect(effectiveness).toHaveTextContent("Neither is evidence that this prototype works");

    const dropped = screen.getByTestId("ward-governance-dropped-measure");
    expect(dropped).toHaveTextContent("legal deadlines passed while a patient waits");
    expect(dropped).toHaveTextContent("dropped");
    expect(dropped).toHaveTextContent("cannot be computed");
  });

  // Fix round 1, point 3, AMENDED 2026-08-30 by the owner's floor ruling. This is the honesty
  // test, not the arithmetic test — measured against the real fixture (27 total acceptances, only
  // 1 with a recoverable timestamp; 32 of 50 movements referred at least one unit).
  //
  // ⚠️ IT USED TO ASSERT "30 minfrom 1 of 27 recorded acceptances", and that figure is no longer
  // published: below MINIMUM_EFFECTIVENESS_SAMPLE the board says "Not enough data to compute"
  // instead. The owner's argument was that the word MEDIAN means "a typical case" to a clinician
  // and no caveat printed beside it undoes that.
  //
  // ⚠️ THE BASIS ASSERTION IS THE PART THAT MUST NOT BE LOST, and it is why this test was not
  // simply deleted. The floor sits BENEATH the disclosure rule rather than replacing it: "from 1
  // of 27" still renders, now beside the absence, and that is what makes the absence informative
  // rather than merely blank. A reader learns there ARE 27 acceptances and only one is measurable
  // — which is the fact that sent somebody looking for the missing timestamp.
  it("shows the acceptance figure's true basis beside its SUPPRESSION — 1 of 27 recorded acceptances", () => {
    renderGovernance();
    const acceptance = screen.getByTestId("ward-governance-effectiveness-acceptance");
    // One assertion against the combined text, so a basis rendered elsewhere on the page (not
    // immediately beside the suppression) would not satisfy this check.
    expect(acceptance).toHaveTextContent("Not enough data to computefrom 1 of 27 recorded acceptances");
    // And the retired figure must be gone rather than merely joined by the caveat.
    expect(acceptance, "the suppressed median is still being printed somewhere in this line").not.toHaveTextContent(
      "30 min",
    );

    const unitsContacted = screen.getByTestId("ward-governance-effectiveness-units-contacted");
    expect(unitsContacted, "the basis denominator no longer matches the fixture").toHaveTextContent(
      "from 32 of 50 movements that referred at least one unit",
    );
    // 48 -> 50 on 2026-08-30 for WF-019 and WF-020, the two long waits. The NUMERATOR is unchanged
    // at 32: neither has referred a unit, which is why they wait. A denominator moving while the
    // numerator holds is exactly what adding two unplaced patients should do, and checking that
    // rather than only re-running is what separates a verified figure from a re-baselined one.
  });
});
