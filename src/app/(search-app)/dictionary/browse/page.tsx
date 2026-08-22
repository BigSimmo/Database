import { redirect } from "next/navigation";

/**
 * Browse and Search were one catalogue behind two destinations.
 *
 * They listed the same entries as the same rows from the same data, so a reader
 * who typed a term while on Browse had to change tab to see it. `/dictionary/search`
 * is now the whole catalogue — empty query shows everything, a typed query
 * narrows the same list — and this route survives so bookmarks, the retired
 * `?view=abbreviations` deep link and any external link keep working.
 *
 * `view`, `letter`, `topic` and `kind` all mean the same thing on the surviving
 * route, so the query string is carried across rather than dropped. `view=az`
 * is the one value that does not survive: it was Browse's own spelling of the
 * definitions scope, which `parseDictionaryCatalogueParams` reaches by default.
 */
type DictionaryBrowseRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DictionaryBrowseRoute({ searchParams }: DictionaryBrowseRouteProps) {
  const params = searchParams ? await searchParams : {};
  const forwarded = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view" && value === "az") continue;
    for (const entry of Array.isArray(value) ? value : value == null ? [] : [value]) {
      forwarded.append(key, entry);
    }
  }
  const suffix = forwarded.toString();
  redirect(`/dictionary/search${suffix ? `?${suffix}` : ""}`);
}
