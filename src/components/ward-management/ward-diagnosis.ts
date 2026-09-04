/**
 * THE TENTATIVE DIAGNOSIS VOCABULARY — one list, shared by everything that carries a diagnosis.
 *
 * **Why this is its own module and not part of `ward-admissions.ts`, where it was written.**
 * The product owner decided on 2026-08-29 that a tentative diagnosis "should arrive with referral
 * and be easy to continually adjust and refine along the way". A referral exists BEFORE any
 * admission does — it is the request that may one day produce one — so a referral reaching into
 * the admission model for its vocabulary reads backwards even where it compiles, and would make
 * the referral depend on a record that does not exist yet at the moment the referral is written.
 * The vocabulary is older than both records and belongs beside neither.
 *
 * **Nothing in here knows what holds a diagnosis.** No `Admission`, no `Referral`, no screen. It is
 * a list, a membership check and one renderer. Anything that needs to widen this file to describe a
 * particular record is doing something that belongs in that record's own module.
 *
 * The governance around the field itself — that a diagnosis is optional, that only the latest value
 * is shown, that every rendering says "tentative" — lives with the records and the screens, because
 * those are decisions about use rather than about the vocabulary.
 */

/**
 * THE ELEVEN BROAD BLOCKS A TENTATIVE DIAGNOSIS MAY BE — the whole vocabulary, and the only one.
 *
 * **These are the ICD-10-AM Chapter V block headings.** ICD-10-AM is the Australian Modification
 * of ICD-10 and is the classification used for admitted-patient mental health coding in Australia,
 * which is why these headings and not a friendlier set invented here: a category a coder in a WA
 * hospital would not recognise is a category nobody can check. **They are quoted, not paraphrased.**
 * Do not reword a heading to read more naturally, do not split one, and do not add a twelfth — the
 * set is the standard's, not this prototype's, and changing it means the screen no longer says what
 * the standard says.
 *
 * **`code` is not decoration.** It is what makes an entry verifiable against the classification;
 * the words alone are not, because two people paraphrasing the same heading produce two different
 * strings that both look plausible. Every entry carries its block code and every rendering shows it.
 *
 * **F70–F79 is DELIBERATELY WORDED "Intellectual disability".** The original ICD-10 and the older
 * ICD-10-AM editions title that block "Mental retardation". The product owner supplied the current
 * term, on purpose, and this substitution is recorded here so that a later reader comparing this
 * list against a printed code book finds the reason rather than "correcting" it back to the
 * outdated wording. It is the one place this list knowingly departs from the source text.
 *
 * **These are BLOCKS, and a block is as fine as this prototype ever goes.** No four-character code,
 * no specific condition, no qualifier — a bed-flow board has no use for one and a synthetic
 * prototype has no business holding one. Chosen never typed, like every other vocabulary in this
 * file: a fixed runtime array plus `isTentativeDiagnosisBlock`, so no free text can reach the field
 * whatever a future screen offers.
 */
export const TENTATIVE_DIAGNOSIS_BLOCKS = [
  { code: "F00–F09", label: "Organic, including symptomatic, mental disorders" },
  { code: "F10–F19", label: "Mental and behavioural disorders due to psychoactive substance use" },
  { code: "F20–F29", label: "Schizophrenia, schizotypal and delusional disorders" },
  { code: "F30–F39", label: "Mood (affective) disorders" },
  { code: "F40–F48", label: "Neurotic, stress-related and somatoform disorders" },
  {
    code: "F50–F59",
    label: "Behavioural syndromes associated with physiological disturbances and physical factors",
  },
  { code: "F60–F69", label: "Disorders of adult personality and behaviour" },
  // The deliberate departure from the source text — see this array's own doc comment. "Mental
  // retardation" is the printed heading; "Intellectual disability" is the owner's wording and the
  // current term, and it stays.
  { code: "F70–F79", label: "Intellectual disability" },
  { code: "F80–F89", label: "Disorders of psychological development" },
  {
    code: "F90–F98",
    label: "Behavioural and emotional disorders with onset usually occurring in childhood and adolescence",
  },
  { code: "F99", label: "Unspecified mental disorder" },
] as const;

/** One block code — the value the record stores, and a member of the array above by construction. */
export type TentativeDiagnosisBlock = (typeof TENTATIVE_DIAGNOSIS_BLOCKS)[number]["code"];

/** Membership check for the block vocabulary — chosen, never typed, exactly as
 *  `isBedReleaseBlocker` is for the blocker list. */
export function isTentativeDiagnosisBlock(value: string): value is TentativeDiagnosisBlock {
  return TENTATIVE_DIAGNOSIS_BLOCKS.some((block) => block.code === value);
}

/**
 * One block as it is READ, words and code together — "Mood (affective) disorders (F30–F39)".
 *
 * ONE renderer, so no screen assembles its own phrasing and no two screens disagree about how a
 * block reads. The code travels with the words everywhere, for the reason the array's own comment
 * gives: the code is the verifiable half.
 *
 * `null` in, `null` out — a person nobody has recorded a tentative diagnosis for has no phrase, and
 * this never substitutes one. What to SAY about that absence is the screen's decision and is
 * deliberately not made here; see the ward board, which says it in words rather than leaving an
 * empty slot.
 */
export function tentativeDiagnosisPhrase(code: TentativeDiagnosisBlock | null): string | null {
  if (code === null) return null;
  const block = TENTATIVE_DIAGNOSIS_BLOCKS.find((candidate) => candidate.code === code);
  // Unreachable while the field is typed to this union, and it returns nothing rather than the raw
  // code if it ever is reached: a bare "F30–F39" on a clinical screen is a string a reader cannot
  // check, and inventing a label for an unknown code would be worse still.
  return block === undefined ? null : `${block.label} (${block.code})`;
}
