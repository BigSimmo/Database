/**
 * Owner rule, 2026-09-26: no Aboriginal, Torres Strait Islander, First Nations or other
 * Indigenous content may be signed off through the clinical sign-off tools. It needs review
 * under Aboriginal governance, which a non-Indigenous editorial sign-off cannot supply (the
 * same reason Formulation's first-nations-sewb record is held from release).
 *
 * The match is deliberately broad: a false positive only leaves a record awaiting review,
 * which is the safe state; a miss would let Indigenous content read as reviewed.
 */
export const INDIGENOUS_CONTENT_PATTERN =
  /\b(aboriginal|torres strait|first nations|first peoples|indigenous|sewb|social and emotional wellbeing|13yarn|thirrili|yarning|yarn|koori|noongar|nyoongar|stolen generations?|culture care connect|acchos?|acchs?|community[- ]controlled)\b/i;

export const INDIGENOUS_CONTENT_RULE =
  "owner rule 2026-09-26: Aboriginal, Torres Strait Islander and other Indigenous content needs Aboriginal governance review and is never signed off with this tool";

/** The first Indigenous term found anywhere in a value (deeply), or null. */
export function indigenousContentTerm(value) {
  let text;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  const match = INDIGENOUS_CONTENT_PATTERN.exec(text ?? "");
  return match ? match[0] : null;
}
