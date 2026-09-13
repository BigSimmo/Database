import { AlertTriangle, FileText, MapPin, Phone, Shield, Users, type LucideIcon } from "lucide-react";

import { onCallGroupAnchorId, onCallGroupSlug } from "@/components/on-call/on-call-page-anchors";
import type { OnCallPageView } from "@/components/on-call/on-call-section-identity";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";
import { isRoleExplainerEntry, partitionContactsEntries } from "@/lib/on-call/who-is-who";

/**
 * The groups on an On Call page, for the in-page header's jump list.
 *
 * The mode's second row used to list the nine SECTIONS — which the mode pill
 * already opens, so two controls did one job while nothing helped a reader move
 * around the page in front of them. Contacts alone runs to six groups and
 * several screens. This is what that row lists instead.
 *
 * These are declarations, not the rendered truth: `useResolvedPageSections`
 * drops any whose anchor is not on the page, so a page with one group (or none)
 * simply shows a title and no disclosure. That is why the flat sections —
 * Referrals, Orientation, Teaching — need no entry here and lose nothing.
 */

/** A group heading a list component renders, and what it holds. */
type Group = { slug: string; label: string; count: number; icon: LucideIcon };

function toSection(group: Group): PageSection {
  return {
    id: onCallGroupAnchorId(group.slug),
    label: group.label,
    icon: group.icon,
    count: group.count,
    detail: `${group.count}`,
  };
}

/** Contacts: overdue first, then one group per area — the page's own order. */
function contactGroups(entries: readonly OnCallEntry[], now: Date): Group[] {
  const { contacts } = partitionContactsEntries(entries);
  const groups: Group[] = [];
  const stale = contacts.filter((entry) => onCallEntryFreshness(entry, now).state === "stale");
  if (stale.length > 0) {
    groups.push({ slug: "needs-checking", label: "Needs checking", count: stale.length, icon: AlertTriangle });
  }

  const byArea = new Map<string, number>();
  for (const entry of contacts) {
    if (onCallEntryFreshness(entry, now).state === "stale") continue;
    // The same rule the page groups by: the first tag that is an area rather
    // than one of the home's control tags.
    const area = contactAreaLabel(entry);
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  for (const [area, count] of [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    groups.push({ slug: onCallGroupSlug(area), label: area, count, icon: Phone });
  }
  return groups;
}

/**
 * Duplicated deliberately narrowly: the contacts list owns the rendering rule
 * and this owns the declaration, and the pair is pinned by a DOM test that
 * asserts every declared anchor exists on the rendered page. Importing the list
 * component here would make the header depend on the body it sits above.
 */
const RESERVED = ["call-first", "switchboard", "ward", "pinned"];
function contactAreaLabel(entry: OnCallEntry): string {
  const area = entry.tags
    .map((tag) => tag.trim())
    .find((tag) => tag.length > 0 && !RESERVED.includes(tag.toLowerCase()));
  return area ?? "General";
}

/** Logistics: one group per `details.category`. */
function logisticsGroups(entries: readonly OnCallEntry[]): Group[] {
  const byCategory = new Map<string, number>();
  for (const entry of entries.filter((candidate) => candidate.section === "logistics")) {
    const category = (entry.details as { category?: string }).category?.trim() || "Other";
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  }
  return [...byCategory.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ slug: onCallGroupSlug(label), label, count, icon: MapPin }));
}

/** Playbook: the scenarios, then the ones with nothing linked. */
function playbookGroups(entries: readonly OnCallEntry[], linkedIds: ReadonlySet<string>): Group[] {
  const playbook = entries.filter((entry) => entry.section === "playbook");
  const linked = playbook.filter((entry) => entry.linkedDocumentIds.some((id) => linkedIds.has(id)));
  const unlinked = playbook.filter((entry) => !entry.linkedDocumentIds.some((id) => linkedIds.has(id)));
  const groups: Group[] = [];
  if (linked.length > 0) {
    groups.push({ slug: "scenarios", label: "Scenarios", count: linked.length, icon: Shield });
  }
  if (unlinked.length > 0) {
    groups.push({
      slug: "no-guideline",
      label: "No guideline linked yet",
      count: unlinked.length,
      icon: FileText,
    });
  }
  return groups;
}

/** Who's who: one group per area, the same shape Contacts uses. */
function whoIsWhoGroups(entries: readonly OnCallEntry[]): Group[] {
  const byArea = new Map<string, number>();
  for (const entry of entries.filter(isRoleExplainerEntry)) {
    const area = contactAreaLabel(entry);
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  return [...byArea.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ slug: onCallGroupSlug(label), label, count, icon: Users }));
}

export function onCallPageSections({
  view,
  entries,
  now = new Date(),
  linkedDocumentIds = new Set<string>(),
}: {
  view: OnCallPageView;
  entries: readonly OnCallEntry[];
  now?: Date;
  linkedDocumentIds?: ReadonlySet<string>;
}): PageSection[] {
  switch (view) {
    case "contacts":
      return contactGroups(entries, now).map(toSection);
    case "logistics":
      return logisticsGroups(entries).map(toSection);
    case "playbook":
      return playbookGroups(entries, linkedDocumentIds).map(toSection);
    case "who-is-who":
      return whoIsWhoGroups(entries).map(toSection);
    // Flat lists. A jump list of one row is furniture, and the header drops
    // straight back to being a title.
    case "referrals":
    case "orientation":
    case "education":
      return [];
  }
}
