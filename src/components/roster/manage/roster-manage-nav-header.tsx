"use client";
import { CalendarRange, CheckCheck, Users } from "lucide-react";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";

const sections: readonly PageSection[] = [
  { id: "approve", label: "Approve", icon: CheckCheck, weight: 1 },
  { id: "cover", label: "Cover", icon: Users, weight: 1 },
  { id: "roster", label: "Roster", icon: CalendarRange, weight: 1 },
];
export function RosterManageNavHeader({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  return (
    <InPageNavHeader
      title="Manage"
      titleAs="h1"
      back={{ href: "/roster", label: "Roster" }}
      sections={sections}
      activeId={activeId}
      onSelectSection={onSelect}
      testIdPrefix="roster-manage"
    />
  );
}
