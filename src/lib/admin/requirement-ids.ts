/**
 * The Requirements catalogue's ids (`src/lib/admin/requirements.ts`), pulled
 * out into their own leaf module with no imports of its own.
 *
 * `on-call/entry-model.ts` needs this list to validate a compliance row's
 * stored `requirementId` against a real catalogue slot, and
 * `admin/requirements.ts` needs it to type the catalogue's own `id` field so
 * the two can never drift apart. Neither module may import the other
 * directly: `requirements.ts` already imports `on-call/compliance.ts`, which
 * imports `on-call/entry-model.ts` as a VALUE (not just a type) — so an
 * import from `entry-model.ts` back into `requirements.ts` would close a real
 * circular value dependency the moment either side read the other's binding
 * at module-init time. That is the same trap `on-call/local-date.ts`'s
 * docblock describes for `home-modules.ts` and `compliance.ts`; a leaf module
 * both sides can depend on removes it instead of documenting it.
 *
 * **Append only.** Stored rows carry these ids in `details.requirementId`, and
 * the details schema accepts only a listed id, so removing or renaming one
 * would make every row that stores it fail to parse (its details read as
 * null, blanking the expiry date). Add ids; never remove or rename one.
 * `tests/admin-requirements.test.ts` pins every id that has shipped.
 */
export const ADMIN_REQUIREMENT_IDS = [
  "medical-registration-renewal",
  "cpd-home-and-hours",
  "recency-of-practice",
  "professional-indemnity-insurance",
  "medicare-provider-number",
  "working-with-children-check",
  "wwc-check-applicability",
  "criminal-record-screening",
  "immunisation-requirements",
  "annual-influenza-vaccination",
  "respirator-fit-testing",
  "mandatory-training-modules",
  "resuscitation-competence",
  "als-course-certification",
  "credentialing-and-scope",
  "provisional-to-general-registration",
  "img-supervised-practice",
  "img-visa-requirements",
  "code-of-conduct",
  "aboriginal-cultural-elearning",
] as const;

export type AdminRequirementId = (typeof ADMIN_REQUIREMENT_IDS)[number];
