import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Task 10 (spec item 8). The patient page showed the legal form but not three records the
 * binding spec requires: declines, status/urgency changes, and the escalation record.
 *
 * WF-009 is the fixture's one movement carrying an escalation and its five declines (measured
 * against `ward-movements.ts` directly). WF-010 is the fixture's one movement carrying a
 * hand-authored `statusChanges` entry. Neither carries a hand-authored `urgencyChanges` entry —
 * every fixture movement seeds that array empty — so the urgency-change half of the "changes"
 * section is proven by dispatching a real `CHANGE_URGENCY` event against WF-010 (same technique
 * as `tests/ward-screen.dom.test.tsx`'s `ReferWF301ToRphAdultSecure`: a real reducer dispatch,
 * not a hand-edited fixture), rather than weakening the assertion to skip that half. WF-001
 * carries none of the three records and is not closed, so it is the empty-state case.
 */
const WF_009 = movementById("WF-009");
const WF_010 = movementById("WF-010");
const WF_001 = movementById("WF-001");

function DispatchUrgencyChangeOnWF010() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "CHANGE_URGENCY",
          role: "coordinator",
          now,
          movementId: "WF-010",
          urgency: 1,
          reason: "reassessed",
        })
      }
    >
      raise WF-010 urgency
    </button>
  );
}

describe("ward patient page — declines, changes, and escalation", () => {
  it("fixture assumptions: WF-009 carries declines and an escalation, WF-010 carries a status change, WF-001 carries none of the three and is open", () => {
    expect(WF_009?.declines.length).toBe(5);
    expect(WF_009?.escalation).toBeDefined();
    expect(WF_010?.statusChanges.length).toBe(1);
    expect(WF_010?.urgencyChanges.length).toBe(0);
    expect(WF_010?.closure).toBeUndefined();
    expect(WF_001?.declines.length).toBe(0);
    expect(WF_001?.statusChanges.length).toBe(0);
    expect(WF_001?.urgencyChanges.length).toBe(0);
    expect(WF_001?.escalation).toBeUndefined();
    expect(WF_001?.closure).toBeUndefined();
  });

  it("lists each decline's unit, fixed reason label, and time — never a raw snake_case reason code", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPatientWorkspace patientId="WF-009" />
      </WardFlowProvider>,
    );

    const declines = screen.getByTestId("ward-patient-declines");
    // Five declines, each naming its unit by name (never a bare unit id) and a human label for
    // its reason (never the raw snake_case code).
    expect(
      within(declines).getByText(
        (_, node) => node?.textContent === `${unitById("rph-adult-secure")?.name} · No bed available`,
      ),
    ).toBeInTheDocument();
    expect(
      within(declines).getByText(
        (_, node) => node?.textContent === `${unitById("gry-adult-secure")?.name} · Acuity mix`,
      ),
    ).toBeInTheDocument();
    expect(
      within(declines).getByText(
        (_, node) => node?.textContent === `${unitById("bty-adult-secure")?.name} · Bed held for earlier referral`,
      ),
    ).toBeInTheDocument();
    expect(
      within(declines).getByText(
        (_, node) => node?.textContent === `${unitById("fsh-adult-secure")?.name} · Specialling unavailable`,
      ),
    ).toBeInTheDocument();
    expect(
      within(declines).getByText(
        (_, node) => node?.textContent === `${unitById("rgh-adult-secure")?.name} · Capability mismatch`,
      ),
    ).toBeInTheDocument();

    // No raw snake_case reason code anywhere in this section's rendered text.
    const rawCodes = [
      "no_bed",
      "acuity_mix",
      "bed_held_for_earlier_referral",
      "specialling_unavailable",
      "capability_mismatch",
    ];
    for (const code of rawCodes) {
      expect(declines.textContent).not.toContain(code);
    }
  });

  it("shows the escalation record — when, units tried, and contact", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPatientWorkspace patientId="WF-009" />
      </WardFlowProvider>,
    );

    const escalation = screen.getByTestId("ward-patient-escalation");
    expect(escalation).toHaveTextContent("State bed coordination desk");
    expect(escalation).toHaveTextContent(unitById("rph-adult-secure")?.name ?? "");
    expect(escalation).toHaveTextContent(unitById("rgh-adult-secure")?.name ?? "");
  });

  it("lists a status change and, once one is dispatched, an urgency change too — never a raw reason code", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DispatchUrgencyChangeOnWF010 />
        <WardPatientWorkspace patientId="WF-010" />
      </WardFlowProvider>,
    );

    const changes = screen.getByTestId("ward-patient-changes");
    // WF-010's hand-authored status change: Voluntary -> Detained awaiting examination,
    // reason "recorded_by_treating_team" -> label "Recorded by treating team".
    // Asserted as an ORDERED PAIR, not as two independent substrings. Checking each value
    // separately survives a mutation that swaps `from` and `to`, which would render this patient's
    // legal status change backwards — "Detained awaiting examination → Voluntary" instead of the
    // reverse. On a screen about a person's legal status that is not a cosmetic slip, and the
    // separate-substring form could not catch it. Task 8/10's implementer found the surviving
    // mutation and reported it rather than reshaping the test, which is why this is fixed here.
    expect(changes.textContent).toContain("Voluntary → Detained awaiting examination");
    expect(changes.textContent).not.toContain("Detained awaiting examination → Voluntary");
    expect(changes).toHaveTextContent("Recorded by treating team");
    expect(changes.textContent).not.toContain("recorded_by_treating_team");

    // Before the dispatch, no urgency change is recorded yet.
    expect(changes.textContent).not.toContain("Tier 2 → Tier 1");

    fireEvent.click(screen.getByRole("button", { name: "raise WF-010 urgency" }));

    const changesAfter = screen.getByTestId("ward-patient-changes");
    // WF-010 seeds at urgency 2 (see ward-movements.ts); the dispatched CHANGE_URGENCY event
    // raises it to 1 with reason "reassessed" -> label "Reassessed", never the raw code.
    expect(changesAfter).toHaveTextContent("Tier 2 → Tier 1");
    expect(changesAfter).toHaveTextContent("Reassessed");
    expect(changesAfter.textContent).not.toContain("reassessed");
  });

  it("renders an explicit absence line in all three sections for a movement with none of these — not a hidden section", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPatientWorkspace patientId="WF-001" />
      </WardFlowProvider>,
    );

    const declines = screen.getByTestId("ward-patient-declines");
    const changes = screen.getByTestId("ward-patient-changes");
    const escalation = screen.getByTestId("ward-patient-escalation");

    // All three sections are present in the DOM (not hidden) and each carries its own explicit
    // absence line rather than rendering nothing.
    expect(declines).toBeInTheDocument();
    expect(declines).toHaveTextContent("No declines recorded for this movement.");
    expect(changes).toBeInTheDocument();
    expect(changes).toHaveTextContent("No status or urgency changes recorded for this movement.");
    expect(escalation).toBeInTheDocument();
    expect(escalation).toHaveTextContent("No escalation recorded for this movement.");
  });
});
