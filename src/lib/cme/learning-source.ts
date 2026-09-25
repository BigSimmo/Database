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
