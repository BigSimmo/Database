"use client";
import { CalendarRange, CheckCheck, Users } from "lucide-react";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";

const sections: readonly PageSection[] = [
  { id: "approve", label: "Approve", icon: CheckCheck, weight: 1 },
  { id: "cover", label: "Cover", icon: Users, weight: 1 },
  { id: "roster", label: "Roster", icon: CalendarRange, weight: 1 },
];
// The header title stays a <span> (its default): the page header above it
// carries the page's one <h1>. InPageNavHeader has no subtitle slot, so the
// team's name is shown in that page header instead.
export function RosterManageNavHeader({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  return (
    <InPageNavHeader
      title="Manage"
      back={{ href: "/roster", label: "Roster" }}
      sections={sections}
      activeId={activeId}
      onSelectSection={onSelect}
      testIdPrefix="roster-manage"
    />
  );
}
