import type { LegalForm } from "@/components/ward-management/ward-model";
import { formTitleForCode } from "@/lib/form-register";

/**
 * The legal forms a clinician may choose from, and how a form names itself on screen.
 *
 * **Why this is its own module rather than part of `ward-model.ts`.** `ward-model.ts` declares
 * `ED_ACCESS_TARGET_MINUTES` — the departmental access target, a performance measure that has
 * already been mistaken for a legal deadline once. `tests/ward-flow-single-source.test.ts` keeps
 * the two quarantined: no file that spells out a `{code, label, kind}` legal-form literal may
 * also reference that constant. Declaring the list beside the constant tripped that guard, which
 * was the guard doing its job, so the list moved rather than the guard being relaxed.
 */

/**
 * The legal forms the intake picker offers, in the order it offers them. This list is the
 * single source for that picker, so admitting a further code later is a one-line change here.
 *
 * The software no longer decides which form a patient is on; the clinician chooses it and it
 * never changes by itself. Product owner, 2026-08-24: "A patient will be on 1A or 3D or other
 * forms potentially… so avoid any hard rules now please. Just focus on voluntary and
 * involuntary and I can choose what option in the patient selection." `RAISE_REFERRAL` no
 * longer derives a form from `legalStatus`, and `RECORD_EXAMINATION` no longer replaces or
 * clears one.
 *
 * **An entry carries a code, and no meaning.** Titles come from the register at render time
 * (`legalFormName`), never from here — the product owner approved adopting the official titles
 * on 2026-08-24 after being shown that this prototype's own labels had drifted from them.
 * `kind` is retained only because the fixture and the type already carried it; nothing reads
 * it, it is never displayed, and Form 3D has none because this model holds no classification
 * for a 3D and the register's categories were explicitly not adopted.
 *
 * No entry carries a `dueAt`. Forms record *that* they exist, never *when they lapse* — see
 * `LegalForm`'s own doc comment and `tests/ward-legal-figure-guard.test.ts`.
 */
export const SELECTABLE_LEGAL_FORMS: readonly LegalForm[] = [
  { code: "1A", kind: "examination" },
  { code: "3B", kind: "detention" },
  { code: "3D" },
  { code: "4A", kind: "transport" },
  { code: "4C", kind: "transfer" },
];

/**
 * How a legal form names itself on screen, code first — "Form 1A (Referral for examination by a
 * psychiatrist)".
 *
 * The title is the Chief Psychiatrist register's, resolved from the code every time it is
 * rendered. Ward Flow holds no titles of its own, so it cannot drift from the register the way
 * its old stored labels did. When the register does not list the code, `formTitleForCode`
 * returns `null` and this renders the **bare code** — never a substituted or locally-invented
 * title, and never the word "undefined".
 */
export function legalFormName(form: LegalForm): string {
  const title = formTitleForCode(form.code);
  return title === null ? `Form ${form.code}` : `Form ${form.code} (${title})`;
}

/**
 * The same name with the title first — "Referral for examination by a psychiatrist (1A)" — the
 * wording the console, mode and network surfaces already used. A code the register does not
 * list falls back to the same bare "Form 3D" as `legalFormName`, because there is no title to
 * put first.
 */
export function legalFormNameLabelFirst(form: LegalForm): string {
  const title = formTitleForCode(form.code);
  return title === null ? `Form ${form.code}` : `${title} (${form.code})`;
}
