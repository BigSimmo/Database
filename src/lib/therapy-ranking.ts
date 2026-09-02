export type TherapyRankable = {
  name: string;
  aliases: string[];
  tags: string[];
  category?: string | null;
  bestUsedFor?: string | null;
  targetSymptoms?: string | null;
  clinicalSummary?: string | null;
  indications?: string | null;
};

const lowercase = (value: string | null | undefined) => (value ?? "").toLowerCase();
const normalize = (value: string | null | undefined) =>
  lowercase(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True only when the scorer can derive at least one searchable token. */
export function hasSearchableTherapyQuery(query: string | null | undefined): boolean {
  return Boolean(normalize(query));
}

/**
 * The single Therapy ranking contract used by both the dedicated catalogue and
 * universal discovery. Keeping one scorer prevents a search handoff from
 * reordering the same records.
 */
export function scoreTherapyCandidate(record: TherapyRankable, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const tokens = q.split(" ").filter(Boolean);
  const name = normalize(record.name);
  const aliases = record.aliases.map(normalize);
  const tags = normalize(record.tags.join(" "));
  const bestUsedFor = normalize(record.bestUsedFor);
  const targetSymptoms = normalize(record.targetSymptoms);
  const haystack = normalize(
    [
      record.name,
      record.category,
      record.bestUsedFor,
      record.targetSymptoms,
      record.clinicalSummary,
      record.indications,
      record.tags.join(" "),
      record.aliases.join(" "),
    ]
      .filter(Boolean)
      .join(" "),
  );

  let score = 0;
  if (name === q) score += 100;
  else if (name.startsWith(q)) score += 55;
  else if (name.includes(q)) score += 30;
  if (aliases.some((alias) => alias === q)) score += 60;
  else if (aliases.some((alias) => alias.includes(q))) score += 22;
  if (tags.includes(q)) score += 18;
  if (bestUsedFor.includes(q)) score += 10;
  if (targetSymptoms.includes(q)) score += 8;
  for (const token of tokens) {
    if (name.includes(token)) score += 12;
    if (aliases.some((alias) => alias.includes(token))) score += 8;
    if (tags.includes(token)) score += 6;
    if (haystack.includes(token)) score += 3;
  }
  return score;
}

export function rankTherapyCandidates<T extends TherapyRankable>(
  records: readonly T[],
  query: string,
  expansions: readonly string[] = [],
): Array<{ record: T; score: number }> {
  return records
    .map((record) => {
      const primaryScore = scoreTherapyCandidate(record, query);
      const expansionScore = Math.max(0, ...expansions.map((expansion) => scoreTherapyCandidate(record, expansion)));
      return {
        record,
        // Expanded terms broaden recall without outranking a direct query match.
        score: primaryScore + expansionScore * 0.25,
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.record.name.localeCompare(right.record.name));
}
