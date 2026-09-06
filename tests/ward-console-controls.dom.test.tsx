import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { MOVEMENT_STAGES, type LegalStatus, type MovementId } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ THE CONTROLS ACTUALLY DO SOMETHING — which is the assertion the reducer tests cannot make.
 *
 * `tests/ward-urgent-flag.test.ts` and `tests/ward-movement-blocker.test.ts` prove the events work.
 * Neither can prove a SCREEN raises one, and that gap is exactly the shape of the defect being
 * repaired here: `Movement.flaggedUrgent` had a working ordering rule, a working badge, and no
 * control anywhere in the application. A reducer test would have been green throughout.
 *
 * This file therefore drives the real buttons on the real workspace, through a real provider, and
 * reads the result off the rendered page rather than out of state — so a control wired to local
 * `useState` instead of a dispatch fails here even though it would look right on screen.
 */
const WF_001 = movementById("WF-001");
const WF_008 = movementById("WF-008");
const WF_004 = movementById("WF-004");

function renderWorkspace(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

/**
 * Test-only scaffold, not a new application surface: fires a real reducer event through the real
 * provider so a fix that only reads `now`/the record correctly is exercised the same way the
 * urgent-flag and blocker tests above exercise theirs. Two events are needed and neither has a
 * button anywhere on this page yet: `ADVANCE_CLOCK` (role `demo`) is exactly the mechanism the
 * live review used to cross a statutory deadline and midnight, and `CHANGE_LEGAL_STATUS` (role
 * `coordinator`) is how a Voluntary-on-a-locked-ward combination is reached at all — no seeded
 * movement carries that combination directly.
 */
function WorkspaceTestControls({ movementId, legalStatus }: { movementId: MovementId; legalStatus?: LegalStatus }) {
  const { dispatch, now } = useWardFlow();
  return (
    <>
      <button
        type="button"
        data-testid="test-advance-clock"
        onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 350 })}
      >
        advance clock
      </button>
      <button
        type="button"
        data-testid="test-advance-clock-far"
        onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 800 })}
      >
        advance clock far
      </button>
      {legalStatus ? (
        <button
          type="button"
          data-testid="test-change-legal-status"
          onClick={() =>
            dispatch({
              type: "CHANGE_LEGAL_STATUS",
              role: "coordinator",
              now,
              movementId,
              legalStatus,
              reason: "recorded_by_treating_team",
            })
          }
        >
          change legal status
        </button>
      ) : null}
    </>
  );
}

function renderWorkspaceWithControls(movementId: MovementId, legalStatus?: LegalStatus) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WorkspaceTestControls movementId={movementId} legalStatus={legalStatus} />
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("the movement workspace's urgent-flag control", () => {
  it("fixture assumption: WF-001 is open and unflagged", () => {
    expect(WF_001?.closure).toBeUndefined();
    expect(WF_001?.flaggedUrgent).toBe(false);
  });

  it("flags, says so in words, and offers the way back", () => {
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-urgent-flag");

    // Before: the state is stated, not left to the button's label.
    expect(within(panel).getByText(/not flagged/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-console-urgent-flag-toggle"));

    // After: the page has re-rendered FROM THE RECORD. A control holding its own boolean would
    // also flip the label here — what it could not do is survive the round trip through the
    // reducer, which is what the queue-ordering sentence below depends on.
    expect(within(panel).getByText(/leads the queue ahead of every urgency tier/i)).toBeInTheDocument();
    expect(screen.getByTestId("ward-console-urgent-flag-toggle")).toHaveTextContent(/remove the urgent flag/i);

    // And back down again. A flag that could be set but not cleared would be a new permanent state.
    fireEvent.click(screen.getByTestId("ward-console-urgent-flag-toggle"));
    expect(within(panel).getByText(/not flagged/i)).toBeInTheDocument();
  });
});

describe("the movement workspace's blocker control", () => {
  it("fixture assumption: WF-001 carries the fixture's own opening blocker", () => {
    expect(WF_001?.blocker).toBe("Confirming destination options");
  });

  it("records what a person typed, verbatim, and shows it back from the record", () => {
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-blocker");
    expect(within(panel).getByText("Confirming destination options")).toBeInTheDocument();

    const input = screen.getByTestId("ward-console-blocker-input");
    // One of the five values the owner's ruling turns on — free prose naming a party the model has
    // no field for. Typed through the real control rather than dispatched directly.
    fireEvent.change(input, { target: { value: "Awaiting specialling roster confirmation" } });
    fireEvent.submit(input.closest("form")!);

    expect(within(panel).getByText("Awaiting specialling roster confirmation")).toBeInTheDocument();
  });

  it("offers a Clear control, so nobody has to guess the magic words", () => {
    // ⚠️ The screen half of the repair. `hasActiveBlocker` recognises "nothing is blocking" by exact
    // match against a closed set, so a person TYPING "none — resolved" left the movement scoring ten
    // points as obstructed. This is the control that means they never have to.
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-blocker");
    expect(within(panel).getByText("Confirming destination options")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-console-blocker-clear"));

    expect(within(panel).getByText("None — cleared")).toBeInTheDocument();
    // And it goes away once there is nothing left to clear — the reducer refuses a second clear,
    // and a control that will be refused teaches a clinician to distrust the controls.
    expect(screen.queryByTestId("ward-console-blocker-clear")).toBeNull();
  });

  it("cannot submit a blank, so an empty blocker never reaches the reducer", () => {
    renderWorkspace("WF-001");
    // Native `disabled` here is transient inertness — a form action awaiting validity — which is
    // what `docs/wiring-conventions.md` keeps `disabled` for. It is NOT an unavailable feature, so
    // `aria-disabled` would be the wrong pattern and the two together fail lint.
    const submit = screen.getByRole("button", { name: /record it/i });
    expect(submit).toBeDisabled();
    expect(submit).not.toHaveAttribute("aria-disabled");

    fireEvent.change(screen.getByTestId("ward-console-blocker-input"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /record it/i })).toBeDisabled();
  });
});

/**
 * ⚠️ THREE CLINICAL DEFECTS, movement-workspace-review-2026-09-04.md findings 1-3 — every one a
 * false statement on a screen a coordinator acts from. Each block below drives the real workspace
 * through the real provider, the same discipline the two describe blocks above already use, so a
 * fix that only changes a comment (or a helper nothing on screen calls) fails here.
 */
describe("finding 1 — a closed movement must not render as live and actionable", () => {
  it("fixture assumption: WF-008 is closed by self-discharge, not arrival, 20 minutes before now", () => {
    expect(WF_008?.closure).toEqual({
      at: NOW_ANCHOR - 20,
      outcome: "did_not_proceed",
      // Seed gap fixed 2026-09-04: the sentence used to say "before transport arrived" on a
      // movement that carries no `transport` at all — this stage never progressed past
      // accepted_awaiting_bed, so nothing was ever booked to arrive. Reworded to be true of the
      // record beside it.
      reason: "Patient self-discharged from ED before transport was arranged",
    });
    expect(WF_008?.stage).not.toBe("arrived");
  });

  it("carries a closure banner stating the outcome and reason, with a day-aware instant", () => {
    renderWorkspaceWithControls("WF-008");
    const banner = screen.getByTestId("workspace-closure-banner");
    expect(within(banner).getByText(/did not proceed/i)).toBeInTheDocument();
    expect(
      within(banner).getByText(/patient self-discharged from ed before transport was arranged/i),
    ).toBeInTheDocument();
    // Same day as `now` at mount (closure.at = NOW_ANCHOR - 20): the clock face alone, "10:22",
    // with no day suffix — this on its own cannot tell `formatInstantWithDay` from `formatInstant`,
    // which is exactly why the next assertion advances the clock across midnight.
    expect(banner.textContent).toMatch(/10:22/);
    expect(banner.textContent).not.toMatch(/yesterday|tomorrow|days ago|in \d+ days/);

    // Advance `now` by 800 minutes (13h20) — `closure.at` is fixed at seed time and does not move,
    // so `now` crosses into the next demo day relative to it. `formatInstant` would still print the
    // unchanged clock face "10:22"; `formatInstantWithDay` must say "yesterday" as well, which is
    // the exact defect finding 3 describes for the legal-form deadline one field over.
    fireEvent.click(screen.getByTestId("test-advance-clock-far"));
    expect(banner.textContent).toMatch(/10:22 yesterday/);
  });

  it("does not compute an eligibility verdict at all until somebody asks for one", () => {
    // ⚠️ WARD LEAD RULING 1, 2026-09-04, WHICH WITHDREW AN EARLIER INSTRUCTION TO SHOW THE VERDICT
    // WITH A CAVEAT BESIDE IT. This page will be printed or screenshotted into a review of a
    // patient who came to harm, and "Eligible now" beside somebody who never got a bed reads as an
    // accusation that a bed was there and nobody took it. A caveat is exactly what a screenshot
    // crops and a reader skips; a control is not, because the caveat is the thing they clicked.
    renderWorkspace("WF-008");
    expect(screen.queryByTestId("ward-console-eligibility-summary")).toBeNull();
    expect(screen.queryByTestId("ward-console-alternatives")).toBeNull();
    expect(screen.queryByText(/eligible now/i)).toBeNull();

    fireEvent.click(screen.getByTestId("ward-console-reveal-eligibility"));

    const summary = screen.getByTestId("ward-console-eligibility-summary");
    // And the caveat is now unavoidable: it is the first thing inside the block that was revealed.
    expect(
      within(summary).getByText(/This is a calculation against the wards as they are right now/i),
    ).toBeInTheDocument();
    expect(within(summary).getByText(/not a record of what was true when this movement closed/i)).toBeInTheDocument();
  });

  it("says the movement STOPPED at a stage rather than calling it the current one", () => {
    // ⚠️ "Current stage" IS THE WRONG NOUN ON A CLOSED MOVEMENT. It stopped there; it is not
    // currently anything. Proved against the open case too, so the label is not simply gone.
    renderWorkspace("WF-008");
    expect(screen.getByText("Stopped at")).toBeInTheDocument();
    expect(screen.queryByText("Current stage")).toBeNull();

    cleanup();
    renderWorkspace("WF-001");
    expect(screen.getByText("Current stage")).toBeInTheDocument();
    expect(screen.queryByText("Stopped at")).toBeNull();
  });

  it("marks no step as current on a closed movement, and exactly one on an open one", () => {
    // Observed 2026-09-04: the closure banner said the movement was over while step 3 rendered in
    // accent blue as though it were live. The step track is the third place a closed movement used
    // to claim it was running, and `data-state` is what the stylesheet keys the accent off — so
    // this asserts the attribute the paint actually depends on, not the paint.
    renderWorkspace("WF-008");
    const closedTrack = screen.getByTestId("ward-console-track");
    expect(closedTrack.querySelectorAll('[data-state="current"]')).toHaveLength(0);
    expect(closedTrack.querySelectorAll('[data-state="stopped"]')).toHaveLength(1);
    // A future step is not clickable, and neither is a past one: this is a record, not a control.
    expect(closedTrack.querySelectorAll("button")).toHaveLength(0);
    expect(closedTrack.querySelectorAll("li")).toHaveLength(MOVEMENT_STAGES.length);

    cleanup();
    renderWorkspace("WF-001");
    const openTrack = screen.getByTestId("ward-console-track");
    expect(openTrack.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    expect(openTrack.querySelectorAll('[data-state="stopped"]')).toHaveLength(0);
  });

  it("'Tier N' never claims to lead, on an open movement or a closed one", () => {
    // Item 4: this is a statement about the sort key, not about this patient's position, and it is
    // removed from the page ENTIRELY — proved on an OPEN movement (WF-001) so the removal cannot be
    // mistaken for a side effect of the closed-movement arrangement tested above. The tier itself
    // is still stated, as a chip in the masthead.
    renderWorkspace("WF-001");
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
    expect(screen.queryByText(/leads the queue/i)).toBeNull();
    expect(screen.queryByText(/Tier \d leads/i)).toBeNull();
  });

  it("a closed movement's Transport lines do not assert an outstanding booking, in either panel", () => {
    // ⚠️ THE TRANSPORT SENTENCE MOVED (Ward Lead judgement, 2026-09-04). Readiness and the
    // Transport panel printed `transportReadinessLine` word for word — one of the five
    // duplications the cold read counted. The FACT now lives in the Transport panel; Readiness
    // states only the travelling verdict. Both are asserted here so the move cannot quietly
    // become a deletion, and neither may go back to claiming a booking is outstanding.
    renderWorkspace("WF-008");
    const readiness = screen.getByTestId("ward-console-readiness");
    const transport = screen.getByTestId("ward-console-transport-panel");
    expect(within(transport).getByText("No transport was arranged before this movement closed")).toBeInTheDocument();
    expect(within(readiness).getByText("Nothing was arranged before this movement closed.")).toBeInTheDocument();
    expect(within(readiness).queryByText(/not yet requested/i)).toBeNull();
    expect(within(transport).queryByText(/not yet requested/i)).toBeNull();
  });
});

describe("finding 2 — the voluntary-on-locked warning must render, not just reorder", () => {
  it("fixture assumption: WF-008 is Voluntary, with RPH and FSH Adult Secure among its alternatives", () => {
    // WF-008 is ALSO closed (finding 1's fixture) — `eligibleCandidatesAmong` computes Alternatives
    // from the units and the movement's own clinical fields, not from `isOpen`, so the closed
    // movement in finding 1 and the stripped-warning movement in finding 2 are the same record.
    expect(WF_008?.legalStatus).toBe("Voluntary");
    expect(WF_008?.security).toBe("Open");
  });

  it("shows the warning text on every locked-ward alternative, marked with data-restriction, without touching eligibility", () => {
    renderWorkspace("WF-008");
    // WF-008 is closed, so the eligibility block sits behind its own control (ruling 1 above). The
    // warning still has to survive being asked for — a legal risk that only appears on movements
    // nobody looked at twice would be worse than useless.
    fireEvent.click(screen.getByTestId("ward-console-reveal-eligibility"));
    const alternatives = screen.getByTestId("ward-console-alternatives");
    // Review finding 2 named both: "RPH Adult Secure" and "FSH Adult Secure" each offered as
    // "Eligible now" with the legal warning stripped. Both rows carry it, so both are checked.
    // Selected by the RESTRICTION ATTRIBUTE, not by the sentence. The attribute is the contract
    // between the derivation and the screen; the sentence is rendering, and the owner is rewording
    // these pages. Finding the notices by their text made a reworded warning look like a MISSING
    // warning — the same red as the defect this test exists for, which is the one thing it must
    // never be confused with.
    const notices = Array.from(alternatives.querySelectorAll<HTMLElement>('[data-restriction="voluntary_on_locked"]'));
    expect(notices, "both locked-ward alternatives must carry the restriction marker").toHaveLength(2);
    for (const notice of notices) {
      expectSays(notice.textContent ?? "", "the locked-ward legal-status warning", ["voluntary", "locked", "legal"]);
      // Information, never a gate: the row this notice sits on still reads its own real verdict.
      // Walked by DOM structure (span -> row), never by CSS-module class name — the vitest
      // CSS-module proxy fabricates a class for any property asked of it, so a
      // `.closest(".alternativeRow")` selector would silently match nothing rather than fail loudly.
      const row = notice.closest("li")!;
      expect(within(row).getByText("Eligible", { selector: "b" })).toBeInTheDocument();
    }
  });

  it("also shows the warning for the CHOSEN destination once it is voluntary-on-locked", () => {
    // No seeded movement carries this combination on its OWN accepted unit — WF-004 is accepted at
    // BTY Adult Secure (a locked ward) as an involuntary inpatient. `CHANGE_LEGAL_STATUS` is a real,
    // already-tested reducer event (`tests/ward-legal-status-change.test.ts` proves the event
    // itself); dispatching it here reaches the combination through the real record rather than
    // inventing a fixture the model does not have.
    renderWorkspaceWithControls("WF-004", "Voluntary");
    expect(screen.queryByTestId("ward-console-destination-restriction")).toBeNull();

    fireEvent.click(screen.getByTestId("test-change-legal-status"));

    const notice = screen.getByTestId("ward-console-destination-restriction");
    expectSays(notice.textContent ?? "", "the locked-ward legal-status warning", ["voluntary", "locked", "legal"]);
    expect(notice).toHaveAttribute("data-restriction", "voluntary_on_locked");
  });
});

describe("finding 3 — a statutory deadline must carry its day and its breach state", () => {
  it("fixture assumption: WF-004's Form 4C is due 5 hours after NOW_ANCHOR, not yet breached", () => {
    expect(WF_004?.legalForm).toEqual({ code: "4C", kind: "transfer", dueAt: NOW_ANCHOR + 300 });
  });

  it("prints the due day-and-time where the form lives, and reports overdue in words there and in the rail", () => {
    // ⚠️ THE FORM LINE HAS ONE HOME NOW (Ward Lead judgement, 2026-09-04). It was printed in
    // Readiness AND in the legal panel, character for character. The original defect this test
    // exists for — a bare clock face reading "due 08:48" unchanged straight through a breach —
    // is unchanged and still asserted; what moved is WHERE, and that a second copy is gone.
    renderWorkspaceWithControls("WF-004");

    // Finding 11: the four "tabs" were never tabs — the Overview grid rendered byte-identical
    // under all four selections and the others appended below it. They are gone, so this panel is
    // simply on the page and needs no navigation to reach.
    expect(screen.queryByRole("button", { name: /legal & forms/i })).toBeNull();
    const legalPanel = screen.getByTestId("ward-console-legal-panel");
    expect(within(legalPanel).getByText(/due 15:42/)).toBeInTheDocument();
    expect(within(legalPanel).queryByText(/overdue/i)).toBeNull();

    // Readiness states the verdict and points at the panel above. It must not carry a second copy
    // of the clock face — that is the duplication the ruling names.
    const readiness = screen.getByTestId("ward-console-readiness");
    expect(within(readiness).getByText("Recorded, and its deadline is still ahead.")).toBeInTheDocument();
    expect(within(readiness).queryByText(/15:42/)).toBeNull();

    // Advance `now` by 350 minutes: the deadline (NOW_ANCHOR + 300) is now 50 minutes in the past.
    fireEvent.click(screen.getByTestId("test-advance-clock"));

    expect(within(legalPanel).getByText(/due 15:42 — 50m overdue/)).toBeInTheDocument();
    // And the breach reaches the reader who is scanning rather than reading: the attention rail
    // carries the minutes, and Readiness says the deadline has passed and where to read it.
    expect(
      within(readiness).getByText("Recorded, and its deadline has passed. Needs attention says by how much."),
    ).toBeInTheDocument();
    const rail = screen.getByTestId("ward-console-attention");
    expect(within(rail).getByText(/50m overdue/)).toBeInTheDocument();
  });
});

/**
 * ⚠️ THE COLD READ OF 2026-09-04 — six defects and one judgement, every one of them a thing a
 * coordinator would read wrongly off a page whose tests were all green. The judgement block is
 * last and is the one that matters: the page was harder to scan than what it replaced, because
 * the same fact met the reader up to four times and each encounter cost a decision about whether
 * it was new.
 */
describe("D1 — a figure tile must count the thing its label promises", () => {
  it("fixture assumption: WF-004 has no open referral and one ward that accepted", () => {
    expect(WF_004?.referredUnitIds).toEqual([]);
    expect(WF_004?.acceptedUnitId).toBe("bty-adult-secure");
  });

  it("names open referrals, so 'None' is true on a movement a ward has already accepted", () => {
    // ⚠️ "Wards referred to · None" WAS FALSE ON TWO OF THE THREE FIXTURES. `referredUnitIds` holds
    // the referrals still OPEN — an answered one leaves it — so on WF-004 the big figure read
    // "nobody was asked" on a page that says twice over that Bentley accepted. The number is what
    // gets scanned; a correcting sub-line underneath is read second or not at all.
    renderWorkspace("WF-004");
    const figures = screen.getByTestId("ward-console-figures");
    expect(within(figures).getByText("Referrals still open")).toBeInTheDocument();
    expect(within(figures).queryByText("Wards referred to")).toBeNull();
    expect(
      within(figures).getByText("No referral is open. No ward declined, and BTY Adult Secure accepted."),
    ).toBeInTheDocument();
  });

  it("says the same 'None' differently on the movement five wards refused", () => {
    // The third meaning the identical tile used to carry: asked five times, refused five times.
    renderWorkspace("WF-009");
    const figures = screen.getByTestId("ward-console-figures");
    expect(within(figures).getByText("Referrals still open")).toBeInTheDocument();
    expect(within(figures).getByText("No referral is open. 5 wards declined and none accepted.")).toBeInTheDocument();
  });
});

describe("D2 — the shortlist denominator is the cohort, and a shortlist with nothing in it says so", () => {
  it("counts the movement's own cohort, derived from the live units and never hardcoded", () => {
    // ⚠️ `eligibleCandidatesAmong` filters `unit.cohort === movement.cohort` BEFORE ranking, so
    // "3 of 23" credited the search with seven wards that were never candidates. Computed here
    // from the same source the component reads, so a ward added to the map moves both together.
    const adultWards = allUnits().filter((unit) => unit.cohort === "Adult").length;
    expect(adultWards).toBe(16);
    expect(allUnits()).toHaveLength(23);

    renderWorkspace("WF-009");
    const shortlist = screen.getByTestId("ward-console-alternatives").closest("section")!;
    expect(within(shortlist).getByText(`3 of ${adultWards}`)).toBeInTheDocument();
    expect(within(shortlist).queryByText("3 of 23")).toBeNull();
    expect(within(shortlist).getByText(/16 adult wards in the network/)).toBeInTheDocument();
  });

  it("says on the page when no ward on the list could take this patient", () => {
    // ⚠️ WF-009 IS THE ONE PATIENT NOBODY CAN PLACE, and the panel headed "Other wards, ranked"
    // listed three wards of which two had already declined and the third fails a secure gate. A
    // coordinator reads that heading as somewhere left to try.
    renderWorkspace("WF-009");
    expect(screen.getByTestId("ward-console-no-usable-alternative")).toHaveTextContent(
      /No ward on this list could take this patient/,
    );
  });

  it("does not say it on a movement whose shortlist does hold a usable ward", () => {
    // The anti-vacuity half: a note that appeared on every movement would say nothing at all.
    renderWorkspace("WF-001");
    expect(screen.queryByTestId("ward-console-no-usable-alternative")).toBeNull();
  });
});

describe("D3 — the audit timeline must not promise ten kinds of event and deliver one", () => {
  it("fixture assumption: WF-004 records a bed hold that ran out, and no stage change at all", () => {
    expect(WF_004?.pullExpiresAt).toBe(NOW_ANCHOR - 10);
    expect(WF_004?.stageChanges).toEqual([]);
    expect(WF_004?.acceptedAt).toBeUndefined();
  });

  it("emits the dated facts the record holds, including the bed hold the figure strip already prints", () => {
    // ⚠️ ONE ROW, "Movement opened", on a movement that reached step 4, had a ward accept it, and
    // had a bed hold run out at 05:40 — a dated fact printed in its own tile on the same page.
    renderWorkspace("WF-004");
    const timeline = screen.getByTestId("ward-console-timeline");
    expect(within(timeline).getByText("Movement opened")).toBeInTheDocument();

    /*
     * ⚠️ **THIS WAS AN EXACT-STRING `getByText` ON RENDERED COPY UNTIL 2026-09-06, AND IT WENT RED
     * THE MOMENT THAT COPY WAS CORRECTED.** The label said "The hold on the bed at … ran out"; the
     * owner has ruled a reserved bed is a PULL, so the label changed and this assertion had to move
     * with it — which is the tell. **A guard that must be edited every time correct copy is reworded
     * is a tripwire on the redesign, not on the defect**, and the owner's standing instruction is
     * that testing works with redesigns rather than fighting them.
     *
     * Re-pinning the new sentence verbatim would have moved the tripwire one rewording along and
     * cost the same edit again next time. So it asserts the CLAIM instead: this timeline names the
     * bed reservation ending, at the named destination. Reword it freely; it may not stop saying it.
     *
     * The vocabulary itself is pinned where it belongs — `ward-pull-vocabulary.dom.test.tsx` for
     * the rendered controls, and `ward-delay-cause-vocabulary.test.ts` for the copy table. This
     * assertion deliberately does NOT check which word is used, because two guards over one fact
     * disagree eventually and the wording one is already owned elsewhere.
     */
    // Found by the DESTINATION, which is data rather than copy and so cannot be reworded. My first
    // attempt at this located the row by matching "ran out" — swapping one pinned phrase for
    // another, which is the same defect one step quieter.
    const bedRow = within(timeline)
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "")
      .find((text) => text.includes("BTY Adult Secure"));
    expect(
      bedRow,
      "the timeline no longer carries a dated row naming BTY Adult Secure. The bed reservation " +
        "ending is a DATED fact the record holds and the figure strip already prints, so its " +
        "absence here is the short-list defect this test exists for — not a wording change.",
    ).toBeDefined();
    expectSays(bedRow ?? "", "the bed-reservation row", ["bed"]);
    expectSays(bedRow ?? "", "the bed-reservation row's ending", ["ran out", "expired", "lapsed", "ended"]);

    expect(timeline.querySelectorAll("li").length).toBeGreaterThan(1);
  });

  it("names what happened that nothing timed, rather than dropping it out of a list calling itself complete", () => {
    // ⚠️ THE BLURB IS WHAT MADE THE SHORT LIST HARMFUL: it turned "nothing was timed" into
    // "nothing happened". An undated fact cannot be placed in a chronological record without
    // inventing an instant, so it is named underneath instead.
    renderWorkspace("WF-004");
    const untimed = screen.getByTestId("ward-console-untimed");
    expect(within(untimed).getByText(/reached step 4 of 7/)).toBeInTheDocument();
    expect(within(untimed).getByText(/BTY Adult Secure accepted this patient/)).toBeInTheDocument();
    const timelinePanel = screen.getByTestId("ward-console-timeline").closest("section")!;
    expect(within(timelinePanel).queryByText(/stage transitions, legal-status and urgency changes/)).toBeNull();
  });
});

describe("D4, D5, D6 — a closed movement must not contradict itself", () => {
  it("does not say a closed movement is held up and unholdable-up on one screen", () => {
    // ⚠️ WF-008 SAID BOTH: Readiness "what is holding it up: Patient declined transfer", and the
    // control "nothing can be holding it up and no new blocker can be recorded against it".
    renderWorkspace("WF-008");
    expect(screen.queryByText(/nothing can be holding it up/i)).toBeNull();
    const readiness = screen.getByTestId("ward-console-readiness");
    expect(within(readiness).queryByText("Patient declined transfer")).toBeNull();
    expect(
      within(readiness).getByText(/A note was recorded before this movement closed\. Nothing is holding it up now/),
    ).toBeInTheDocument();
    // The note itself survives, once, where it can be read beside the controls that change it.
    const blockerPanel = screen.getByTestId("ward-patient-blocker");
    expect(within(blockerPanel).getByText("Patient declined transfer")).toBeInTheDocument();
    expect(within(blockerPanel).getByText(/The note above is what was recorded before it stopped/)).toBeInTheDocument();
  });

  it("gives the readiness panel the tense every other panel already had", () => {
    // ⚠️ D5: the header still read "before this patient can travel" about a patient who will never
    // travel. Proved against the open case too, so the wording is not simply gone.
    renderWorkspace("WF-008");
    expect(screen.getByText("Readiness when this stopped")).toBeInTheDocument();
    expect(screen.queryByText(/have to be true before this patient can travel/)).toBeNull();

    cleanup();
    renderWorkspace("WF-001");
    expect(screen.getByText("Readiness")).toBeInTheDocument();
    expect(screen.queryByText("Readiness when this stopped")).toBeNull();
  });

  it("does not claim a closed patient is ordered in the queue like everybody else", () => {
    // ⚠️ D6: "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody
    // else" sat DIRECTLY ABOVE "it is not in the queue at all". Adjacent, and contradictory.
    renderWorkspace("WF-008");
    const flagPanel = screen.getByTestId("ward-patient-urgent-flag");
    expect(within(flagPanel).queryByText(/like everybody else/)).toBeNull();
    expect(within(flagPanel).getByText(/it is not in the queue at all/)).toBeInTheDocument();
    // One sentence, not two to reconcile.
    expect(flagPanel.querySelectorAll("p")).toHaveLength(1);

    cleanup();
    renderWorkspace("WF-001");
    expect(within(screen.getByTestId("ward-patient-urgent-flag")).getByText(/like everybody else/)).toBeInTheDocument();
  });
});

/**
 * ⚠️ THE JUDGEMENT, AND THE ONE NUMBER WARD LEAD SAID HE WOULD CHECK.
 *
 * On WF-004 the sentence "Escort provider organising secure transport" appeared FOUR times — in
 * the attention rail, in the blocker control, in Readiness as "what is holding it up", and in
 * Movement facts as "recorded by hand as holding this up". A coordinator scanning for what is
 * wrong met the same blocker four times and had to work out, each time, whether it was new.
 *
 * The rule the page now follows is that every fact has ONE home and a panel that would repeat it
 * points at that home instead. The blocker keeps two, and only two, deliberately: the rail says
 * what is wrong (that is what the rail is for), and the control shows the value because nobody
 * should clear a clinical note they cannot see. Everything else points.
 *
 * ⚠️ COUNTED OVER THE WHOLE RENDERED PAGE, not within a panel — a duplication that moves to a new
 * panel is not a fix, and only a whole-document count can see that.
 */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the judgement — one fact, one home", () => {
  it("fixture assumption: WF-004's blocker is the sentence the cold read counted four times", () => {
    expect(WF_004?.blocker).toBe("Escort provider organising secure transport");
  });

  it("prints the blocker sentence exactly twice on WF-004: the rail that says what is wrong, and the control that changes it", () => {
    renderWorkspace("WF-004");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "Escort provider organising secure transport")).toBe(2);
    expect(
      within(screen.getByTestId("ward-console-attention")).getByText(/Escort provider organising secure transport/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("ward-patient-blocker")).getByText("Escort provider organising secure transport"),
    ).toBeInTheDocument();
  });

  it("answers the transport question in one place, and the job question in another", () => {
    // Two duplications, one fixture. Readiness printed `transportReadinessLine` word for word, and
    // the Job row re-answered the "Is transport needed?" row directly above it. Three surfaces now
    // say three different things about transport, and the page asserts the unanswered need once.
    renderWorkspace("WF-004");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "nobody has recorded whether one is needed")).toBe(0);
    expect(occurrences(page, "Nobody has recorded an answer either way")).toBe(1);
    const transport = screen.getByTestId("ward-console-transport-panel");
    expect(within(transport).getByText("No job has been raised.")).toBeInTheDocument();
  });

  it("prints a closure reason twice on WF-008 — the banner that dominates the page, and the step it stopped on", () => {
    // The same rule applied to the closed arrangement: both controls used to repeat the reason in
    // a parenthesis, making four copies on one screen. The panel at the top of the page is the
    // loudest thing on it; the controls point at it instead of quoting it.
    renderWorkspace("WF-008");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "Patient self-discharged from ED before transport was arranged")).toBe(2);
  });

  it("prints the legal status twice — the masthead descriptor and the record — never three times", () => {
    renderWorkspace("WF-004");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "Involuntary inpatient")).toBe(2);
  });
});
