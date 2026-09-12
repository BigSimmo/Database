import { onCallDetailsSchemaFor, type OnCallEntry } from "@/lib/on-call/entry-model";

/**
 * The short label:value pairs that summarise one On Call entry.
 *
 * This was the display half of `src/lib/on-call/search.ts`, which the composer
 * removal deleted along with the mode's search surface: On Call declares no
 * search, so nothing was left to rank. The chips are not search machinery —
 * they are how a Recent row and a section tile say what an entry actually is
 * without repeating its title — so they outlived the ranking around them.
 */

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

/** A short label:value pair naming one fact about an entry — the number, the
 *  trigger, the presenter — so a compact row says what it is without repeating
 *  the title. */
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
  }
  // No `default`: `entry.section` is an exhaustive union, so a seventh section
  // becomes a compile error here rather than silently rendering no chips.
}
