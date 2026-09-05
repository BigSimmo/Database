import { expect } from "vitest";

/**
 * Assertions for the qualifying captions on Ward Flow screens — the sentences that stop a figure
 * being read as something it is not ("these beds are already free", "not a measurement of how long
 * beds take to fill", "withheld pending an owner ruling").
 *
 * 🔴 **WHY THIS EXISTS.** Those captions were guarded by pinning the sentence:
 * `expect(text).toContain("Every measured gap here is the same length")`. That pins the RENDERING.
 * The owner is redesigning many pages, and every one of those assertions goes red the moment a
 * caption is reworded — while the thing the caption exists for is still true. A guard that fires on
 * correct work gets deleted, and the honest guards go with it in the same tidy-up. The instruction
 * this file implements, from the owner on 2026-09-05:
 *
 *   > "ensure that all testing works with the redesigns rather than fighting them"
 *
 * ⚠️ **AND THE OPPOSITE FAILURE IS WORSE, WHICH IS WHY THIS IS NOT JUST A DELETION.** The real risk
 * during a redesign is not a reworded caveat; it is a caveat *dropped* while the figure it qualifies
 * stays on the screen. That is the defect these assertions must keep catching, and pinning the
 * sentence never distinguished the two — a missing caption and a rewritten one both read as the same
 * red. Presence and substance are properties; wording is not.
 *
 * ⚠️ **WHAT THIS DELIBERATELY GIVES UP.** A caption reworded into something *wrong* passes here.
 * Nothing short of reading the sentence can catch that, and reading the sentence is what fights the
 * redesign. Where a caption carries a claim that must stay true regardless of phrasing — a legal
 * status warning, an owner ruling, a named record — assert that claim separately and by name. Do not
 * try to recover it by lengthening `minimumLength`.
 */

/** Collapses the whitespace Prettier and JSX introduce, so a line-wrapped sentence still reads as one. */
export function screenText(element: { textContent: string | null } | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * One concept a caption must still carry, checked against already-extracted text.
 *
 * The line-by-line form of `expectCaption`, for the many places that already hold the text in a
 * local. Same rule: `expectSays(text, "the constant-gap note", ["same length", "identical"])`, never
 * the whole sentence.
 */
export function expectSays(
  source: string | { textContent: string | null } | null | undefined,
  of: string,
  concept: string | readonly string[],
): void {
  const spellings = typeof concept === "string" ? [concept] : concept;
  // Accepts an element or an already-extracted string. Some ward screens expose a caption as a
  // derived string rather than a node, and appending `.textContent` to a string yields undefined —
  // which reads as "the caption is empty" and fails on correct code. Widened after doing exactly
  // that during the conversion pass.
  const text = typeof source === "string" ? source : screenText(source);
  const haystack = screenText({ textContent: text }).toLowerCase();
  expect(
    spellings.some((spelling) => haystack.includes(spelling.toLowerCase())),
    `the caption for ${of} no longer says ${spellings.map((s) => `"${s}"`).join(" or ")}. Got: "${screenText({ textContent: text })}". ` +
      "Rewording is fine — add the new spelling here. A concept that is genuinely gone means the caption " +
      "stopped saying the thing it existed to say.",
  ).toBe(true);
}

/**
 * A wording this screen must NEVER say again, because it said it once and it was false.
 *
 * ⚠️ **Weaker than it looks, and deliberately kept anyway.** Forbidding a string cannot stop the same
 * false CLAIM returning in different words — three rephrasings restore the defect green. Give every
 * spelling you can think of, and treat this as a tripwire on a known regression rather than as proof
 * the claim is absent. Where the claim can be checked against the model instead, do that and delete
 * this.
 */
export function expectNeverSaysAgain(text: string, of: string, retired: readonly string[]): void {
  const haystack = screenText({ textContent: text }).toLowerCase();
  const returned = retired.filter((phrase) => haystack.includes(phrase.toLowerCase()));
  expect(
    returned,
    `${of} has brought back wording that was retired as false: ${returned.map((r) => `"${r}"`).join(", ")}. ` +
      "This is a regression guard for a claim this page already shipped once and had to withdraw.",
  ).toEqual([]);
}

export interface CaptionExpectation {
  /** What the caption qualifies, named for the failure message: "the pull-to-arrival average". */
  readonly of: string;
  /**
   * A caption that must carry no numeral, because the figure it describes is unmeasurable or
   * withheld — printing a number there is the defect (an absence rendered as a measurement).
   */
  readonly numeralFree?: boolean;
  /**
   * Minimum collapsed length. Defaults to 20: long enough that a stray word or an empty element
   * fails, short enough that no realistic rewrite of a real caption does.
   */
  readonly minimumLength?: number;
  /**
   * Concepts the caption must still carry, however it is phrased. Each entry is ONE concept: a bare
   * string, or a list of accepted spellings of which any one satisfies it.
   *
   * ⚠️ **Put concepts here, never sentences.** `["withheld", "held back", "pending"]` is a concept;
   * `"withheld pending an owner ruling"` is the rendering again in a longer coat. The test is
   * Ward Lead's: restate the same fact in different words and the assertion must survive. Use it
   * only where the caption's CONTENT is the requirement — a misreading it must rule out, a record it
   * must name — and let plain presence cover the rest.
   *
   * Matching is case-insensitive on the whitespace-collapsed text, so a stem like `"record"` also
   * accepts "recorded" and "unrecorded". That is deliberate: a stem survives more rewrites than a
   * word, and these captions are prose.
   */
  readonly mentions?: readonly (string | readonly string[])[];
}

/**
 * The caption qualifying `of` is present and is a real sentence.
 *
 * Fails when the caption is missing, empty, or trimmed to a fragment — the redesign risk. Passes
 * through any rewording, which is not a risk.
 */
export function expectCaption(
  element: { textContent: string | null } | null | undefined,
  { of, numeralFree = false, minimumLength = 20, mentions = [] }: CaptionExpectation,
): void {
  const text = screenText(element);

  expect(
    element,
    `no caption element for ${of}. If this figure moved, point the assertion at its new element; ` +
      "if the caption was removed, the figure is now unqualified on the screen and that is the defect.",
  ).not.toBeNull();

  expect(
    text.length,
    `the caption for ${of} is "${text}" — too short to qualify anything. Rewording it is fine; ` +
      "dropping it leaves the figure on the screen with nothing saying what it does not mean.",
  ).toBeGreaterThanOrEqual(minimumLength);

  const haystack = text.toLowerCase();
  const missing = mentions.filter((concept) =>
    (typeof concept === "string" ? [concept] : concept).every((spelling) => !haystack.includes(spelling.toLowerCase())),
  );
  expect(
    missing.map((concept) => (typeof concept === "string" ? concept : concept.join(" / "))),
    `the caption for ${of} no longer carries concept(s) it must: got "${text}". Reword it however you ` +
      "like — but if the concept is genuinely gone, the caption stopped ruling out the reading it existed to rule out. " +
      "If the redesign renamed the concept, add the new spelling to this assertion rather than deleting it.",
  ).toEqual([]);

  if (numeralFree) {
    const numerals = text.match(/\d/gu) ?? [];
    expect(
      numerals,
      `the caption for ${of} contains a numeral: "${text}". This figure is unmeasurable or withheld, ` +
        "so a number here reads as a measurement that was never taken.",
    ).toEqual([]);
  }
}
