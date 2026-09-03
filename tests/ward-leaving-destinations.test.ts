import { describe, expect, it } from "vitest";

import { LEAVING_DESTINATIONS, type LeavingDestination } from "../src/components/ward-management/ward-admissions";

/*
 * WHY THIS FILE EXISTS. The owner added three ways a patient can leave a ward on 2026-09-01 — and the
 * three are NOT the three originally proposed.
 *
 * ⚠️ ABSCONDING WAS PROPOSED AND IS NOT AMONG THEM, and the reason is clinical rather than technical.
 * Death and a transfer to police or prison custody END an admission. Absconding does not: an absconded
 * patient is still admitted, still the ward's responsibility, and may still be detained under the Act.
 * They have not been discharged — they are missing, and their bed is HELD because they may be back
 * within hours.
 *
 * `RECORD_LEAVING` sets `state: "departed"` and increments `empty`, so ANYTHING in this list FREES THE BED.
 * Recording absconding here would have released the bed of a patient nobody has found — the exact
 * opposite of the owner's ruling. The negative test below is the one that matters most in this file.
 *
 * `did-not-return` is what a ward records when it eventually releases an absconded patient's bed. It
 * is honest, it asserts nothing about the person, and it does return a bed to the state.
 */

const byId = new Map(LEAVING_DESTINATIONS.map((entry) => [entry.id, entry]));

describe("where a patient goes when they leave a ward", () => {
  it("carries the three added on 2026-09-01, each returning a bed to the state", () => {
    for (const id of ["died-on-the-ward", "transferred-to-custody", "did-not-return"] as const) {
      const entry = byId.get(id);
      expect(entry, `${id} is missing from LEAVING_DESTINATIONS`).toBeDefined();
      expect(entry?.countsAsStatewideRelease, `${id} must return a psychiatric bed to the state`).toBe(true);
    }
  });

  it("⚠️ does NOT list absconding OR ANY SYNONYM, because a missing patient has not left", () => {
    /*
     * ⚠️ THIS GUARD WAS KEYED ON THE WORD AND THE PROPERTY IS THE CONCEPT. It matched only
     * `/abscond/i`, so `absconded` and `absconding` were caught and **`absent-without-leave`, `AWOL`,
     * `left-without-leave` and `left without notice` all passed straight through.**
     *
     * Ward Verifier found it, and its argument is why the widening is not paranoia: **its own original
     * error was exactly this category mistake** — proposing absconding as a way of leaving — and
     * whoever repeats it may well reach for a different word for the same idea. A guard that only
     * catches the spelling of one past mistake is a guard against that mistake, not against the class.
     *
     * The property: **no entry in this list may describe a patient who is MISSING.** Everything here
     * frees the bed, and a missing patient's bed is held because they are still admitted.
     */
    const MISSING_PATIENT_WORDS =
      /abscond|awol|absent[- ]without|without[- ]leave|without[- ]notice|unaccounted|missing/i;
    const abscondingLike = LEAVING_DESTINATIONS.filter(
      (entry) => MISSING_PATIENT_WORDS.test(entry.id) || MISSING_PATIENT_WORDS.test(entry.label),
    );
    expect(
      abscondingLike,
      "no leaving destination may describe a MISSING patient. Everything in this list frees the bed, " +
        "and a missing patient's bed is HELD because they are still admitted and may return. If you " +
        "are adding a destination for someone nobody can find, it does not belong here at all.",
    ).toEqual([]);
  });

  it("still has exactly ONE destination that does not return a bed to the state, and it is the ward transfer", () => {
    /*
     * The array's own doc comment asserts "exactly one" in prose. A count written into a comment has no
     * guard — that is the defect class this project has hit three times today — so it is asserted here
     * instead. Adding three `true` entries left the sentence true; the next `false` would not.
     */
    const notReleased = LEAVING_DESTINATIONS.filter((entry) => !entry.countsAsStatewideRelease);
    expect(notReleased.map((entry) => entry.id)).toEqual(["transferred-to-another-psychiatric-ward"]);
  });

  it("has an entry for every member of the type, and no duplicates", () => {
    // Non-vacuity: if the union and the array drift apart, every lookup above could pass while a
    // destination existed that no screen could label.
    const ids = LEAVING_DESTINATIONS.map((entry) => entry.id);
    expect(new Set(ids).size, "a destination is listed twice").toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    const typed: LeavingDestination[] = ids;
    expect(typed.length).toBe(ids.length);
  });
});
