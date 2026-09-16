/**
 * The official WA Mental Health Act 2014 forms a Playbook scenario *refers to* —
 * and only those.
 *
 * READ THIS BEFORE CHANGING THE MATCHER. A statutory form is a legal instrument,
 * and the wrong one surfaced at 2am is the wrong instrument signed. So this
 * module is deliberately timid on both sides of the question:
 *
 * 1. **Only an explicit code the owner wrote counts.** A reference is a form
 *    code the owner typed into the entry's `tags`, `title`, `body` or
 *    `details.trigger` — "Form 1A", "form 1a", "F1A", the tag `form-1a`. Nothing
 *    is inferred from clinical language: "transport" does not mean Form 4A,
 *    "detention" does not mean Form 3A, "restraint" does not mean Form 10B. A
 *    keyword guess reads exactly like a recommendation, and the app never
 *    authors clinical or legal content of its own — it repeats what the owner
 *    wrote and what the register says. If the owner did not name a form, this
 *    returns an empty array and the scenario shows no forms block at all.
 *
 * 2. **The register is the only source of a form's identity.** Titles and
 *    categories come from `officialForms`; nothing here may invent, shorten or
 *    "tidy" one (see the contract at the top of `src/lib/form-register.ts`). A
 *    code the register does not list is DROPPED rather than returned with a null
 *    title: an unlisted code has no official title, no category and no page in
 *    the Forms mode to open, so a row for it would be a dead link under a
 *    heading that promises the official register.
 *
 * A bare code with no `Form`/`F` prefix is deliberately NOT a reference. Ward
 * names and room numbers collide with form codes head-on in this very mode —
 * "Ward 4B" is a real On Call contact — so the prefix is what separates a
 * statutory reference from the ward next door.
 *
 * A leaf module by design, like the register it reads: the Playbook section is a
 * client component, so this imports the register (`form-register.ts`) and never
 * `form-catalog.ts`, whose 190 KB of JSON would land in the client bundle.
 */

import { normalizeCode, officialForms } from "@/lib/form-register";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

/** One official form a scenario names, ready to render and to link. */
export type PlaybookFormReference = {
  /** The register's own spelling of the code, e.g. `1A`, `6B attachment`. */
  code: string;
  /** The official title, straight from the register. Never locally authored. */
  title: string;
  /** The register's category, e.g. `Referral and detention`. */
  category: string;
  /** In-app path of that form's page, e.g. `/forms/form-1a`. */
  href: string;
};

/** The parts of a playbook entry a form reference can be written in. */
export type PlaybookFormSource = Pick<OnCallEntry, "title" | "body" | "tags" | "details">;

/**
 * The four form pages that were built before the `form-<code>` convention and
 * are still served at their original paths. Kept in step with the `legacySlugs`
 * table in `src/lib/form-catalog.ts` by `tests/on-call-playbook-forms.test.ts`,
 * which checks every generated href against the real route table
 * (`formStaticParams()`), so a slug change there fails this module's tests
 * rather than shipping a 404 into an escalation card.
 *
 * Copied rather than imported: `form-catalog.ts` builds Maps from two large
 * JSON files at import time, which cannot be tree-shaken out of the client
 * bundle this module is used from.
 */
const LEGACY_FORM_SLUGS: Readonly<Record<string, string>> = {
  "3A": "detention-examination-movement",
  "4A": "transport-crisis-form",
  "4B": "extension-transport-order",
  "4C": "transfer-order",
};

/** The in-app page for a form code. `/forms/[slug]` is the route. */
export function formPageHref(code: string): string {
  const slug = LEGACY_FORM_SLUGS[code] ?? `form-${normalizeCode(code).replace(/[^a-z0-9]+/g, "-")}`;
  return `/forms/${slug}`;
}

/**
 * A `Form`/`F` prefix, then the code.
 *
 * - The prefix is required — see the note about "Ward 4B" above.
 * - The separator class holds no letters, so "Form after the 3 hour review"
 *   cannot reach the `3`.
 * - `(?![a-z0-9])` closes the code, so `3A` cannot match inside `3AB`, a bare
 *   `13` cannot be pulled out of `1300`, and — with the prefix rule — no digit
 *   inside a phone number is reachable at all.
 * - `attachment` is part of the code when it follows one, because the register
 *   lists `1A attachment`, `6B attachment` and `12C attachment` as codes in
 *   their own right.
 */
const FORM_REFERENCE =
  /(?:\bforms?\b[\s._\-#:]*|\bf[\s._\-]?(?=\d))(\d{1,2})([a-z])?(?![a-z0-9])(?:[\s._\-]+(attachments?)\b)?/gi;

function referencedCodes(entry: PlaybookFormSource): Set<string> {
  const trigger =
    entry.details && typeof entry.details === "object" ? (entry.details as { trigger?: unknown }).trigger : undefined;
  const haystack = [entry.title, entry.body ?? "", typeof trigger === "string" ? trigger : "", ...(entry.tags ?? [])]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");

  const found = new Set<string>();
  for (const match of haystack.matchAll(FORM_REFERENCE)) {
    const [, digits, letter, attachment] = match;
    found.add(normalizeCode(`${digits}${letter ?? ""}${attachment ? " attachment" : ""}`));
  }
  return found;
}

/**
 * The official forms this scenario names, de-duplicated and in the register's
 * own order. Empty when the owner named none — which is the common case, and
 * which the UI must render as nothing at all rather than as a prompt.
 */
export function playbookFormReferences(entry: PlaybookFormSource): PlaybookFormReference[] {
  const referenced = referencedCodes(entry);
  if (referenced.size === 0) return [];
  return officialForms
    .filter((form) => referenced.has(normalizeCode(form.code)))
    .map((form) => ({
      code: form.code,
      title: form.title,
      category: form.category,
      href: formPageHref(form.code),
    }));
}
