export type ToolTarget = "external" | "internal";

export type ToolStatus = "online" | "beta" | "offline" | "coming-soon";

export type ToolCategory = "Clinical" | "Operations" | "Docs" | "Research" | "Admin";

export type ToolIconName =
  | "Brain"
  | "ClipboardList"
  | "Search"
  | "FileImage"
  | "FileText"
  | "HeartHandshake"
  | "Network"
  | "Pill"
  | "UploadCloud"
  | "BookOpen"
  | "Quote"
  | "ShieldAlert"
  | "Target"
  | "ClipboardCheck"
  | "ListChecks"
  | "Sparkles"
  | "Clipboard"
  | "ExternalLink";

export type ToolItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ToolIconName;
  category: ToolCategory;
  target: ToolTarget;
  status: ToolStatus;
  openInNewTab?: boolean;
  favorite?: boolean;
  disabledHint?: string;
};

// In-app clinical workflows only. External companion apps (formulation, DSM-5,
// differentials, etc.) previously pointed at hardcoded localhost ports that were
// dead outside a single dev machine, so they have been removed. Every entry here
// resolves to a working internal route.
export const toolCatalog: ToolItem[] = [
  {
    id: "clinical-answer",
    title: "Clinical Answer",
    description:
      "Ask a source-backed clinical question and get a cited synthesis drawn from the indexed guideline library.",
    href: "/?mode=answer",
    icon: "Sparkles",
    category: "Clinical",
    target: "internal",
    status: "online",
  },
  {
    id: "documents",
    title: "Documents",
    description:
      "Search indexed PDFs, guidelines, policies, and source documents, then open them with provenance intact.",
    href: "/?mode=documents",
    icon: "FileText",
    category: "Docs",
    target: "internal",
    status: "online",
  },
  {
    id: "medications",
    title: "Medications",
    description:
      "Open prescribing context, monitoring, safety checks, and medication-specific review without leaving the dashboard.",
    href: "/?mode=prescribing",
    icon: "Pill",
    category: "Clinical",
    target: "internal",
    status: "online",
  },
  {
    id: "applications",
    title: "Applications",
    description: "Browse the full clinical applications launcher and the connected in-app workflows in one place.",
    href: "/applications",
    icon: "ListChecks",
    category: "Operations",
    target: "internal",
    status: "online",
  },
];

export const defaultFavoriteToolIds = ["clinical-answer", "documents", "medications"];

export const quickLaunchSeedToolIds = ["clinical-answer", "documents", "medications"];
