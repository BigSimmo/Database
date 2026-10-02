/**
 * Splits `formatEntryForCpdHome`'s text into the fields a CPD-home form asks
 * for one at a time, so each can be copied on its own.
 *
 * It parses the formatter's output rather than re-reading the entry, so the
 * fields can never drift from what "Copy everything" (and the activity's own
 * "Copy for your CPD home") puts on the clipboard: whatever that function
 * leaves out — the cost above all — is not here either. Every line is
 * `Label: value` and only the reflection, always last, may run over several
 * lines.
 */
export type CpdHomeField = { readonly label: string; readonly value: string };

const REFLECTION_MARKER = "Reflection: ";

export function cpdHomeFields(text: string): CpdHomeField[] {
  const reflectionAt = text.startsWith(REFLECTION_MARKER) ? 0 : text.indexOf(`\n${REFLECTION_MARKER}`);
  const head = reflectionAt >= 0 ? text.slice(0, reflectionAt) : text;
  const fields: CpdHomeField[] = head
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const split = line.indexOf(": ");
      return split < 0 ? { label: "", value: line } : { label: line.slice(0, split), value: line.slice(split + 2) };
    });
  if (reflectionAt >= 0) {
    const start = reflectionAt === 0 ? REFLECTION_MARKER.length : reflectionAt + 1 + REFLECTION_MARKER.length;
    fields.push({ label: "Reflection", value: text.slice(start) });
  }
  return fields;
}
