export type SearchEntry = { id: string; title: string; detail: string; href: string; number?: string };

const normalise = (text: string) => text.toLocaleLowerCase("en-AU").normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Local only: the query never leaves this function (design standard §13). */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = 8): SearchEntry[] {
  const tokens = normalise(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const digits = query.replace(/\D/g, "");
  const first = tokens[0] ?? "";
  const hits: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = normalise(entry.title);
    const haystack = `${title} ${normalise(entry.detail)}`;
    const numberHit = digits.length >= 3 && (entry.number ?? "").replace(/\D/g, "").includes(digits);
    if (!numberHit && !tokens.every((t) => haystack.includes(t))) continue;
    const score =
      (tokens.every((t) => title.includes(t)) ? 2 : 0) + (title.startsWith(first) ? 1 : 0) + (numberHit ? 1 : 0);
    hits.push({ entry, score });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((h) => h.entry);
}
