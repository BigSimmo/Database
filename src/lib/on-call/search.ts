import { rankCatalogRecords } from "@/lib/catalog-search";
import { onCallDetailsSchemaFor, type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * How far the on-call search's own result count can be trusted.
 *
 * A subset of `SearchResultsBandStatus` (`search-results-header-band.tsx`) —
 * this mode has no background refresh and no partial-source degradation, only
 * a one-shot fetch on mount that falls back to whatever is cached on this
 * device. Defined independently rather than imported, the same way
 * `RegistryRequestStatus` (`use-registry-records.ts`) stays its own type: the
 * band already accepts any status drawn from its own wider union, so a lib
 * module has no need to import a component's type to stay compatible with it.
 */
export type OnCallSearchStatus = "loading" | "ready" | "unauthorized" | "error";

/**
 * Derives the band status from `useOnCallEntries()`'s own state.
 *
 * The one case that matters: offline with nothing cached to search over.
 * That is not "zero matches" — the search never had anything to run against
 * — so it must render as `error`, which is the status the band never lets
 * assert a count. Offline WITH a cache is still `ready`: there is a real,
 * searchable (if possibly stale) set of entries, and `OnCallOfflineBanner`
 * carries the staleness separately.
 */
export function onCallSearchStatus({
  loading,
  isOffline,
  signedOut,
  entryCount,
}: {
  loading: boolean;
  isOffline: boolean;
  signedOut: boolean;
  entryCount: number;
}): OnCallSearchStatus {
  if (loading) return "loading";
  if (signedOut) return "unauthorized";
  if (isOffline && entryCount === 0) return "error";
  return "ready";
}

export type OnCallSearchMatch = {
  entry: OnCallEntry;
  /** 0 for the unsubmitted, browse-all state — every entry, in its existing order. */
  score: number;
};

interface ContactDetails {
  role: string;
  phone?: string;
  extension?: string;
  afterHoursPhone?: string;
  pager?: string;
  contactName?: string;
  availability?: string;
}

interface PlaybookDetails {
  trigger: string;
  escalationSteps: Array<{ order: number; whoToCall: string; when: string; phone?: string }>;
}

interface ReferralsDetails {
  accepts: string[];
  exclusions: string[];
  catchment?: string;
  hours?: string;
  howToRefer?: string;
  phone?: string;
  fax?: string;
}

interface EducationDetails {
  recurrence?: string;
  nextOccurrence?: string;
  presenter?: string;
  location?: string;
  topics: string[];
}

interface LogisticsDetails {
  category: string;
  location?: string;
  hours?: string;
  phone?: string;
}

function parseDetails<Details>(entry: OnCallEntry): Details | null {
  const result = onCallDetailsSchemaFor(entry.section).safeParse(entry.details);
  return result.success ? (result.data as Details) : null;
}

/** A short label:value pair shown on a search result row and, doubling as the
 *  section-specific search haystack below, what makes "clozapine" matching a
 *  clinic phone number and a haematology contact legible rather than a bare
 *  title. */
export type OnCallDetailChip = { label: string; value: string };

export function onCallEntryDetailChips(entry: OnCallEntry): OnCallDetailChip[] {
  switch (entry.section) {
    case "contacts": {
      const details = parseDetails<ContactDetails>(entry);
      if (!details) return [];
      const chips: OnCallDetailChip[] = [];
      if (details.phone) chips.push({ label: "Direct", value: details.phone });
      if (details.afterHoursPhone) chips.push({ label: "After hours", value: details.afterHoursPhone });
      if (details.pager) chips.push({ label: "Pager", value: details.pager });
      if (details.extension) chips.push({ label: "Ext", value: details.extension });
      if (chips.length === 0 && details.availability) chips.push({ label: "Available", value: details.availability });
      return chips;
    }
    case "playbook": {
      const details = parseDetails<PlaybookDetails>(entry);
      if (!details) return [];
      const chips: OnCallDetailChip[] = [{ label: "Trigger", value: details.trigger }];
      const first = details.escalationSteps[0];
      if (first) chips.push({ label: "First call", value: first.whoToCall });
      return chips;
    }
    case "referrals": {
      const details = parseDetails<ReferralsDetails>(entry);
      if (!details) return [];
      const chips: OnCallDetailChip[] = [];
      if (details.phone) chips.push({ label: "Phone", value: details.phone });
      if (details.hours) chips.push({ label: "Hours", value: details.hours });
      if (details.catchment) chips.push({ label: "Catchment", value: details.catchment });
      return chips;
    }
    case "orientation":
      return [];
    case "education": {
      const details = parseDetails<EducationDetails>(entry);
      if (!details) return [];
      const chips: OnCallDetailChip[] = [];
      if (details.presenter) chips.push({ label: "Presenter", value: details.presenter });
      if (details.nextOccurrence) chips.push({ label: "Next", value: details.nextOccurrence });
      if (details.location) chips.push({ label: "Location", value: details.location });
      return chips;
    }
    case "logistics": {
      const details = parseDetails<LogisticsDetails>(entry);
      if (!details) return [];
      const chips: OnCallDetailChip[] = [{ label: "Category", value: details.category }];
      if (details.location) chips.push({ label: "Location", value: details.location });
      if (details.phone) chips.push({ label: "Phone", value: details.phone });
      if (details.hours) chips.push({ label: "Hours", value: details.hours });
      return chips;
    }
    default:
      return [];
  }
}

/** Every section-specific detail field, flattened to one searchable string —
 *  a role, a phone number, a presenter, a category, and more besides what the
 *  chips above choose to display. */
function onCallEntryDetailSearchText(entry: OnCallEntry): string {
  switch (entry.section) {
    case "contacts": {
      const details = parseDetails<ContactDetails>(entry);
      if (!details) return "";
      return [
        details.role,
        details.phone,
        details.extension,
        details.afterHoursPhone,
        details.pager,
        details.contactName,
        details.availability,
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "playbook": {
      const details = parseDetails<PlaybookDetails>(entry);
      if (!details) return "";
      return [
        details.trigger,
        ...details.escalationSteps.flatMap((step) => [step.whoToCall, step.when, step.phone].filter(Boolean)),
      ].join(" ");
    }
    case "referrals": {
      const details = parseDetails<ReferralsDetails>(entry);
      if (!details) return "";
      return [
        ...details.accepts,
        ...details.exclusions,
        details.catchment,
        details.hours,
        details.howToRefer,
        details.phone,
        details.fax,
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "orientation":
      return "";
    case "education": {
      const details = parseDetails<EducationDetails>(entry);
      if (!details) return "";
      return [details.recurrence, details.nextOccurrence, details.presenter, details.location, ...details.topics]
        .filter(Boolean)
        .join(" ");
    }
    case "logistics": {
      const details = parseDetails<LogisticsDetails>(entry);
      if (!details) return "";
      return [details.category, details.location, details.hours, details.phone].filter(Boolean).join(" ");
    }
    default:
      return "";
  }
}

/**
 * Ranks the entry set already in the browser against one query, matching
 * title, subtitle, body, tags and every section-specific detail field —
 * offline, with no server search endpoint. An empty (or whitespace-only)
 * query is the browse-all state: every entry comes back, unranked, in its
 * existing order, so the caller's own sort control decides how it reads.
 */
export function rankOnCallEntries(entries: readonly OnCallEntry[], query: string): OnCallSearchMatch[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return entries.map((entry) => ({ entry, score: 0 }));
  }

  const ranked = rankCatalogRecords([...entries], trimmedQuery, {
    fields: [
      { id: "title", weight: 10, text: (entry) => entry.title },
      { id: "subtitle", weight: 5, text: (entry) => entry.subtitle ?? "" },
      { id: "tags", weight: 6, text: (entry) => entry.tags.join(" ") },
      { id: "detail", weight: 8, text: onCallEntryDetailSearchText },
    ],
    fullText: (entry) =>
      [entry.title, entry.subtitle ?? "", entry.body ?? "", entry.tags.join(" "), onCallEntryDetailSearchText(entry)]
        .filter(Boolean)
        .join(" "),
    contentWeight: 2,
    phraseBonus: 4,
    exactBonus: 10,
  });

  return ranked.map(({ record, score }) => ({ entry: record, score }));
}
