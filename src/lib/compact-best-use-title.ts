const PLACEHOLDER_SEGMENT =
  /^(?:not publicly stated|not applicable|none|n\/a|unknown|confirm locally|see referral details)$/i;

/** Skip catalogue placeholder segments before picking the compacted title. */
export function isPlaceholderCatalogSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_SEGMENT.test(trimmed)) return true;
  if (/not publicly stated/i.test(trimmed)) return true;
  if (/^service-specific referral pathway$/i.test(trimmed)) return true;
  return false;
}

/** Compact pipe/newline-joined catalog blobs for quick-fact card titles. */
export function compactBestUseTitle(text: string, maxLength = 140): string {
  const parts = text
    .split(/[|\n\r]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase().replace(/\s+/g, " ");
    if (!unique.some((entry) => entry.toLowerCase().replace(/\s+/g, " ") === key)) {
      unique.push(part);
    }
  }

  const substantive = unique.filter((part) => !isPlaceholderCatalogSegment(part));
  const primary = substantive[0] ?? unique[0] ?? text.trim();
  if (primary.length <= maxLength) return primary;
  const truncated = primary.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return truncated ? `${truncated}…` : primary.slice(0, maxLength);
}
