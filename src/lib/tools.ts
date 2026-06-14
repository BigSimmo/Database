export type ToolTarget = "external" | "internal";

export type ToolStatus = "online" | "beta" | "offline" | "coming-soon";

export type ToolCategory = "Clinical" | "Operations" | "Docs" | "Research" | "Admin";

export type ToolIconName =
  | "Search"
  | "FileImage"
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

export const toolCatalog: ToolItem[] = [
  {
    id: "kb-quick-search",
    title: "KB Quick Search",
    description: "Search indexed guidance and case-level references before launching deeper workflows.",
    href: "https://pubmed.ncbi.nlm.nih.gov/",
    icon: "Search",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "ocr-workbench",
    title: "OCR Workbench",
    description: "Run scan review and text extraction checks on guideline images and PDFs.",
    href: "https://www.ilovepdf.com/ocr",
    icon: "FileImage",
    category: "Research",
    target: "external",
    status: "beta",
    openInNewTab: true,
  },
  {
    id: "doc-indexer",
    title: "Doc Indexer",
    description: "Open indexing tools and queue management for document workflows.",
    href: "https://www.filewatcher.io/",
    icon: "UploadCloud",
    category: "Operations",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "policy-hub",
    title: "Policy Hub",
    description: "Access protocol libraries, SOP updates, and policy snapshots.",
    href: "https://www.hhs.gov/",
    icon: "BookOpen",
    category: "Docs",
    target: "external",
    status: "beta",
    openInNewTab: true,
  },
  {
    id: "evidence-qa",
    title: "Evidence QA",
    description: "Validate evidence claims with confidence checks and citation crosswalks.",
    href: "https://cochrane.org/",
    icon: "Quote",
    category: "Research",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "safety-scan",
    title: "Safety Scan",
    description: "Run adverse-event-style safety checks against current guidance and flags.",
    href: "https://www.who.int/",
    icon: "ShieldAlert",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "analytics-console",
    title: "Analytics Console",
    description: "Monitor usage, trends, and response quality across launches and sources.",
    href: "https://analytics.google.com/",
    icon: "Target",
    category: "Admin",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "task-templates",
    title: "Task Templates",
    description: "Start structured execution packs and task blueprints for recurring workflows.",
    href: "https://www.notion.so/",
    icon: "ClipboardCheck",
    category: "Docs",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "ingestion-watch",
    title: "Ingestion Watch",
    description: "Track live indexing jobs, worker heartbeats, and retry queues.",
    href: "https://www.atlassian.com/software/jira",
    icon: "ListChecks",
    category: "Operations",
    target: "external",
    status: "offline",
    openInNewTab: true,
    disabledHint: "Service bus currently unavailable.",
  },
  {
    id: "chat-agent",
    title: "Chat Agent",
    description: "Launch quick AI-assisted drafting and summarization workflow.",
    href: "https://chatgpt.com/",
    icon: "Sparkles",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "citation-exporter",
    title: "Citation Exporter",
    description: "Build formatted citation bundles for handover packets and meetings.",
    href: "https://www.elsevier.com/",
    icon: "ExternalLink",
    category: "Research",
    target: "external",
    status: "coming-soon",
    openInNewTab: true,
  },
];

export const defaultFavoriteToolIds = ["kb-quick-search", "safety-scan", "analytics-console"];

export const quickLaunchSeedToolIds = ["kb-quick-search", "ingestion-watch", "analytics-console"];
