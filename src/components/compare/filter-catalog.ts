import type { CompareCatalogItem } from "@/components/compare/types";

export function filterCompareCatalog(items: readonly CompareCatalogItem[], query: string): CompareCatalogItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) => {
    const haystack = [item.id, item.title, item.snippet, item.tag]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function assignCompareId(
  selectedIds: readonly (string | null | undefined)[],
  slotIndex: number,
  nextId: string,
): Array<string | null> {
  return selectedIds.map((id, index) => {
    if (index === slotIndex) return nextId;
    return id === nextId ? null : (id ?? null);
  });
}

export function firstEmptySlot(selectedIds: readonly (string | null | undefined)[]): number | null {
  const empty = selectedIds.findIndex((id) => !id);
  return empty >= 0 ? empty : null;
}

export function slotLetters(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
}

export function pairCompareHref(basePath: string, a?: string | null, b?: string | null): string {
  const params = new URLSearchParams();
  if (a) params.set("a", a);
  if (b && b !== a) params.set("b", b);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function parseCompareIds(value: string | null | undefined, maxCount: number): Array<string | null> {
  const seen = new Set<string>();
  const parsed = (value ?? "").split(",").map((part) => {
    const trimmed = part.trim();
    if (!trimmed) return null;
    let decoded = trimmed;
    try {
      decoded = decodeURIComponent(trimmed);
    } catch {
      decoded = trimmed;
    }
    const id = decoded.trim();
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  return padCompareIds(parsed, maxCount);
}

export function idsCompareHref(
  basePath: string,
  ids: readonly (string | null | undefined)[],
  extra?: Record<string, string | undefined>,
): string {
  const extraQuery = extra
    ? new URLSearchParams(
        Object.fromEntries(Object.entries(extra).filter((entry): entry is [string, string] => Boolean(entry[1]))),
      ).toString()
    : "";
  const seen = new Set<string>();
  const encoded = ids.map((id) => {
    const trimmed = id?.trim() ?? "";
    if (!trimmed || seen.has(trimmed)) return "";
    seen.add(trimmed);
    return encodeURIComponent(trimmed);
  });
  while (encoded.length > 0 && encoded[encoded.length - 1] === "") encoded.pop();
  const idsQuery = encoded.some(Boolean) ? `ids=${encoded.join(",")}` : "";
  const query = [extraQuery, idsQuery].filter(Boolean).join("&");
  return query ? `${basePath}?${query}` : basePath;
}

export function padCompareIds(
  selectedIds: readonly (string | null | undefined)[],
  maxCount: number,
): Array<string | null> {
  return Array.from({ length: maxCount }, (_, index) => selectedIds[index] ?? null);
}
