import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PATIENT_FIELDS } from "@/components/ward-management/ward-patients";

/**
 * **THE GOVERNANCE CARDS, CHECKED AGAINST THE PRODUCT RATHER THAN AGAINST THEMSELVES.**
 *
 * Deliberately small. This is a prototype in active redesign, and the owner asked for the main
 * checks only — an oversized governance suite during rapid change is one that gets deleted whole.
 * Three checks, all of them fast, none of them pinning a sentence.
 *
 * ⚠️ **IT PINS NO WORDING, BY DESIGN.** The owner is redesigning many pages. A guard that reddens on
 * an honest rewrite gets deleted, and the honest guards go with it. Every check here reads the CLAIM
 * out of the card and tests it against the model, so the cards can be rephrased or shortened freely
 * and only a FALSE card fails.
 *
 * It exists because on 2026-09-05 nothing guarded these six cards at all, and four of them were
 * wrong — two overstating the product's restraint, two understating what it already does. The
 * "Minimum data" card claimed no name, MRN, DOB or address while the record held and displayed all
 * four; it had been false for six days, falsified by a change with no reason to look at this screen.
 *
 * ⚠️ **It reads `PATIENT_FIELDS`, the runtime array — never the `Patient` type.** A guard specified
 * over a TypeScript type does not execute under `vitest run` at all, so it would pass on a tree that
 * had quietly added `diagnosis`.
 */

const MODES = "src/components/ward-management/ward-management-modes.tsx";

/** The card's own sentence, read from source. A copy kept here is how a guard comes to check a
 *  sentence the product stopped rendering. */
function cardProse(heading: string): string {
  const source = readFileSync(MODES, "utf8");
  const at = source.indexOf(`<h2>${heading}</h2>`);
  expect(at, `no governance card headed "${heading}" — this guard is checking a card that moved`).toBeGreaterThan(-1);
  const open = source.indexOf("<p>", at);
  const close = source.indexOf("</p>", open);
  const prose = source
    .slice(open + 3, close)
    .replace(/\{"[^"]*"\}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  // Anti-vacuity: a silent parse failure would make every assertion below pass over "".
  expect(prose.length, `the "${heading}" card parsed as "${prose}"`).toBeGreaterThan(30);
  return prose;
}

/** What a term on a card MEANS in the model. The one judgement here, kept small and reviewable. */
const TERM_FIELDS: Record<string, readonly string[]> = {
  name: ["givenName", "familyName", "preferredName"],
  mrn: ["umrn"],
  dob: ["dateOfBirth"],
  address: ["address", "suburb"],
  diagnosis: ["diagnosis", "primaryDiagnosis"],
  "risk flags": ["riskFlags", "alerts"],
  medication: ["medication", "medications"],
  "next of kin": ["nextOfKin", "nextOfKinContact", "carerContact"],
  "narrative history": ["historyWhyNow", "historyBackground", "historyRiskAndSafety", "progressNotes"],
};

/**
 * Every field the record holds, classified. ⚠️ **This is the half that actually protects the claim**,
 * because an exclusion list can only check the fields somebody thought to name — and nobody would
 * think to write "no Indigenous status" on a governance card, so no exclusion list would ever reach
 * `aboriginalOrTorresStraitIslanderStatus` or `interpreterLanguage`. Found by Ward Verifier.
 *
 * `legalStatus` is OPERATIONAL, not clinical: it decides which ward may lawfully hold someone, and
 * owner ruling R-2026-09-04-A approved it on that basis. The two fields not yet settled for DISPLAY
 * are identity facts, not clinical findings; whether a screen may show them is a separate question.
 */
const FIELD_CLASS: Record<string, "identity" | "operational" | "clinical"> = {
  id: "identity",
  umrn: "identity",
  givenName: "identity",
  familyName: "identity",
  preferredName: "identity",
  dateOfBirth: "identity",
  sexOrGender: "identity",
  aboriginalOrTorresStraitIslanderStatus: "identity",
  interpreterLanguage: "identity",
  address: "operational",
  suburb: "operational",
  generalPractitioner: "operational",
  catchmentCommunityTeam: "operational",
  legalStatus: "operational",
};

describe("the governance cards", () => {
  /** The negative half: nothing a card says the record does not hold may actually be held. */
  it("holds no patient field that a card says it does not hold", () => {
    const prose = cardProse("Minimum data").toLowerCase();
    // ⚠️ THE ABSENCE IS EXPLICIT, because the obvious form is a silent vacuous pass: with no " no "
    // in the card, `indexOf` returns -1 and `slice(-1)` yields the LAST CHARACTER — the scan then
    // reads "." and finds nothing, green. A card that excludes nothing must fall to the positive
    // check below, not slip past this one wearing its costume. Found by Ward Verifier.
    const noAt = prose.indexOf(" no ");
    const after = noAt === -1 ? "" : prose.slice(noAt);
    const contradictions = Object.keys(TERM_FIELDS)
      .filter((term) => after.includes(term))
      .flatMap((term) =>
        TERM_FIELDS[term]
          .filter((field) => (PATIENT_FIELDS as readonly string[]).includes(field))
          .map((field) => `${term} -> ${field}`),
      );
    expect(
      contradictions,
      `the card excludes these and the record carries them anyway:\n  ${contradictions.join("\n  ")}\n` +
        "Fix the CARD to describe owner ruling R-2026-09-04-A — never the model.",
    ).toEqual([]);
  });

  /**
   * The positive half, and the one that survives any rewording: the card says identity and
   * operational facts only, so nothing clinical may be held. A new field with no classification
   * fails by name, because adding one is a governance decision rather than a default.
   */
  it("holds only the classes of fact the card claims to hold", () => {
    const prose = cardProse("Minimum data");
    expect(PATIENT_FIELDS.length, "no patient fields to check against").toBeGreaterThan(5);

    // A new field cannot arrive silently: it fails BY NAME and forces somebody to classify it.
    // ⚠️ That converts a silent addition into a deliberate misclassification, which is as much as a
    // hand-classified guard can buy — stated rather than implied, per Ward Verifier.
    const unclassified = (PATIENT_FIELDS as readonly string[]).filter((field) => FIELD_CLASS[field] === undefined);
    expect(
      unclassified,
      `the record gained field(s) nobody has classified: ${unclassified.join(", ")} — classify each here, ` +
        "and check the card still tells the truth.",
    ).toEqual([]);

    // 🔴 THE TOLERANCE IS READ OUT OF THE CARD, NOT HARD-CODED HERE. Until 2026-09-05 this asserted
    // "nothing classified clinical" against a fixed identity+operational allowance written in this
    // file — so it could not notice a card claiming LESS than the record holds. Ward Verifier broke
    // it with three short cards, all false, all green: "Identity facts only.", "no patient
    // information of any kind beyond a synthetic identifier", "A minimal synthetic record".
    //
    // ⚠️ AND THAT IS THE DANGEROUS SIDE OF THE SEAM THE OWNER IS PUSHING ON. He asked for shorter
    // cards. The floor removed earlier made a short TRUE card fail; this made a short FALSE card
    // pass. Deriving the tolerance fires only when the card's MEANING narrows, so any rewording
    // that preserves the meaning is free.
    const claims: Record<string, boolean> = {
      identity: /identit|identif/iu.test(prose),
      operational: /operational|service detail|administrative/iu.test(prose),
      clinical:
        /clinical|diagnos|treatment/iu.test(prose) &&
        !/no |never|not /iu.test(prose.slice(0, prose.search(/clinical|diagnos|treatment/iu))),
    };
    expect(
      Object.values(claims).some(Boolean),
      `the Minimum data card names no class of fact this guard understands: "${prose}"`,
    ).toBe(true);

    const unclaimed = (PATIENT_FIELDS as readonly string[])
      .filter((field) => claims[FIELD_CLASS[field]] !== true)
      .map((field) => `${field} (${FIELD_CLASS[field]})`);
    expect(
      unclaimed,
      `the card no longer claims every class the record holds, so either the card or the record is wrong:\n  ` +
        `${unclaimed.join("\n  ")}\ncard: "${prose}"`,
    ).toEqual([]);
  });

  /**
   * 🔴 **THE ONE TRUE, UNCOMFORTABLE SENTENCE ON THE SCREEN — it must survive a tidy-up.**
   *
   * The system records what a human DECIDED but not what it RECOMMENDED, nor the bed state it
   * recommended against, so a past decision cannot be reviewed against what the clinician actually
   * saw. That reads like hedging and is exactly what a rewrite sweeps out with the false claims.
   *
   * ⚠️ **No wording is pinned.** The LIMITATION is established from the model first; only then is a
   * disclosure required. Build the recording and the guard stands down on its own.
   */
  it("keeps disclosing that no recommendation is recorded, for as long as none is", () => {
    const reducer = readFileSync("src/components/ward-management/ward-flow-reducer.ts", "utf8");
    const state = reducer.slice(reducer.indexOf("export type WardFlowState"));
    const stateBlock = state.slice(0, state.indexOf("};"));
    if (/recommendation|shortlist|proposal|capacityHistory/i.test(stateBlock)) return;

    const source = readFileSync(MODES, "utf8");
    // ⚠️ Whitespace collapsed FIRST. JSX prose is line-wrapped by Prettier, so a phrase can land
    // with a newline and indentation inside it — "is not\n      recorded". Matching against raw
    // source reported the disclosure missing when it was present and correct, which is a guard
    // failing in the direction that makes somebody go and "fix" honest copy.
    // ⚠️ JSX COMMENTS STRIPPED FIRST, THEN CONTINUATION MARKERS, THEN WHITESPACE — all three.
    // This file carries a long {/* ... */} block explaining a defect in the very card below, and a
    // guard scanning raw source is satisfied by PROSE ABOUT a sentence as readily as by the
    // sentence. Delete the disclosure, leave the comment describing it, and this goes green over a
    // screen that no longer says it. Measured today: both forms match, so the hole is latent, not
    // live. Ward Lead separately measured that Prettier wraps a block comment with a " * "
    // continuation marker, which is NOT whitespace and survives a whitespace-only collapse.
    const cards = source
      .slice(source.indexOf("<h2>Explainable proposal</h2>"))
      .replace(/\{\/\*[\s\S]*?\*\/\}/gu, " ")
      // ⚠️ BLOCK COMMENTS TOO, AND THIS LINE EXISTS BECAUSE MY OWN PREVIOUS FIX OPENED THE HOLE.
      // Stripping the " * " continuation markers below was right for finding a WRAPPED sentence in
      // rendered prose — and it also reassembles a wrapped JSDoc comment into a flat sentence,
      // making comment text MORE matchable rather than less. Measured: with only the JSX-comment
      // strip, a block comment containing the disclosure SATISFIED this guard. A fix that
      // regenerated the defect it had just closed, in the opposite direction. Raised by Ward
      // Verifier, whose rule is the one that caught it: WRAP the subject as well as rewording it.
      .replace(/\/\*[\s\S]*?\*\//gu, " ")
      .replace(/^\s*\*\s?/gmu, " ")
      .replace(/\s+/gu, " ");
    const disclosed = /recommend/i.test(cards) && /(not recorded|no record|unrecoverable|does not record)/i.test(cards);
    expect(
      disclosed,
      "no card discloses that what the system recommended is not recorded, while the state records none. " +
        "That is the only load-bearing true claim here; it must not be swept out with the false ones.",
    ).toBe(true);
  });
});
