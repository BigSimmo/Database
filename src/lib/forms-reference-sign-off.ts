/**
 * Whether a Forms reference record (a Chief Psychiatrist's Standard summary or a form's
 * cultural note) may be shown as clinically reviewed, and by whom.
 *
 * `npm run clinical:review` writes a sign-off as `status: "reviewed"` plus `reviewedBy`,
 * `reviewedAt` (a UTC ISO instant) and `reviewedContentSha256` (the content pin). The page
 * shows "Reviewed by <name>" only when all four are well formed; anything short of that
 * keeps the record's "awaiting clinical review" caveat. The pin itself is checked by the
 * offline gates, not here; this only refuses a sign-off that could not have come from the tool.
 *
 * Owner rule (2026-09-26): Aboriginal, Torres Strait Islander, First Nations or other
 * Indigenous content needs Aboriginal governance review, not a clinician sign-off, so such a
 * record never shows as reviewed here, whatever its file says.
 */

const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256 = /^[a-f0-9]{64}$/;
/**
 * At least as broad as INDIGENOUS_CONTENT_PATTERN in scripts/lib/indigenous-content.mjs (which
 * the sign-off tool applies); tests/signoff-standards-and-cultural-notes.test.ts checks that.
 * A false positive only leaves a record awaiting review, which is the safe state.
 */
const INDIGENOUS_CONTENT =
  /aborigin|torres\s+strait|first\s+(?:nations?|peoples?)|indigenous|social\s+and\s+emotional\s+wellbeing|stolen\s+generations?|culture\s+care\s+connect|community[-\s]controlled|traditional\s+healers?|\b(?:atsi|sewb|13\s*yarn|thirrili|yarn(?:ing)?|koori|n(?:y)?oongar|acchos?|acchs?|elders?)\b/i;

export type ReferenceSignOff = {
  status?: unknown;
  reviewedBy?: unknown;
  reviewedAt?: unknown;
  reviewedContentSha256?: unknown;
};

function realUtcInstant(value: unknown): boolean {
  if (typeof value !== "string" || !UTC_ISO_TIMESTAMP.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  // Rejects calendar overflow such as 2026-02-31, which Date.parse silently rolls forward.
  const normalized = value.includes(".") ? value : value.replace(/Z$/, ".000Z");
  return new Date(milliseconds).toISOString() === normalized && milliseconds <= Date.now();
}

/** True when any of the shown text is Aboriginal, Torres Strait Islander or other Indigenous content. */
export function isIndigenousContent(shownText: readonly unknown[]): boolean {
  return shownText.some((value) => typeof value === "string" && INDIGENOUS_CONTENT.test(value));
}

/**
 * The reviewer's name when the record carries a complete, well-formed sign-off and none of
 * `shownText` is Indigenous content; otherwise `null` (the record stays awaiting review).
 */
export function signedOffReviewer(record: ReferenceSignOff, shownText: readonly unknown[]): string | null {
  if (record.status !== "reviewed") return null;
  const reviewer = typeof record.reviewedBy === "string" ? record.reviewedBy.trim() : "";
  if (!reviewer) return null;
  if (!realUtcInstant(record.reviewedAt)) return null;
  if (typeof record.reviewedContentSha256 !== "string" || !SHA256.test(record.reviewedContentSha256)) return null;
  if (isIndigenousContent(shownText)) return null;
  return reviewer;
}
