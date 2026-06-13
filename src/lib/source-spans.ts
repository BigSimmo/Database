export type SourceSpan = {
  page_number: number | null;
  line_start: number | null;
  line_end: number | null;
  character_start: number | null;
  character_end: number | null;
  excerpt: string;
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLookup(value: string) {
  return compact(value).toLowerCase();
}

function lineNumberAt(text: string, index: number) {
  if (index < 0) return null;
  return text.slice(0, index).split(/\r?\n/).length;
}

export function sourceSpanForText(args: {
  pageNumber: number | null;
  pageText: string;
  excerpt: string;
  fallbackExcerpt?: string;
}): SourceSpan {
  const excerpt = compact(args.excerpt || args.fallbackExcerpt || "").slice(0, 500);
  if (!args.pageText.trim() || !excerpt) {
    return {
      page_number: args.pageNumber,
      line_start: null,
      line_end: null,
      character_start: null,
      character_end: null,
      excerpt,
    };
  }

  const exactNeedle = excerpt.slice(0, Math.min(160, excerpt.length));
  const exactIndex = args.pageText.indexOf(exactNeedle);
  if (exactIndex >= 0) {
    const end = Math.min(args.pageText.length, exactIndex + excerpt.length);
    return {
      page_number: args.pageNumber,
      line_start: lineNumberAt(args.pageText, exactIndex),
      line_end: lineNumberAt(args.pageText, end),
      character_start: exactIndex,
      character_end: end,
      excerpt,
    };
  }

  const normalizedPage = normalizeLookup(args.pageText);
  const normalizedNeedle = normalizeLookup(excerpt).slice(0, 120);
  const fuzzyIndex = normalizedNeedle ? normalizedPage.indexOf(normalizedNeedle) : -1;
  if (fuzzyIndex >= 0) {
    return {
      page_number: args.pageNumber,
      line_start: null,
      line_end: null,
      character_start: fuzzyIndex,
      character_end: fuzzyIndex + normalizedNeedle.length,
      excerpt,
    };
  }

  return {
    page_number: args.pageNumber,
    line_start: null,
    line_end: null,
    character_start: null,
    character_end: null,
    excerpt,
  };
}

export function firstSourceSpan(value: unknown): SourceSpan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const spans = record.source_spans;
  if (!Array.isArray(spans)) return null;
  const first = spans[0];
  if (!first || typeof first !== "object") return null;
  return first as SourceSpan;
}
