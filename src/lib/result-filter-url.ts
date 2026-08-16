type ReadableSearchParams = Pick<URLSearchParams, "get">;

function normalizeValues(values: Iterable<string>, allowedValues: ReadonlySet<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()))]
    .filter((value) => value.length > 0 && allowedValues.has(value))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Read a deterministic comma-separated catalogue facet. Unknown values are
 * ignored so stale links cannot create invisible filters.
 */
export function readResultFilterValues<Value extends string>(
  params: ReadableSearchParams,
  key: string,
  allowedValues: ReadonlySet<Value>,
): Value[] {
  const raw = params.get(key);
  if (!raw) return [];
  return normalizeValues(raw.split(","), allowedValues) as Value[];
}

/** Write sorted values, omitting the parameter when no refinement remains. */
export function writeResultFilterValues<Value extends string>(
  params: URLSearchParams,
  key: string,
  values: Iterable<Value>,
  allowedValues: ReadonlySet<Value>,
): void {
  const normalized = normalizeValues(values, allowedValues);
  if (normalized.length === 0) params.delete(key);
  else params.set(key, normalized.join(","));
}

/** Read a one-of-N value, falling back when the URL is absent or invalid. */
export function readResultFilterValue<Value extends string>(
  params: ReadableSearchParams,
  key: string,
  allowedValues: ReadonlySet<Value>,
  fallback: Value,
): Value {
  const value = params.get(key);
  return value && allowedValues.has(value as Value) ? (value as Value) : fallback;
}

/** Write a one-of-N value and omit its default. */
export function writeResultFilterValue<Value extends string>(
  params: URLSearchParams,
  key: string,
  value: Value,
  fallback: Value,
  allowedValues: ReadonlySet<Value>,
): void {
  if (value === fallback || !allowedValues.has(value)) params.delete(key);
  else params.set(key, value);
}

/**
 * Replace only filter-owned parameters while preserving the route, hash, query,
 * comparison ids, focus intent and every unrelated navigation parameter.
 */
export function replaceResultFilterUrl(mutator: (params: URLSearchParams) => void): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  mutator(params);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}
