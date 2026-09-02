import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { URGENCY_LEVELS } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 6 (spec item 11). WF-308 is the real fixture's own second "nowhere eligible" movement at
 * NOW_ANCHOR (WF-009 is the first, and WF-009 already carries a recorded escalation — see
 * tests/ward-escalation.test.ts and tests/ward-escalation.dom.test.tsx), so it renders the
 * escalation form's "Record escalation" path rather than "Update escalation".
 */
const TARGET_MOVEMENT_ID = "WF-308";

/**
 * Mirrors `ClockAdvancer` in ward-escalation.dom.test.tsx and `ReferFirstMovement` in
 * ward-flow-queue-selection.dom.test.tsx: a thin sibling that reads the real provider state and
 * hands it to the component under test, so the suite exercises the real reducer and the real
 * fixture rather than a hand-built movement that could silently drift from what the reducer can
 * actually produce.
 */
function ShortlistHarness() {
  const { movements, units, bedReleases, referrals, now, dispatch } = useWardFlow();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const movement = movements.find((candidate) => candidate.id === TARGET_MOVEMENT_ID);
  return (
    <ShortlistPanel
      movement={movement}
      now={now}
      units={units}
      bedReleases={bedReleases}
      referrals={referrals}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
      dispatch={dispatch}
    />
  );
}

function renderShortlist() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ShortlistHarness />
    </WardFlowProvider>,
  );
}

/** Scopes a query to the escalation `<section>` alone, never the whole document — the override
 *  form a few sections down also carries a `<textarea>`, and this suite must never mistake that
 *  unrelated control for evidence about the escalation form specifically. */
function escalationSection(container: HTMLElement): HTMLElement {
  const section = container.querySelector('section[aria-label="Escalation"]');
  if (!(section instanceof HTMLElement)) {
    throw new Error("Escalation section not found");
  }
  return section;
}

describe("ShortlistPanel escalation contact", () => {
  it("opens a fixed picker whose options are exactly ESCALATION_CONTACTS, in order", () => {
    const { container } = renderShortlist();

    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByTestId("ward-shortlist-escalation-contact");
    expect(select.tagName).toBe("SELECT");
    expect(select).toBeInstanceOf(HTMLSelectElement);

    const optionValues = Array.from((select as HTMLSelectElement).options).map((option) => option.value);
    expect(optionValues).toEqual([...ESCALATION_CONTACTS]);
    const optionText = Array.from((select as HTMLSelectElement).options).map((option) => option.textContent);
    expect(optionText).toEqual([...ESCALATION_CONTACTS]);

    // The decisive proof this task exists for: no textarea and no free-text input anywhere in
    // the escalation form, scoped so the unrelated override-reason textarea elsewhere on this
    // same panel can never satisfy this assertion by accident.
    const section = escalationSection(container);
    expect(section.querySelectorAll("textarea")).toHaveLength(0);
    expect(section.querySelectorAll('input:not([type="hidden"])')).toHaveLength(0);
  });

  it("keeps the label wording and the existing test-id on the picker", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByLabelText(
      "Role or service being contacted next — a role or service only, never a person's name (synthetic data only)",
    );
    expect(select).toHaveAttribute("id", "ward-shortlist-escalation-contact");
    expect(select.getAttribute("data-testid")).toBe("ward-shortlist-escalation-contact");
  });

  it("dispatches RECORD_ESCALATION with one of the listed contacts, chosen from the picker", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByTestId("ward-shortlist-escalation-contact") as HTMLSelectElement;
    const chosen = "Duty psychiatrist";
    expect(ESCALATION_CONTACTS).toContain(chosen);
    fireEvent.change(select, { target: { value: chosen } });
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-submit"));

    // Read the real post-dispatch fact back from the movement, the same discipline every other
    // "did this really happen" assertion in this panel already holds to (`overrideSucceeded`,
    // the referral badges) — never a captured local flag.
    const record = screen.getByTestId("ward-shortlist-escalation-record");
    expect(record.textContent).toContain(`contact: "${chosen}"`);
    // The submit button re-opens as "Update escalation" once a record exists — proof the
    // dispatch actually reached the reducer and stuck, not merely that the form closed.
    expect(screen.getByTestId("ward-shortlist-escalation-toggle").textContent).toBe("Update escalation");
  });

  it("defaults the picker to the first ESCALATION_CONTACTS entry and never submits an empty value", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByTestId("ward-shortlist-escalation-contact") as HTMLSelectElement;
    expect(select.value).toBe(ESCALATION_CONTACTS[0]);

    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-submit"));
    const record = screen.getByTestId("ward-shortlist-escalation-record");
    expect(record.textContent).toContain(`contact: "${ESCALATION_CONTACTS[0]}"`);
  });
});

/**
 * Wave 1 referral corrections — the coordinator half of the same defect fixed in
 * `ward-ed-screen.dom.test.tsx`. This picker rendered a bare "1", "2", "3" with nothing saying
 * which end of the scale is urgent, on the one control that re-ranks a patient inside a queue
 * urgency now dominates.
 *
 * Read against `urgencyTierLabel` itself, never three remembered strings, so this is a guard on
 * "one spelling everywhere" rather than on the wording this test happens to hold.
 */
describe("ShortlistPanel urgency picker", () => {
  it("labels every urgency option with its direction, keeping the bare tier as the value", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-change-urgency-toggle"));

    const picker = screen.getByLabelText(`Urgency tier for ${TARGET_MOVEMENT_ID}`) as HTMLSelectElement;

    const optionText = [...picker.options].map((option) => option.textContent);
    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    // The VALUE stays the bare tier: the reducer and every value-reading test are unchanged.
    const optionValues = [...picker.options].map((option) => option.value);
    expect(optionValues).toEqual(URGENCY_LEVELS.map((level) => String(level)));

    // Non-vacuity: the labels really do carry a direction, so a `urgencyTierLabel` that returned
    // the bare tier again would fail here even though the first assertion still matched.
    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });
});

/**
 * ⚠️ THE OVERRIDE FORM MUST STATE WHY THE BED FAILED — WRITTEN AFTER LOOKING AT THE SCREEN,
 * NOT BEFORE.
 *
 * The owner ruled "keep advising and let the clinician decide". Until 2026-09-02 the reason
 * reached a sighted mouse user only as a `title` tooltip on a button they cannot click, plus an
 * `sr-only` span — invisible on a touch screen, invisible by keyboard, invisible after scrolling.
 * So at the one irreversible moment, for a large class of users, the advice was not legible at all.
 *
 * ⚠️ THIS TEST DELIBERATELY ASSERTS ON RENDERED TEXT, AND THAT IS THE WHOLE POINT. A test asserting
 * the reason string is merely "present" passes on a `title` attribute nobody on a touchscreen can
 * reach — so it would certify the exact defect it was written to prevent. Ward Verifier made that
 * argument, and it is why both cases below were opened in a real browser at `http://localhost:4215`
 * BEFORE this file was written. What was seen:
 *   - `WF-009` (referable stage, candidate already declined) -> "RPH Adult Secure — Not eligible:
 *     Already declined this movement"
 *   - `WF-011` (bed pulled, every candidate eligible) -> "WF-011 cannot be referred while it is bed
 *     pulled — referral is only available while placement is requested or a destination is under
 *     review."
 *
 * ⚠️ AND TWO CASES, BECAUSE ONE OF THEM WAS MISSED THE FIRST TIME. Refer has two independent
 * blockers — an ineligible ward, and a non-referable stage — and `canOverride` carries neither
 * guard, so both reach this form. The first version of the fix keyed on the ineligible ward alone,
 * and a coordinator overriding a stage block read nothing at all.
 */
describe("the override form says what the bed failed on, in text a coordinator can read", () => {
  // Both discovered from the seed rather than assumed: `WF-009` is at `destination_review` with
  // three candidates that have already declined it; `WF-011` is at `pulled` with three eligible
  // candidates. Picking a movement that happened to have neither would make every assertion below
  // vacuous, which is what the non-vacuity checks guard against.
  const INELIGIBLE_CANDIDATE_MOVEMENT = "WF-009";
  const NON_REFERABLE_STAGE_MOVEMENT = "WF-011";

  function OverrideHarness({ movementId }: { movementId: string }) {
    const { movements, units, bedReleases, referrals, now, dispatch } = useWardFlow();
    const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
    return (
      <ShortlistPanel
        movement={movements.find((candidate) => candidate.id === movementId)}
        now={now}
        units={units}
        bedReleases={bedReleases}
        referrals={referrals}
        selectedUnitId={selectedUnitId}
        onSelectUnit={setSelectedUnitId}
        dispatch={dispatch}
      />
    );
  }

  /**
   * Selects the first candidate, opens Override, and hands back the form's reason block.
   *
   * ⚠️ `expectEligible` IS THE NON-VACUITY GUARD AND IT REPLACES A WEAKER ONE I WROTE FIRST.
   *
   * The original checked only that SOME candidate existed, then clicked the first one. But each
   * test below depends on the clicked candidate's own verdict: the ineligible test needs the first
   * candidate to be INELIGIBLE, and if it happened to be eligible then `firstIneligibleSelected`
   * is `undefined`, the sentence CORRECTLY does not render, and the test would pass having
   * asserted nothing at all. The stage test needs the opposite — every candidate eligible — or it
   * cannot tell the stage reason from the ineligibility one.
   *
   * ⚠️ So the guard is now on the property the test rests on, not on the list being non-empty.
   * I found the weakness myself and distrusted it; Ward Verifier confirmed it and said fix it
   * first, which was right.
   */
  function openOverrideFor(movementId: string, expectEligible: boolean): HTMLElement {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OverrideHarness movementId={movementId} />
      </WardFlowProvider>,
    );
    const candidates = screen.getAllByTestId(/^ward-shortlist-candidate-/);
    expect(candidates.length, `${movementId} offers no candidate, so nothing below is exercised`).toBeGreaterThan(0);

    // The candidate card says "Eligible now" for a passing ward, which is the same string a
    // coordinator reads — so this guard checks what the screen states, not a verdict recomputed
    // here that could agree with the code while both are wrong.
    // ⚠️ SECOND WEAKNESS IN THE SAME GUARD, and the first one is documented above. "Not eligible
    // now" STOPPED MEANING "needs an override" the moment the previously-declined bucket arrived.
    // Such a ward reads as not-eligible on its card and is nonetheless referable with NOTHING
    // recorded, so it has no gate to name and the reason block correctly does not render for it.
    // WF-009's first candidate is now exactly such a ward, which turned this test red — for the
    // right reason, on a real behaviour change, rather than because anything here was broken.
    //
    // ⚠️ The guard now selects on the property the test RESTS on — a ward a recorded reason could
    // actually place — instead of on the absence of one string.
    const eligibleNow = (row: HTMLElement) => /Eligible now/.test(row.textContent ?? "");
    const onlyDeclined = (row: HTMLElement) => /Already declined this movement/.test(row.textContent ?? "");
    const chosen = expectEligible ? candidates[0] : candidates.find((row) => !eligibleNow(row) && !onlyDeclined(row));
    expect(
      chosen,
      `${movementId} offers no candidate that a recorded reason could place — every row is either ` +
        `eligible outright or only previously declined — so the block below would hold over nothing`,
    ).toBeDefined();
    expect(
      eligibleNow(chosen as HTMLElement),
      `${movementId}'s chosen candidate is ${expectEligible ? "not eligible" : "eligible"}, which is ` +
        `the opposite of what this test needs — so the assertion below would hold for the wrong ` +
        `reason, or hold over nothing at all`,
    ).toBe(expectEligible);

    fireEvent.click(chosen as HTMLElement);
    fireEvent.click(screen.getByTestId("ward-shortlist-override-toggle"));
    return screen.getByTestId("ward-shortlist-override-reasons");
  }

  it("names the ward and the gate it failed, as text rather than as a tooltip", () => {
    const block = openOverrideFor(INELIGIBLE_CANDIDATE_MOVEMENT, false);
    const line = screen.getByTestId("ward-shortlist-override-failing-gate");

    expect(
      line.textContent,
      "the failing gate is not named at the moment of the override, so the coordinator commits an " +
        "irreversible act without being told what the bed failed on",
    ).toContain("Not eligible");

    // ⚠️ THE DISCRIMINATOR: a `title` would satisfy "the reason is present" and reach nobody on a
    // touch screen. Rendered text is the requirement, so the absence of the attribute is asserted
    // rather than assumed.
    expect(
      line.getAttribute("title"),
      "the reason has gone back to being a tooltip, which is invisible on touch, invisible by " +
        "keyboard, and the exact defect this block replaced",
    ).toBeNull();
    expect(block.textContent?.trim().length, "the block renders but says nothing").toBeGreaterThan(0);
  });

  it("states a non-referable stage too, which the first version of this block did not", () => {
    const block = openOverrideFor(NON_REFERABLE_STAGE_MOVEMENT, true);
    const line = screen.getByTestId("ward-shortlist-override-stage-block");

    expect(
      line.textContent,
      "a coordinator overriding a stage block — a documented, intended path — opens the form and " +
        "is told nothing, which is the same silence at the same moment from the other cause",
    ).toContain("cannot be referred");
    expect(
      line.getAttribute("title"),
      "the stage reason has become a tooltip, invisible to exactly the users this was built for",
    ).toBeNull();
    expect(block.textContent).toContain(NON_REFERABLE_STAGE_MOVEMENT);
  });
});
