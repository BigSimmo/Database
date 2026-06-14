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
    title: "Clinical Search Console",
    description: "Search trusted guidance, indexed extracts, and case-level references before moving into deeper review.",
    href: "https://pubmed.ncbi.nlm.nih.gov/",
    icon: "Search",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "ocr-workbench",
    title: "OCR Intake Bench",
    description: "Review scanned policies and image-heavy PDFs before they enter the searchable knowledge base.",
    href: "https://www.ilovepdf.com/ocr",
    icon: "FileImage",
    category: "Research",
    target: "external",
    status: "beta",
    openInNewTab: true,
  },
  {
    id: "doc-indexer",
    title: "Indexing Queue",
    description: "Open document ingestion, queue checks, and source readiness workflows from one launch point.",
    href: "https://www.filewatcher.io/",
    icon: "UploadCloud",
    category: "Operations",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "policy-hub",
    title: "Protocol Library",
    description: "Jump to policy collections, SOP updates, and reference snapshots used during clinical review.",
    href: "https://www.hhs.gov/",
    icon: "BookOpen",
    category: "Docs",
    target: "external",
    status: "beta",
    openInNewTab: true,
  },
  {
    id: "evidence-qa",
    title: "Evidence Crosscheck",
    description: "Validate claims against evidence libraries, confidence signals, and citation crosswalks.",
    href: "https://cochrane.org/",
    icon: "Quote",
    category: "Research",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "safety-scan",
    title: "Safety Flags",
    description: "Screen outputs and source notes for adverse-event style warnings, exclusions, and escalation cues.",
    href: "https://www.who.int/",
    icon: "ShieldAlert",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "analytics-console",
    title: "Quality Analytics",
    description: "Monitor usage patterns, retrieval quality, and operational trends across the knowledge base.",
    href: "https://analytics.google.com/",
    icon: "Target",
    category: "Admin",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "task-templates",
    title: "Handover Templates",
    description: "Start structured handover packs, meeting briefs, and repeatable review workflows.",
    href: "https://www.notion.so/",
    icon: "ClipboardCheck",
    category: "Docs",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "ingestion-watch",
    title: "Ingestion Monitor",
    description: "Track indexing jobs, worker heartbeats, retry queues, and stalled source processing.",
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
    title: "Clinical Drafting",
    description: "Launch AI-assisted drafting and summarization for clinical notes, briefs, and source digests.",
    href: "https://chatgpt.com/",
    icon: "Sparkles",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "citation-exporter",
    title: "Citation Packager",
    description: "Build citation bundles for governance handovers, meeting packs, and document review trails.",
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
