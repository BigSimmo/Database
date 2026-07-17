import fc from "fast-check";
import "./property-seed";
import { describe, expect, it } from "vitest";
import {
  clinicalProseUsefulness,
  sourceTextForDisplay,
  sourceTextForModel,
  sourceTextForVerbatimQuote,
} from "../src/lib/source-text-sanitizer";

// Property: no numeric token with a unit ever disappears through sanitization.
//
// The sanitizer is allowed to drop provenance noise, banners, title fragments,
// and boilerplate — but a dose/threshold figure embedded in clinical prose is
// exactly the content whose silent loss the 2026-07-01 audit flagged as a
// clinical-safety failure (H2: the GCS threshold sentence). These properties
// pin that guarantee over a generated input space instead of single examples.
//
// The generated prose deliberately avoids tokens the sanitizer is CONTRACTED
// to remove (document codes, "Page N of N", "OFFICIAL" banners, "… evidence:"
// labels, chunk/similarity telemetry) so the assertions target preservation of
// clinical values, not the noise-stripping behaviour itself. Noise of those
// shapes is injected AROUND the dose sentences and carries no assertions.

const drugs = ["clozapine", "lithium", "olanzapine", "quetiapine", "sertraline", "haloperidol"] as const;

// Units recognized by the sanitizer's threshold-rescue pattern
// (clinicalThresholdSignalPattern) and by answer-verification's extractor.
const units = ["mg", "mcg", "micrograms", "mmol", "units", "hours", "mmHg", "bpm"] as const;

const integerValue = fc.integer({ min: 1, max: 2000 }).map(String);
const decimalValue = fc
  .tuple(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 1, max: 9 }))
  .map(([whole, tenth]) => `${whole}.${tenth}`);
const numericValue = fc.oneof(integerValue, decimalValue);

// A unit-bearing dose/threshold token, in the spellings that appear in real
// extracted source text: spaced ("12.5 mg"), attached ("100mg"), ranges
// ("25-50 mg"), percentages ("1.85%"), and comparatives ("8 or below").
const doseToken = fc.oneof(
  fc.tuple(numericValue, fc.constantFrom(...units)).map(([value, unit]) => `${value} ${unit}`),
  fc.tuple(numericValue, fc.constantFrom("mg", "mcg")).map(([value, unit]) => `${value}${unit}`),
  fc.tuple(integerValue, integerValue, fc.constantFrom(...units)).map(([low, high, unit]) => `${low}-${high} ${unit}`),
  decimalValue.map((value) => `${value}%`),
  integerValue.map((value) => `${value} or below`),
);

// Sentences that carry the dose token. Every template yields >= 3 tokens (the
// sanitizer unconditionally drops shorter fragments) and none starts with the
// "the retrieved/supplied/provided/indexed" meta-intro the sanitizer removes.
const doseSentence = fc
  .tuple(doseToken, fc.constantFrom(...drugs), fc.integer({ min: 0, max: 4 }))
  .map(([token, drug, template]) => {
    switch (template) {
      case 0:
        return { token, sentence: `Administer ${drug} ${token} daily with food.` };
      case 1:
        return { token, sentence: `Withhold ${drug} when the count is ${token} and contact the prescriber.` };
      case 2:
        return { token, sentence: `Titrate ${drug} to ${token} over three days.` };
      case 3:
        // Title-shaped threshold sentence — the audit-H2 GCS case: a sentence
        // that looks like a source-title fragment ("… Scale …") but carries
        // clinical values must never be dropped.
        return {
          token,
          sentence: `The Glasgow Coma Scale ranges from 3 to 15 with ${token} indicating severe head injury.`,
        };
      default:
        return { token, sentence: `Monitor the serum level and maintain ${token} until review.` };
    }
  });

// Droppable noise the sanitizer exists to remove. No assertions attach to it.
const noiseSentence = fc.constantFrom(
  "Neuroleptic side effect Guideline Appendix 1.",
  "OFFICIAL",
  "Page 3 of 5",
  "Document owner: Pharmacy Department.",
  "Uncontrolled when printed.",
  "Mental Health Procedure PAE-PRO-0338/16.",
  "LUNSERS (Liverpool University Neuroleptic Side Effect Rating Scale) rating scale appendix.",
);

const separator = fc.constantFrom(" ", "\n", "\n\n");

const clinicalDocument = fc
  .tuple(
    fc.array(doseSentence, { minLength: 1, maxLength: 4 }),
    fc.array(noiseSentence, { minLength: 0, maxLength: 4 }),
    separator,
    fc.boolean(),
  )
  .map(([doses, noise, join, noiseFirst]) => {
    const parts = noiseFirst
      ? [...noise, ...doses.map((dose) => dose.sentence)]
      : [...doses.map((dose) => dose.sentence), ...noise];
    return { text: parts.join(join), tokens: doses.map((dose) => dose.token) };
  });

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

describe("property: unit-bearing numeric tokens survive sanitization", () => {
  it("clinicalProseUsefulness never drops a fragment carrying a dose/threshold token", () => {
    fc.assert(
      fc.property(clinicalDocument, ({ text, tokens }) => {
        const kept = normalizeWhitespace(clinicalProseUsefulness(text).text);
        for (const token of tokens) {
          expect(kept).toContain(normalizeWhitespace(token));
        }
      }),
    );
  });

  it("display, model, and verbatim-quote sanitizers preserve dose/threshold tokens", () => {
    fc.assert(
      fc.property(clinicalDocument, ({ text, tokens }) => {
        for (const sanitized of [
          sourceTextForDisplay(text),
          sourceTextForModel(text),
          sourceTextForVerbatimQuote(text),
        ]) {
          const haystack = normalizeWhitespace(sanitized);
          for (const token of tokens) {
            expect(haystack).toContain(normalizeWhitespace(token));
          }
        }
      }),
    );
  });
});
