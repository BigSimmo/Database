"use client";

import { BookOpen, GraduationCap, ListChecks, MapPinned, Phone, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";
import { type OnCallSection } from "@/lib/on-call/entry-model";

/**
 * Display title per section. `education` is titled "Teaching" everywhere a
 * reader sees it — the mode-nav label, this header, and the page's own
 * heading — even though the underlying section id (route segment, database
 * check constraint, `OnCallSection` value) stays `education`. Only the label
 * changed; renaming the id would be a migration for no functional gain.
 */
export const ON_CALL_SECTION_TITLES: Record<OnCallSection, string> = {
  contacts: "Contacts",
  playbook: "Playbook",
  referrals: "Referrals",
  orientation: "Orientation",
  education: "Teaching",
  logistics: "Logistics",
};

export const ON_CALL_SECTION_ICONS: Record<OnCallSection, LucideIcon> = {
  contacts: Phone,
  playbook: ListChecks,
  referrals: Repeat,
  orientation: BookOpen,
  education: GraduationCap,
  logistics: MapPinned,
};

/**
 * Every section page declares the same two-anchor shape today: a generic
 * overview (always rendered, signed in or out) and the entries list (rendered
 * either way, its content depending on sign-in). Both anchors are always
 * present, so nothing here is conditional the way `specifierNavSections` is —
 * a later task that adds real per-entry grouping is free to grow this per
 * section without touching the header contract.
 */
export function onCallSectionNavSections(section: OnCallSection): readonly PageSection[] {
  const icon = ON_CALL_SECTION_ICONS[section];
  return [
    { id: `on-call-${section}-overview`, label: "Overview", icon },
    { id: `on-call-${section}-entries`, label: ON_CALL_SECTION_TITLES[section], icon },
  ];
}

/**
 * The client half of every on-call section page, which stays a Server-
 * Component-friendly module otherwise: sections carry `LucideIcon` values and
 * the header needs hooks, neither of which crosses the RSC boundary.
 *
 * `back` always targets the mode's search surface, not the bare `/on-call`
 * redirect stub — the same choice `SpecifierNavHeader` makes, and for the same
 * reason: the redirect stub renders nothing to land on.
 */
export function OnCallNavHeader({ section }: { section: OnCallSection }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(onCallSectionNavSections(section));

  return (
    <InPageNavHeader
      back={{ href: consolidatedModeSearchPath("on-call"), label: "On Call" }}
      title={ON_CALL_SECTION_TITLES[section]}
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      testIdPrefix={`on-call-${section}`}
    />
  );
}
