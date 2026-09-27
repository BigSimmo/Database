import { adminPlacementForEntry, isAdminJobContact, isAdminWorkforceExplainer } from "@/lib/admin/placement";
import type { AdminSupportItem } from "@/lib/admin/statewide-support";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

export type AdminHelpTab = "support" | "guides" | "contacts" | "on-site";

export type AdminHelpItem = {
  key: string;
  tab: AdminHelpTab;
  title: string;
  detail: string | null;
  phone: string | null;
  url: string | null;
  updatedOn: string | null;
  source: "you" | "shared" | "statewide";
  entry?: OnCallEntry;
  searchText: string;
};

type EntrySource = "you" | "shared";

function detailString(entry: OnCallEntry, key: "category" | "phone" | "url"): string | null {
  const details = entry.details;
  const value = typeof details === "object" && details !== null ? (details as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Builds one item from an `on_call_entries` row. `detail`, `phone` and `url`
 * come straight from the stored row (spec: "no field is guessed"); `updatedOn`
 * is the row's `lastVerifiedAt` — the only date it carries until On Call's
 * `published_at` lands (see open risk 4) — and is never used to drop an item.
 */
function itemFromEntry(entry: OnCallEntry, tab: AdminHelpTab, source: EntrySource): AdminHelpItem {
  const detail = entry.subtitle ?? entry.body;
  const phone = detailString(entry, "phone");
  const url = detailString(entry, "url");
  const category = detailString(entry, "category");
  return {
    key: `entry-${entry.id}`,
    tab,
    title: entry.title,
    detail,
    phone,
    url,
    updatedOn: entry.lastVerifiedAt,
    source,
    entry,
    searchText: [entry.title, detail, category, phone].filter(Boolean).join(" "),
  };
}

function itemFromSupport(item: AdminSupportItem): AdminHelpItem {
  return {
    key: `support-${item.id}`,
    tab: "support",
    title: item.name,
    detail: item.description,
    phone: item.telephoneDisplay,
    url: item.url,
    updatedOn: item.updatedOn,
    source: "statewide",
    searchText: [item.name, item.description, item.telephoneDisplay].filter(Boolean).join(" "),
  };
}

/**
 * Help's items (spec review 1 and 6): own and shared `logistics` rows placed by
 * `adminPlacementForEntry` ("guides" or "on-site"; "new-job" rows are skipped,
 * because New job renders them), own and shared workforce who's-who rows
 * ("contacts"), and the statewide list ("support"). No item is ever filtered
 * out for age.
 */
export function buildAdminHelpItems(input: {
  own: readonly OnCallEntry[];
  shared: readonly OnCallEntry[];
  statewide: readonly AdminSupportItem[];
}): AdminHelpItem[] {
  const items: AdminHelpItem[] = input.statewide.map(itemFromSupport);
  const rounds: [readonly OnCallEntry[], EntrySource][] = [
    [input.own, "you"],
    [input.shared, "shared"],
  ];
  for (const [entries, source] of rounds) {
    for (const entry of entries) {
      if (isAdminWorkforceExplainer(entry)) {
        items.push(itemFromEntry(entry, "contacts", source));
        continue;
      }
      const placement = adminPlacementForEntry(entry);
      if (placement === "guides" || placement === "on-site") items.push(itemFromEntry(entry, placement, source));
    }
  }
  return items;
}

/**
 * New job's rows: `logins` are own and shared entries `adminPlacementForEntry`
 * places at "new-job", tagged with their source; `contacts` reuses (not moves)
 * the workforce and payroll contact rows.
 */
export function selectNewJobRows(input: { own: readonly OnCallEntry[]; shared: readonly OnCallEntry[] }): {
  logins: { entry: OnCallEntry; source: EntrySource }[];
  contacts: OnCallEntry[];
} {
  const logins: { entry: OnCallEntry; source: EntrySource }[] = [];
  const rounds: [readonly OnCallEntry[], EntrySource][] = [
    [input.own, "you"],
    [input.shared, "shared"],
  ];
  for (const [entries, source] of rounds) {
    for (const entry of entries) {
      if (adminPlacementForEntry(entry) === "new-job") logins.push({ entry, source });
    }
  }
  return { logins, contacts: [...input.own, ...input.shared].filter(isAdminJobContact) };
}
