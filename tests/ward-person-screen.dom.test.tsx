import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PatientId } from "../src/components/ward-management/ward-patients";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
// `patientAgeYears` is deliberately NOT imported — see the age assertion below. Importing it here
// is what made this test a mirror of the function it was supposed to check.
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import { allEmergencyDepartments, wardSites } from "@/components/ward-management/ward-sites";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { namesRealPlace } from "./helpers/ward-place-names";

/**
 * A PERSON'S OWN SCREEN — the subject is the PERSON, not a request for a bed.
 *
 * The owner's flow is *search for a patient, and if nobody comes up, add them, then refer from
 * their own screen.* Until now the last step had nowhere to happen: `patients/[patientId]` (since
 * moved to `movements/[movementId]`) looked a `Movement` up by id and rendered a movement
 * workspace, so the route named after people was about requests, and clicking a person in search
 * results did nothing at all because there was nowhere for the tile to point.
 *
 * ⚠️ **`FD-23` BINDS THIS SCREEN, AND THE LEDGER SAYS IT NEEDS A GUARD RATHER THAN A NOTE — FOR A
 * REASON THAT APPLIES TO THIS FILE SPECIFICALLY.** A ward may not see where else a patient has been
 * referred; the coordinator may. The owner's reason: so a ward does not take its time over a patient
 * who has been referred elsewhere.
 *
 * The ledger's warning is the part that matters here: *every instinct in a patient-centred design
 * says a patient screen shows everything known about that patient, so the omission looks like an
 * incomplete implementation rather than a decision, and a later reader will add it helpfully.* This
 * screen is the exact surface that instinct will act on. So the guard below asserts the ABSENCE —
 * `R9` shape — and says why, so the next person to feel that instinct meets the reason before they
 * act on it.
 *
 * ⚠️ **AND TODAY THE ABSENCE IS ALSO STRUCTURAL, WHICH IS WHY THE GUARD IS WRITTEN AS IT IS.**
 * `Referral` carries no patient link — `patientId` is named in `ALLOWED_REFERRAL_FIELDS`' own
 * comment as a field the guard exists to catch — so this screen COULD NOT show a person's referrals
 * even if it wanted to. A guard that only checked "no referrals are shown" would therefore pass
 * today for a reason that has nothing to do with `FD-23`, and would go on passing the day somebody
 * adds the link. It is written to fail on the CAPABILITY, not on today's emptiness.
 */
describe("a person's own screen", () => {
  const someone = seedWardFlowState().patients[0];

  // Typed `PatientId` rather than `string`: the default already IS one, and a test that could pass
  // a movement id here would be testing the thing the type now forbids.
  function renderPerson(id: PatientId = someone.id) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId={id} />
      </WardFlowProvider>,
    );
  }

  it("has a seeded person to render, or every assertion below is vacuous", () => {
    expect(someone, "the seed must carry at least one patient").toBeDefined();
    expect(someone.umrn.length).toBeGreaterThan(0);
    expect(someone.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows the person: name, record number, date of birth and age", () => {
    renderPerson();
    const identity = screen.getByTestId("ward-person-identity");
    expect(identity).toHaveTextContent(patientDisplayName(someone));
    expect(identity).toHaveTextContent(someone.umrn);
    expect(identity).toHaveTextContent(someone.dateOfBirth);
    /*
     * Age is DERIVED and never stored — `patientAgeYears` reads the date of birth. Asserted through
     * the same function the screen uses, so a screen that stored or recomputed its own age would
     * still have to agree with the one place this project derives it.
     *
     * 🔴 **THAT COMMENT WAS TRUE OF THE INTENT AND FALSE OF THE CODE UNTIL 2026-09-04, AND NOTHING
     * MADE THEM AGREE.** The computed `age` was used only as `typeof age === "number"` and then
     * discarded; the render was checked against any digits followed by "years". The reference date
     * passed in was 1 January of the BIRTH year, so even had the two been compared it would have
     * compared against roughly zero.
     *
     * Mutation-proved before and after: `ward-patients.ts` `return age` -> `return 999` turned the
     * model test red ("expected 999 to be 36") and left THIS test green while the screen rendered
     * "999 years". The control firing is what proves the mutant executed.
     *
     * ⚠️ It is fixed FIRST, ahead of the `dayZero` hazard it was found next to, and the order is
     * deliberate: `dayZero` reads the system clock unconditionally, and nothing today asserts a
     * calendar date derived from it. **Until this guard can fail, a future `dayZero` repair would
     * have had nothing to prove it worked.**
     *
     * `new Date()` is correct here and is not a flake: the screen's own `dayZero` reads the real
     * system clock too, so both sides move together. If a pinned date is ever introduced, this
     * assertion is the one that will go red and say so.
     */
    /*
     * 🔴 **COMPUTED HERE, NOT BY `patientAgeYears`, AND THE FIRST FIX GOT THIS WRONG.** Asserting
     * the render against the very function the screen calls is a MIRROR: mutating
     * `ward-patients.ts` to `return 999` moved BOTH sides, the screen rendered "999 years", and
     * this test stayed green — the same green the broken version gave. A test that recomputes
     * through the subject agrees with it forever, including when it is wrong.
     *
     * So the expected value is derived independently from the stored date of birth. The two
     * calculations now have to agree, which is what the comment above always claimed.
     */
    const born = new Date(someone.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - born.getFullYear();
    const monthsApart = today.getMonth() - born.getMonth();
    if (monthsApart < 0 || (monthsApart === 0 && today.getDate() < born.getDate())) age -= 1;
    expect(age).toBeGreaterThan(0);
    /*
     * ⚠️ THE UPPER BOUND IS THE ONE THING AN INDEPENDENT COMPUTATION CANNOT CATCH, and it is Ward
     * Builder Two's contribution after it conceded this file to master's version.
     *
     * Everything else here rests on computing the age twice, by two routes, and requiring the
     * answers to agree. That catches a wrong FUNCTION. It cannot catch a wrong FIXTURE: a date of
     * birth of 1200-03-14 gives an age of 826, both sides compute 826, they agree, and the screen
     * renders a number no human has ever had. Agreement is not plausibility.
     */
    expect(age, "a fixture date of birth is producing an implausible age; both sides would agree on it").toBeLessThan(
      130,
    );
    /*
     * ⚠️ `\b` FAILS AT BOTH ENDS HERE, AND IT COST TWO ATTEMPTS. Every figure and its unit are
     * separate elements, so `textContent` concatenates with no separator at all — the panel reads
     * "…Date of birth1988-03-14Age38yearsAge is calculated from…". There is no word boundary
     * between "Age" and "38", and none between "years" and the "Age" of the next sentence.
     *
     * The lookbehind does the job `\b` was there for — stopping a rendered "138" from satisfying an
     * expected "38". Nothing is needed at the tail: the number must sit immediately against the
     * word "year", which is the property being asserted.
     */
    expect(identity).toHaveTextContent(new RegExp(`(?<!\\d)${age}\\s*year`, "i"));
  });

  it("⚠️ NEVER SHOWS WHERE ELSE THIS PERSON HAS BEEN REFERRED — FD-23, asserted as an absence", () => {
    renderPerson();
    const screenRoot = screen.getByTestId("ward-person-screen");

    // Ward names, unit names and destination words are what a "where else" section would render.
    // Checked against the LIVE registers rather than a hand-written sample, so a place added later
    // is covered without anybody remembering to extend this.
    //
    // ⚠️ WIDENED 2026-09-02. This loop read `units` ONLY, so a hospital name, a hospital CODE or an
    // emergency-department name could have appeared on a person's screen unchallenged. All three
    // identify a destination exactly as well as a ward name does, which is the thing FD-23 forbids.
    // Two sibling files had the identical gap and were widened the same day.
    //
    // ⚠️ **LATENT, NOT LIVE.** `PersonScreen` renders no referral-derived data at all today —
    // `Referral` carries no patient link, so this screen COULD not show one. This is the tripwire
    // that catches the next leak once somebody wires that up, not evidence of a current one.
    const shown = screenRoot.textContent ?? "";
    const forbiddenPlaces = [
      ...seedWardFlowState().units.map((unit) => unit.name),
      ...wardSites.map((site) => site.name),
      ...wardSites.map((site) => site.code),
      ...allEmergencyDepartments().map((ed) => ed.name),
    ];

    // A guard over an empty register is green and worthless.
    expect(
      forbiddenPlaces.length,
      "the forbidden-place register is empty, so this guard checks nothing",
    ).toBeGreaterThan(0);

    for (const place of forbiddenPlaces) {
      expect(
        namesRealPlace(shown, place),
        `"${place}" appears on a person's screen. FD-23: a ward may not see where else a patient ` +
          "has been referred, so that a ward does not take its time over somebody already placed " +
          "elsewhere. If this is a coordinator-only surface now, that is a decision with the " +
          "owner's name on it — not something to unlock by deleting this assertion.",
      ).toBe(false);
    }
  });

  it("⚠️ AND THE SCREEN CANNOT REACH REFERRALS AT ALL — the guard that survives the link landing", async () => {
    // The capability check, and it reads the CODE rather than the prose: the assertion above passes
    // today for a structural reason (`Referral` has no patient link), so on its own it would keep
    // passing on the day somebody adds one and wires this screen up.
    //
    // Checking the `useWardFlow()` destructure is the precise form. A blunt search for the word
    // "referrals" would fail on this file's own doc comment explaining FD-23, which would teach the
    // next person to delete the guard rather than read it.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/ward-management/patients/person-screen.tsx", "utf8");
    const destructure = source.match(/const\s*\{([^}]*)\}\s*=\s*useWardFlow\(\)/);
    expect(destructure, "the screen must read state through useWardFlow, or this guard sees nothing").not.toBeNull();

    const taken = (destructure?.[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    expect(taken.length, "an empty destructure would make the subset check below vacuous").toBeGreaterThan(0);
    for (const name of taken) {
      expect(
        ["patients", "dayZero", "now"],
        `the person screen takes "${name}" from ward state. FD-23 is a decision, not an unfinished ` +
          "feature: showing a person's referrals, movements or destinations here is the exact " +
          "'helpful' addition the ledger warns a later reader will make. Take it to the owner " +
          "before widening this list.",
      ).toContain(name);
    }
  });

  it("⚠️ AND THIS FILE NEVER REACHES FOR THE AGE HELPER AGAIN — the guard that stops the mirror returning", async () => {
    /*
     * 🔴 WHAT THIS PROTECTS, AND WHY A COMMENT WAS NOT ENOUGH.
     *
     * The age assertion above computes the age here, from the stored date of birth, deliberately
     * NOT by calling the same helper the screen calls. An earlier version imported that helper, and
     * a test that asks the screen and the helper to agree cannot notice when they are wrong
     * together — Ward Builder Two mutated the helper to `return age + 3`, a plausible wrong age well
     * inside any human range, and its version of this test PASSED while the sibling model test
     * caught it. The mutant demonstrably ran; the screen guard simply could not see it.
     *
     * That decision was pinned only by a comment at the top of this file. **A comment is exactly
     * what somebody simplifying "the duplicated arithmetic" deletes on the way to reintroducing the
     * mirror, with every test green — which is the state this file was already in once.** So the
     * decision is asserted now, not explained.
     *
     * ⚠️ THE NAME IS ASSEMBLED FROM TWO HALVES ON PURPOSE. A guard searching for a literal would
     * match its own source and fail on itself, and the next person would delete the guard rather
     * than read it — the trap the FD-23 guard above records against a blunt search for "referrals".
     * Comments are stripped for the same reason: this file's own doc comment names the helper while
     * explaining why it is not imported, and that prose must stay legal.
     */
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("tests/ward-person-screen.dom.test.tsx", "utf8");

    /*
     * 🔴 THE PRECONDITION, AND WARD VERIFIER FOUND TWO SILENT BYPASSES BEFORE IT EXISTED.
     *
     * Comment-stripping by regex is only sound while no string literal in this file contains a
     * comment sequence. Verifier measured what happens when one does:
     *
     *   a BLOCK-comment opener inside a string -> opens a phantom comment that runs to the next
     *                            real close, deleting 1,157 characters of REAL code including a
     *                            genuine helper call. Both anti-vacuity assertions below still
     *                            passed: the length stayed well over 2,000, and the upper-bound
     *                            marker survived because the phantom opened after it.
     *   a LINE-comment opener inside a string  -> deletes the rest of that line. Moves the
     *                            stripped length by 22 characters, which NO length assertion
     *                            can see.
     *
     * ⚠️ THE SEQUENCES ARE DESCRIBED IN WORDS HERE AND NOT QUOTED, AND THAT IS THE POINT RATHER
     * THAN AN INCONVENIENCE. The first version of this comment quoted them inside backticks, and
     * the assertion below — which scans raw file text, comments included — flagged its own
     * explanation. **The temptation at that moment is to soften the guard so it can be
     * documented. Do not.** A blunt check that occasionally flags prose is a false positive the
     * author controls; a cleverer one has more room to be wrong about code. Reword the prose.
     *
     * ⚠️ And my own hypothesis — a string containing a CLOSING sequence — was wrong, tested in
     * both directions: it can only close a comment early, which leaks prose IN. That is the
     * false-alarm direction and it is harmless. **The hiding direction is the OPENING sequence.**
     *
     * A correct stripper needs a tokenizer, which is too much to own here. So the assumption is
     * asserted instead, and fails loudly the day it stops holding. Escaped pairs are removed
     * first, because this file's own guard regex writes the sequences backslash-escaped — they
     * are not adjacent characters there, which is why the control is green for a real reason
     * rather than a lucky one.
     */
    const deEscaped = source.replace(/\\./g, "");
    const risky = deEscaped
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /(["'`])[^"'`\n]*(\/\*|\/\/)/.test(line))
      .map(({ number }) => number);
    expect(
      risky,
      "a string literal in this file now contains a comment-opening sequence, so the " +
        "comment stripping below is no longer sound and can silently delete real code. " +
        "Escape the sequence, or move the value out of a literal.",
    ).toEqual([]);

    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Anti-vacuity: if comment-stripping ate the file, every check below passes over nothing.
    expect(code.length, "comment stripping removed almost the whole file").toBeGreaterThan(2000);
    expect(code, "the stripped code no longer contains the age assertion this guard protects").toContain(
      "toBeLessThan(",
    );

    const helper = "patientAge" + "Years";
    expect(
      code.includes(helper),
      `${helper} is referenced in this file's CODE. The age here is computed locally on purpose: ` +
        "asking the screen and the helper to agree cannot catch them being wrong together. " +
        "If you are consolidating the duplicated arithmetic, that is the defect, not the tidy-up.",
    ).toBe(false);
  });

  it("offers a way to refer this person, which is the whole point of the screen", () => {
    renderPerson();
    const refer = screen.getByTestId("ward-person-refer");
    expect(refer).toBeInTheDocument();
    expect(refer).toHaveTextContent(/refer/i);
    // Owner ruling 9, 2026-09-03: the control's wording is "Refer Patient". Asserted exactly,
    // because the `/refer/i` above passes against any sentence containing the word.
    expect(refer).toHaveTextContent(/^Refer Patient$/);
  });

  /**
   * ⚠️ THE LINK'S QUERY KEY, WHICH NOTHING TESTED UNTIL NOW — owner ruling 9, 2026-09-03.
   *
   * Found by attacking the patient-link privacy change: renaming this key from `patientId` to
   * `patient` left **75 tests green** across `ward-person-screen`, `ward-referral-destinations`
   * and `ward-referral-model`, while every referral raised from this screen recorded NOBODY —
   * and the paragraph below the button went on saying "recorded against this person", itself
   * pinned by one of those passing tests. **A false sentence held up by a green test.**
   *
   * ⚠️ WHY THE EXISTING COVERAGE COULD NOT SEE IT: the end-to-end test sets the URL BY HAND
   * (`window.history.pushState(..., "?patientId=PT-001")`) and only then renders the intake. It
   * hardcodes the exact string this component is supposed to build, so producer and reader look
   * jointly tested and are not. And no browser journey reaches this screen at all — checked with
   * a control, after a first control came back empty and proved nothing.
   *
   * This asserts the producer's half of the contract: the key by name, and the id encoded.
   */
  it("builds the referral link with the patientId key, so the intake can read it back", () => {
    renderPerson();
    const href = screen.getByTestId("ward-person-refer").getAttribute("href");

    expect(href, "the Refer control must link somewhere").toBeTruthy();
    // The key by NAME. A test that only checked the id appeared somewhere in the href would pass
    // against `?patient=PT-001`, which is precisely the rename that broke nothing and everything.
    expect(href).toContain(`patientId=${encodeURIComponent(someone.id)}`);
    expect(href).toContain("/mockups/ward-flow/referrals/new");
  });

  it("says the referral IS recorded against this person, and promises no history", () => {
    // ⚠️ THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-02, AND IT IS WHY THE COPY COULD NOT
    // SILENTLY GO STALE. It pinned "the referral will NOT yet be attached to this person", which
    // was true while `Referral` had no patient link. The owner ruled that it may have one, and the
    // moment the Refer button began carrying `patientId` that sentence became a lie on a clinical
    // screen. This test went red in the same run — the copy and the capability could not part
    // company. Ward Lead expected nothing to fail here; this did.
    renderPerson();
    const note = screen.getByTestId("ward-person-refer-note");
    expect(note).toHaveTextContent(/recorded against this person/i);
    // ⚠️ AND THE TWO LIMITS THE RULING KEPT. A pointer, not a copy: identity stays on this record.
    expect(
      note,
      "the screen suggests the person's identity travels onto the referral, which is the one thing " +
        "the ruling that permitted the link did not permit",
    ).toHaveTextContent(/not copied onto the referral/i);
    // And no history is offered, because whether a ward may see where else somebody was referred is
    // FD-23 and its mechanism does not exist. A screen promising a history nobody built is how the
    // next reader concludes the read was dropped rather than never decided.
    expect(note).toHaveTextContent(/does not show/i);
  });

  it("REFUSES AN UNKNOWN PERSON rather than substituting one", () => {
    renderPerson("PT-does-not-exist");
    expect(screen.getByTestId("ward-person-missing")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-person-identity")).toBeNull();
    // The specific failure this guards: rendering `patients[0]` for an unrecognised id, which looks
    // like a working screen and is a different human being.
    expect(screen.getByTestId("ward-person-screen").textContent ?? "").not.toContain(patientDisplayName(someone));
  });

  it("carries the synthetic-prototype banner every ward screen carries", () => {
    renderPerson();
    expect(within(screen.getByTestId("ward-person-screen")).getByText(/synthetic/i)).toBeInTheDocument();
  });
});
