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
    // array, so the median is exactly this one value, not the "not enough data" fallback.
    const acceptance = screen.getByTestId("ward-governance-effectiveness-acceptance");
    expect(acceptance).toHaveTextContent("30");
    // A sign-flipped duration (openedAt - acceptedAt instead of acceptedAt - openedAt) would
    // still contain the substring "30" as "-30" — guard against that directly rather than
    // relying only on the derivation-level unit test to catch it.
    expect(acceptance).not.toHaveTextContent("-30");
    expect(acceptance).not.toHaveTextContent("Not enough data to compute");

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
});
