export const resultSortValues = ["relevance", "alpha"] as const;

export type ResultSortValue = (typeof resultSortValues)[number];

const titleCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export function readResultSort(value: string | null | undefined): ResultSortValue {
  return value === "alpha" ? "alpha" : "relevance";
}

export function sortResultItems<T>(items: readonly T[], sort: ResultSortValue, getTitle: (item: T) => string): T[] {
  if (sort === "relevance") return [...items];
  return [...items].sort((left, right) => titleCollator.compare(getTitle(left), getTitle(right)));
}

export function resultSortHref(pathname: string, currentSearchParams: { toString(): string }, sort: ResultSortValue) {
  const params = new URLSearchParams(currentSearchParams.toString());
  if (sort === "relevance") params.delete("sort");
  else params.set("sort", sort);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
