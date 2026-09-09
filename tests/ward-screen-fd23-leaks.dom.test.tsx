import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { namesRealPlace } from "./helpers/ward-place-names";

/**
 * `FD-23` ON THE ONE SURFACE MOST ABLE TO BREAK IT.
 *
 * A ward-facing screen may not reveal where else a patient has been referred. This page's inbox
 * reads `referredUnitIds` — a LIST of every ward addressed — so the field that answers "am I
 * addressed?" also carries "who else is?". Both leaks below were LIVE on the seeded fixture,
 * visible without dispatching anything, and confirmed on screen before they were fixed.
 *
 * ⚠️ NEITHER WAS CAUGHT BY ANYTHING, and the reason is the same in both cases: the forbidden thing
 * was a VALUE in a permitted place. No structural guard inspects the text inside a `<span>`, and no
 * field-presence check can see that a legal field carries an illegal string. So these assertions
 * read the rendered TEXT, which is the only level at which either defect exists.
 *
 * Both cases are pinned to seeded movements rather than constructed, deliberately: the point is
 * that the fixture a demonstration actually runs on contains them. A constructed case would prove
 * the render path and say nothing about what anybody would see.
 */
/**
 * Every place-name a ward-facing string is forbidden to contain, derived from the live registers in
 * `ward-sites.ts` and never hand-typed — a hand-list is correct on the day it is written and stops
 * covering the hospital somebody adds next month. Unit names, hospital names, hospital CODES and
 * emergency-department names all identify a destination equally well, so all four are forbidden.
 */
function forbiddenPlaceNames(): string[] {
  return [
    ...allUnits().map((unit) => unit.name),
    ...wardSites.map((site) => site.name),
    ...wardSites.map((site) => site.code),
    ...allEmergencyDepartments().map((ed) => ed.name),
  ];
}

function findSeeded(predicate: (movement: (typeof wardMovements)[number]) => boolean, label: string) {
  const found = wardMovements.filter(predicate);
  // A canary on the fixture itself. If the seed changes so that no movement has this shape, the
  // assertions below would pass by having nothing to check — a green test measuring an empty set.
  expect(found.length, `the seed no longer contains ${label}, so the guard below proves nothing`).toBeGreaterThan(0);
  return found[0];
}

describe("FD-23 on the ward page", () => {
  it("never names a co-addressed ward, and never reveals that one exists", () => {
    /*
     * ⚠️ THIS TEST PINS TWO THINGS OF DIFFERENT STATUS AND SAYS SO, because a future session will
     * otherwise read a red here as one regression when it may be a decision landing.
     *
     * SETTLED — the owner's ruling, verbatim in `ward-referral-visibility.ts`: "a ward cannot see
     * where else a patient has been referred." The identity assertion below is that rule. It must
     * never be relaxed, and no ruling on the open question can reach it.
     *
     * ⚠️ ALSO SETTLED, by the owner on 2026-08-31 — whether a ward may know that co-addressees
     * EXIST, without knowing who. It was open for about an hour and this block said so. HE RULED
     * NOT TOLD. The arguments are kept below rather than deleted, because the losing side was
     * strong and a reader who rediscovers it would otherwise think nobody had weighed it. The removed
     * "Parallel referral" badge said exactly that and named nowhere, so the owner's sentence does
     * not decide it. Two live readings point opposite ways: a badge invites a ward to wait out the
     * competition (so four wards could each deprioritise the same patient), while the owner's own
     * stated reason — "so a ward does not spend its time on a patient who is being placed elsewhere"
     * — argues for telling it. The cost of hiding it is real in the window before anyone accepts,
     * when no cancellation has fired and no ward knows it is one of three.
     *
     * ⚠️ AND THE COST WAS ACCEPTED, NOT RETIRED. Twice it was argued that `withdrawnReferrals`
     * already pays for hiding this. It does not: `ACCEPT_IN_PRINCIPLE` is its only writer, so
     * nothing reaches a ward until somebody accepts, and the deliberation window is unprotected by
     * construction. The owner was given that trade explicitly and chose this side. Both assertions
     * below are now his ruling, and neither is a placeholder.
     */
    /*
     * ⚠️ WHAT THIS TEST USED TO CHECK, AND WHY IT COULD NOT FAIL (found 2026-09-01).
     *
     * The identity limb forbade the co-addressed unit's `id` — the SLUG, `rgh-adult-secure`. No
     * disclosure would ever be written that way. A card rendering "Also referred to RGH Adult
     * Secure" broke the owner's ruling with this test green, because the ruling was pinned against
     * a string the product has no reason to print. The existence limb forbade the literal word
     * "parallel", so "Also referred elsewhere" passed too. Both were reproduced against this file
     * before it was rewritten: the leak was rendered on the card and the old assertions stayed
     * green.
     *
     * THE FORBIDDEN SET IS NOW DERIVED FROM `allUnits()` AND `wardSites` — the same registers the
     * app draws unit and hospital names from — rather than hand-listed here. A hand-list is the
     * same defect one edit later: it is correct on the day it is written and silently stops
     * covering the unit somebody adds next month. Derived, a new ward is guarded the day it exists.
     */
    const parallels = wardMovements.filter(
      (movement) => movement.stage === "destination_review" && movement.referredUnitIds.length > 1,
    );
    expect(
      parallels.length,
      "the seed no longer contains a movement in destination_review addressed to more than one ward, " +
        "so the guard below proves nothing",
    ).toBeGreaterThan(0);

    let cardsChecked = 0;

    for (const parallel of parallels) {
      // Every ward that was asked, not just the first: the ruling protects each of them, and the
      // leak could be rendered for one addressee and not another.
      for (const unitId of parallel.referredUnitIds) {
        const view = render(
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <WardScreen unitId={unitId} />
          </WardFlowProvider>,
        );

        const card = view.queryByTestId(`ward-incoming-${parallel.id}`);
        if (card === null) {
          // This ward is addressed but the movement is not on its inbox — nothing to read, and
          // nothing to prove. The `cardsChecked` assertion below is what stops every ward taking
          // this branch and the test measuring an empty set.
          view.unmount();
          continue;
        }
        cardsChecked += 1;
        const shown = card.textContent ?? "";

        // SETTLED — the owner's ruling. A ward may not see WHERE else a patient was referred, and
        // the identifying string a real disclosure would use is the unit's NAME, not its slug. Both
        // are forbidden, for every unit in the register except the one being looked at.
        for (const other of allUnits()) {
          if (other.id === unitId) continue;
          expect(
            shown,
            `the card for ${parallel.id} on ${unitId} names another unit — "${other.name}". A ward may ` +
              `not see where else a patient has been referred (FD-23, owner's ruling 2026-08-30).`,
          ).not.toContain(other.name);
          expect(
            shown,
            `the card for ${parallel.id} on ${unitId} carries another unit's id — "${other.id}" (FD-23).`,
          ).not.toContain(other.id);
        }

        // A hospital name identifies the destination just as well as a ward name does. Sites that
        // contain the viewing ward are excluded, because naming your own hospital reveals nothing.
        for (const site of wardSites) {
          if (site.units.some((candidate) => candidate.id === unitId)) continue;
          expect(
            shown,
            `the card for ${parallel.id} on ${unitId} names another hospital — "${site.name}" (FD-23).`,
          ).not.toContain(site.name);

          // ⚠️ WIDENED 2026-09-02 ON THE OWNER'S RULING. This loop forbade the hospital's NAME and
          // nothing else, so its CODE and its emergency department's name could both have named the
          // same destination unchallenged. A card reading "Also referred to ARM" or "Also referred
          // to Armadale Hospital Emergency Department" identifies where the patient went exactly as
          // well as the hospital name does — which is the thing FD-23 forbids.
          //
          // The site containing the viewing ward is already skipped above, which correctly exempts
          // that ward's OWN hospital, own code and own emergency department: naming your own site
          // reveals nothing.
          expect(
            namesRealPlace(shown, site.code),
            `the card for ${parallel.id} on ${unitId} carries another hospital's code — "${site.code}" (FD-23).`,
          ).toBe(false);

          // Optional by design: 17 sites, 8 emergency departments. A site without one contributes
          // nothing here rather than throwing on an absent field.
          const ed = site.emergencyDepartment;
          if (ed !== undefined) {
            expect(
              namesRealPlace(shown, ed.name),
              `the card for ${parallel.id} on ${unitId} names another emergency department — ` +
                `"${ed.name}" (FD-23).`,
            ).toBe(false);
          }
        }

        // RULED, not provisional — the owner ruled on 2026-08-31 that a ward is not told a patient
        // is also referred elsewhere, not even the bare fact with nowhere named.
        //
        // ⚠️ THIS LIMB IS A VOCABULARY GUARD AND CANNOT BE DERIVED, and that is stated rather than
        // hidden. The identity limb above has a register to read from; "a co-addressee exists" has
        // no data to derive a phrasing from, so the wordings a disclosure would plausibly use are
        // listed. It is broader than the single word "parallel" it replaces, and it is still a
        // list: a wording nobody thought of would pass it. Asserted on the CARD rather than the
        // document, because the question is what a charge nurse reads.
        expect(
          shown,
          `the card for ${parallel.id} on ${unitId} tells this ward that the patient is referred ` +
            `somewhere else as well. The owner ruled on 2026-08-31 that a ward is not told this, not ` +
            `even the bare fact. Card text: "${shown}"`,
        ).not.toMatch(
          /parallel|also referred|referred elsewhere|elsewhere|another ward|other wards?|another unit|other units?|another destination|other destinations?|co-referred|multiple (?:wards|units|destinations)/i,
        );

        view.unmount();
      }
    }

    expect(
      cardsChecked,
      "no co-addressed referral reached any ward's inbox, so every assertion above ran on nothing",
    ).toBeGreaterThan(0);
  });

  it("never names the unit that accepted, when telling a ward its referral was withdrawn", () => {
    /*
     * THE LEAK THAT SAT INSIDE THE SAFEGUARD. `withdrawnReferrals` exists so a ward is told its
     * referral ended rather than watching `referredUnitIds` go quiet — and the reducer writes
     * `reason: "withdrawn — placed at <name>"`, the seed writes "Referral withdrawn once RGH Adult
     * Secure confirmed the bed", and the page rendered it raw. FSH Adult Secure was told RGH won.
     *
     * ⚠️ THE MODEL HAS SINCE CLOSED THIS AT SOURCE, AND THIS TEST TOLD ME SO BY GOING RED.
     * `reason` is now a `WithdrawalReason` union, so the fixture holds `another_unit_accepted` and
     * no ward name exists in it to leak. The old assertion — that no unit name survives into the
     * rendered text — could no longer fail from any input the model can produce, and the vacuity
     * canary beside it said exactly that: "the fixture's reasons no longer name anything, so this
     * guard is vacuous."
     *
     * That is the canary working, not a regression. A guard that cannot fail is worse than no
     * guard because it reports safety it is not checking — so it is REPLACED, never deleted and
     * never relaxed to keep it green.
     *
     * WHAT IS STILL THIS PAGE'S TO GET WRONG, now that prose cannot arrive from the model:
     * rendering the raw union member instead of its label. `another_unit_accepted` on a clinical
     * screen is not a privacy failure, it is an incomprehensible one — and it is exactly what a
     * careless "simplify" back to `{entry.reason}` produces.
     */
    const withdrawnFrom = findSeeded(
      (movement) => movement.withdrawnReferrals.length > 0,
      "a movement with a withdrawn referral",
    );
    const entry = withdrawnFrom.withdrawnReferrals[0];

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={entry.unitId} />
      </WardFlowProvider>,
    );

    const card = screen.getByTestId(`ward-withdrawn-${withdrawnFrom.id}`);
    const shown = within(card).getByTestId(`ward-withdrawn-reason-${withdrawnFrom.id}`).textContent ?? "";

    // The raw union member must never reach the screen — the "simplify it back to `{entry.reason}`"
    // regression, and now the only way this line can go wrong from here.
    expect(shown, "the withdrawal code is being rendered instead of its label").not.toBe(entry.reason);
    expect(shown).not.toMatch(/_/);

    // It must be the SHARED label, not a second copy of the same sentence written here. Two copies
    // that agree today are the thing that drifts, and drift is how the leak came back last time.
    expect(shown).toBe(withdrawalReasonLabels[entry.reason]);

    // And no PLACE may be named, however the label is later worded. Ward Core guards the label
    // vocabulary at source; this asserts the same rule where a ward actually reads it, because that
    // is the only place the harm occurs.
    //
    // ⚠️ THIS LOOP READ ONLY `allUnits()` UNTIL 2026-09-02 — every unit name was forbidden, but a
    // hospital name, a hospital CODE, or an emergency-department name could have passed. All three
    // identify a destination exactly as well as a ward name does, which is the thing FD-23 forbids.
    //
    // ⚠️ **LATENT, NOT LIVE.** `WITHDRAWAL_REASONS` is a closed two-member union with two hardcoded
    // labels and no interpolation, so no code path today can produce a reason naming a place. This
    // is a tripwire for a FUTURE templated or free-text reason. Read a red result here as the
    // tripwire firing, not as evidence of a live leak.
    for (const place of forbiddenPlaceNames()) {
      expect(
        namesRealPlace(shown, place),
        `the withdrawal line names a real place — "${place}". A ward is never told where the patient ` +
          `went (FD-23, owner's ruling 2026-08-30).`,
      ).toBe(false);
    }

    // The ward is still told the thing it can act on, or the fix has traded a leak for silence.
    expect(shown).toMatch(/withdrawn/i);
    expect(shown).toMatch(/accepted/i);
  });

  /**
   * ⚠️ THE DETECTOR IS PROVED BEFORE IT IS TRUSTED, because the guard above asserts an ABSENCE and
   * an absence check that cannot fire is indistinguishable from one that passes. A broken regex, an
   * empty register, or an over-escaped name would all report "no place named" on every input.
   *
   * So: synthetic strings that DO name a place must be caught, real labels must stay silent, and
   * the register must not be empty. Each limb fails for a different reason, and together they are
   * the difference between a guard and a decoration.
   */
  it("proves the place-name detector can actually fail before the guard above is trusted", () => {
    const places = forbiddenPlaceNames();

    // A guard over an empty set is green and worthless — the failure mode this whole file exists
    // to catch, applied to its own machinery.
    expect(places.length, "the forbidden-place register is empty, so the guard above checks nothing").toBeGreaterThan(
      0,
    );
    expect(allUnits().length).toBeGreaterThan(0);
    expect(wardSites.length).toBeGreaterThan(0);
    expect(
      allEmergencyDepartments().length,
      "no emergency department is registered, so that limb is vacuous",
    ).toBeGreaterThan(0);

    // POSITIVE CONTROL — every category must be catchable when genuinely named in a sentence.
    const unitName = allUnits()[0].name;
    const siteName = wardSites[0].name;
    const siteCode = wardSites[0].code;
    const edName = allEmergencyDepartments()[0].name;
    expect(namesRealPlace(`Withdrawn — accepted by ${unitName}.`, unitName)).toBe(true);
    expect(namesRealPlace(`Withdrawn — accepted at ${siteName}.`, siteName)).toBe(true);
    expect(namesRealPlace(`Withdrawn — site ${siteCode} took it.`, siteCode)).toBe(true);
    expect(namesRealPlace(`Withdrawn — went to ${edName}.`, edName)).toBe(true);

    // NEGATIVE CONTROL — the real labels the product actually renders must stay silent against the
    // whole register, or the guard above would be red for a reason that has nothing to do with FD-23.
    for (const label of Object.values(withdrawalReasonLabels)) {
      for (const place of places) {
        expect(namesRealPlace(label, place), `the shipped label "${label}" trips on "${place}"`).toBe(false);
      }
    }

    // AND the word-boundary rule itself, which is the reason a bare code is not matched by
    // `.includes()`: a short code buried inside an ordinary English word is not a place being named.
    const shortCode = places.find((place) => !place.includes(" ") && place.length <= 4);
    expect(shortCode, "no single-token code is registered, so the boundary rule is untested").toBeDefined();
    if (shortCode !== undefined) {
      expect(namesRealPlace(`the ward was ${shortCode.toLowerCase()}ing quietly`, shortCode)).toBe(false);
      // …and the same code, genuinely named, must still be caught.
      expect(namesRealPlace(`transferred to ${shortCode} today`, shortCode)).toBe(true);
    }

    // ⚠️ REGRESSION, AND IT IS THE REASON THIS TEST EARNED ITS PLACE. A DOM `textContent`
    // concatenates sibling elements with NO separator, so a real card reads
    // `…Emergency DepartmentWF-013…`. The character after "Department" is `W` — both sides are word
    // characters, so NO word boundary exists there. An earlier version of `namesRealPlace` used
    // `\b…\b` for every name and therefore returned false while the emergency department's name was
    // rendered on the screen. The guard could not fire, and only a mutation revealed it.
    const multiWord = places.find((place) => place.includes(" "));
    expect(multiWord, "no multi-word place is registered, so the concatenation rule is untested").toBeDefined();
    if (multiWord !== undefined) {
      expect(
        namesRealPlace(`${multiWord}WF-013Older adult · Open`, multiWord),
        "a multi-word place name butted against the next element's text is still a leak",
      ).toBe(true);
    }

    // The floor is enforced rather than assumed: a 2-character entry arriving later must throw here
    // instead of quietly matching half the alphabet.
    expect(() => namesRealPlace("anything", "AB")).toThrow(/3-character floor/);
  });
});
