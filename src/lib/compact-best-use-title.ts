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

  const primary = unique[0] ?? text.trim();
  if (primary.length <= maxLength) return primary;
  const truncated = primary.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return truncated ? `${truncated}…` : primary.slice(0, maxLength);
}
