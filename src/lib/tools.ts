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

export const toolCatalog: ToolItem[] = [
  {
    id: "formulation",
    title: "Formulation",
    description:
      "Build concise biopsychosocial formulations that connect presenting problems, maintaining factors, risk, and treatment direction.",
    href: "http://localhost:53210",
    icon: "Brain",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "forms",
    title: "Forms",
    description:
      "Open structured clinical form workflows for capture, review, validation, and repeatable patient-facing documentation.",
    href: "http://localhost:5173",
    icon: "ClipboardList",
    category: "Operations",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "therapy",
    title: "Therapy",
    description:
      "Navigate therapy planning, intervention selection, session structure, and patient-centred psychological treatment pathways.",
    href: "http://localhost:53211",
    icon: "HeartHandshake",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "specifiers",
    title: "Specifiers",
    description:
      "Refine diagnostic pictures with specifiers, severity cues, course descriptors, and structured clinical qualification.",
    href: "http://127.0.0.1:58123",
    icon: "ListChecks",
    category: "Docs",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "dsm-5-diagnoses",
    title: "DSM-5 Diagnoses",
    description:
      "Launch diagnostic criteria, differential anchors, symptom clusters, and structured DSM-5 review support.",
    href: "http://127.0.0.1:53173",
    icon: "BookOpen",
    category: "Research",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "medications",
    title: "Medications",
    description:
      "Open the clinical drug guide for prescribing context, monitoring, safety checks, and medication-specific review.",
    href: "http://127.0.0.1:8081",
    icon: "Pill",
    category: "Clinical",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "services",
    title: "Services",
    description:
      "Navigate psychiatry service pathways, referral destinations, access points, and practical service-matching decisions.",
    href: "http://127.0.0.1:53174",
    icon: "Network",
    category: "Operations",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "differentials",
    title: "Differentials",
    description:
      "Compare psychiatric differentials, rule-outs, red flags, and competing diagnostic explanations in one focused workspace.",
    href: "http://127.0.0.1:53375",
    icon: "Search",
    category: "Research",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
  {
    id: "psychiatry-notes",
    title: "Psychiatry Notes",
    description:
      "Open the Psychiatry Application for clinical note workflows, patient summaries, documentation, and review-ready outputs.",
    href: "http://localhost:4391",
    icon: "FileText",
    category: "Admin",
    target: "external",
    status: "online",
    openInNewTab: true,
  },
];

export const defaultFavoriteToolIds = ["formulation", "dsm-5-diagnoses", "psychiatry-notes"];

export const quickLaunchSeedToolIds = ["formulation", "differentials", "medications"];
