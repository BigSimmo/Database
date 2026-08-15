export type TherapyRankable = {
  name: string;
  aliases: string[];
  tags: string[];
  category?: string | null;
  modality?: string | null;
  bestUsedFor?: string | null;
  targetSymptoms?: string | null;
  clinicalSummary?: string | null;
  indications?: string | null;
};

export type TherapyRankingProfile = "catalogue" | "universal";

const lowercase = (value: string | null | undefined) => (value ?? "").toLowerCase();
const normalize = (value: string | null | undefined) =>
  lowercase(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The single Therapy ranking owner. Profiles preserve the two established
 * product contracts while they are evaluated for a future quality-tuning pass:
 * the full catalogue scorer and the universal-search projection scorer.
 */
export function scoreTherapyCandidate(record: TherapyRankable, query: string, profile: TherapyRankingProfile): number {
  if (profile === "catalogue") {
    const q = query.trim().toLowerCase();
    if (!q) return 1;
    const name = lowercase(record.name);
    const tags = record.tags.map(lowercase);
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 40;
    if (name.includes(q)) score += 20;
    if (record.aliases.some((alias) => lowercase(alias).includes(q))) score += 18;
    if (tags.some((tag) => tag.includes(q))) score += 14;
    if (lowercase(record.category).includes(q)) score += 8;
    if (lowercase(record.bestUsedFor).includes(q)) score += 6;
    if (lowercase(record.targetSymptoms).includes(q)) score += 5;
    if (lowercase(record.clinicalSummary).includes(q)) score += 3;
    if (lowercase(record.indications).includes(q)) score += 3;
    return score;
  }

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
      record.modality,
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
  profile: TherapyRankingProfile,
): Array<{ record: T; score: number }> {
  const emptyQuery = !query.trim();
  return records
    .map((record, index) => ({
      record,
      score:
        emptyQuery && profile === "universal" ? records.length - index : scoreTherapyCandidate(record, query, profile),
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.record.name.localeCompare(right.record.name));
}
