/** Only inert source links are accepted; nothing is fetched or logged by this parser. */
export function normalizeCmeSourceUrl(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2000 || /[\\\u0000-\u0020\u007f]/.test(text)) return null;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const url = new URL(text);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export type CmeLearningPrefill = { title?: string; sourceUrl?: string };
export function parseCmeLearningPrefill(query: { title?: unknown; sourceUrl?: unknown }): CmeLearningPrefill {
  const title = typeof query.title === "string" && query.title.trim().length <= 200 ? query.title.trim() : undefined;
  const sourceUrl = typeof query.sourceUrl === "string" ? normalizeCmeSourceUrl(query.sourceUrl) : null;
  return { ...(title ? { title } : {}), ...(sourceUrl ? { sourceUrl } : {}) };
}

/**
 * The "Log as CPD" link from a clinical answer: a new CME entry with the cited
 * source's title and link filled in.
 *
 * It deliberately carries the SOURCE, never the question that was asked. A
 * question can hold patient detail, and a query string is kept in browser
 * history and server logs; the doctor writes their own learning question on
 * the form. Opening the form logs nothing, so no CPD credit follows a click.
 */
export function cmeLearningFromSourceHref(source: { title: string; href: string }): string | null {
  const title = source.title.trim().slice(0, 200).trim();
  const sourceUrl = normalizeCmeSourceUrl(source.href);
  if (!title || !sourceUrl) return null;
  return `/cme/new?${new URLSearchParams({ title, sourceUrl }).toString()}`;
}

/**
 * The Log as CPD link for an answer's source rail: the first row the answer
 * actually cites. An "also found" row (`cited === false`) is never offered as
 * what the doctor learned from.
 */
export function cmeLearningFromRailHref(
  rows: readonly { title: string; href: string; cited?: boolean }[],
): string | null {
  const lead = rows.find((row) => row.cited !== false);
  return lead ? cmeLearningFromSourceHref(lead) : null;
}
