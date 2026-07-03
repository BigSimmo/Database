import { Brain, ClipboardList, FileCheck2, FileText, Pill, Search, Star, type LucideIcon } from "lucide-react";

export type ToolStatus = "ready" | "review_due" | "recent";
export type ToolArea = "reference" | "assessment" | "care" | "coordination" | "personal";

export type ToolFixture = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  area: ToolArea;
  sourceBacked: boolean;
  status: ToolStatus;
  lastUsed: string;
  primaryAction: string;
  secondary: string;
};

export const tools: ToolFixture[] = [
  {
    id: "clinical-kb-search",
    title: "Clinical KB Search",
    description: "Ask source-backed clinical questions and move straight to evidence.",
    href: "/?mode=answer",
    icon: Search,
    area: "reference",
    sourceBacked: true,
    status: "ready",
    lastUsed: "Today, 7:30 AM",
    primaryAction: "Ask",
    secondary: "Guidance, answers, source checks",
  },
  {
    id: "documents",
    title: "Documents",
    description: "Search indexed PDFs, policies, guidelines, pages, tables, and images.",
    href: "/?mode=documents",
    icon: FileText,
    area: "reference",
    sourceBacked: true,
    status: "ready",
    lastUsed: "May 10, 2025",
    primaryAction: "Search",
    secondary: "Library, source PDF, index health",
  },
  {
    id: "differentials",
    title: "Differentials",
    description: "Build and compare diagnostic possibilities with source-aware prompts.",
    href: "/differentials",
    icon: Brain,
    area: "assessment",
    sourceBacked: true,
    status: "recent",
    lastUsed: "Today, 8:40 AM",
    primaryAction: "Compare",
    secondary: "Assessment, risks, presentation view",
  },
  {
    id: "medication-prescribing",
    title: "Medication Prescribing",
    description: "Review prescribing context, monitoring, interactions, and cautions.",
    href: "/?mode=prescribing",
    icon: Pill,
    area: "care",
    sourceBacked: true,
    status: "review_due",
    lastUsed: "May 12, 2025",
    primaryAction: "Prescribe",
    secondary: "Monitoring, interactions, templates",
  },
  {
    id: "services",
    title: "Services",
    description: "Open source-backed service records, referral routes, and eligibility.",
    href: "/services",
    icon: ClipboardList,
    area: "coordination",
    sourceBacked: true,
    status: "review_due",
    lastUsed: "Today, 8:15 AM",
    primaryAction: "Refer",
    secondary: "Access pathways, criteria, contacts",
  },
  {
    id: "forms",
    title: "Forms",
    description: "Find clinical forms and source-backed readiness pathways.",
    href: "/forms",
    icon: FileCheck2,
    area: "coordination",
    sourceBacked: true,
    status: "ready",
    lastUsed: "Today, 8:05 AM",
    primaryAction: "Open",
    secondary: "Forms, tasks, pathway checks",
  },
  {
    id: "favourites",
    title: "Favourites",
    description: "Return to saved clinical work, sources, and repeated workflows.",
    href: "/favourites",
    icon: Star,
    area: "personal",
    sourceBacked: false,
    status: "recent",
    lastUsed: "Today, 8:45 AM",
    primaryAction: "Resume",
    secondary: "Saved items, recent work, pins",
  },
];

export const pinnedToolIds = ["clinical-kb-search", "documents", "medication-prescribing", "services"] as const;

export const areaLabels: Record<ToolArea, string> = {
  assessment: "Assess",
  care: "Treat",
  coordination: "Coordinate",
  personal: "Saved",
  reference: "Reference",
};

export const statusLabels: Record<ToolStatus, string> = {
  ready: "Ready",
  recent: "Recent",
  review_due: "Review due",
};

export const statusStyles: Record<ToolStatus, string> = {
  ready: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  recent: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  review_due: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
};

export function toolById(id: string) {
  return tools.find((tool) => tool.id === id) ?? tools[0];
}
