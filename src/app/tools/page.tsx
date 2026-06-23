import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  FileImage,
  FileText,
  HeartHandshake,
  LayoutList,
  ListChecks,
  Network,
  Pill,
  Quote,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui-primitives";
import { defaultFavoriteToolIds, type ToolCategory, type ToolIconName, type ToolItem, toolCatalog } from "@/lib/tools";

type ToneName = "primary" | "info" | "success" | "warning" | "danger";

type ToneTheme = {
  aura: string;
  border: string;
  button: string;
  glow: string;
  icon: string;
  rail: string;
  surface: string;
  text: string;
};

type ToolPresentation = {
  cadence: string;
  role: string;
  shortLabel: string;
  tone: ToneName;
};

const iconRegistry = {
  Brain,
  ClipboardList,
  Search,
  FileImage,
  FileText,
  HeartHandshake,
  Network,
  Pill,
  UploadCloud,
  BookOpen,
  ClipboardCheck,
  ListChecks,
  Sparkles,
  ShieldAlert,
  Quote,
  Target,
  ExternalLink,
  Clipboard: ClipboardCheck,
} satisfies Record<ToolIconName, LucideIcon>;

const toneTheme: Record<ToneName, ToneTheme> = {
  primary: {
    aura: "bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_18rem)]",
    border: "border-[color:color-mix(in_srgb,var(--primary)_28%,transparent)]",
    button: "bg-[color:var(--primary)] text-[color:var(--primary-contrast)] hover:bg-[color:var(--primary-strong)]",
    glow: "shadow-[0_18px_52px_color-mix(in_srgb,var(--primary)_14%,transparent)]",
    icon: "border-[color:color-mix(in_srgb,var(--primary)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--primary)_14%,transparent)] text-[color:var(--primary-100)]",
    rail: "bg-[color:var(--primary)]",
    surface:
      "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--app-shell-muted)_82%,transparent),color-mix(in_srgb,var(--app-shell)_96%,black))]",
    text: "text-[color:var(--primary-100)]",
  },
  info: {
    aura: "bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--info)_20%,transparent),transparent_18rem)]",
    border: "border-[color:color-mix(in_srgb,var(--info)_30%,transparent)]",
    button: "bg-[color:var(--info-soft)] text-[color:var(--app-shell)] hover:bg-white",
    glow: "shadow-[0_18px_52px_color-mix(in_srgb,var(--info)_14%,transparent)]",
    icon: "border-[color:color-mix(in_srgb,var(--info)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--info)_14%,transparent)] text-[color:var(--info-bg)]",
    rail: "bg-[color:var(--info)]",
    surface:
      "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--info)_16%,var(--app-shell-muted)),color-mix(in_srgb,var(--app-shell)_96%,black))]",
    text: "text-[color:var(--info-bg)]",
  },
  success: {
    aura: "bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--success)_20%,transparent),transparent_18rem)]",
    border: "border-[color:color-mix(in_srgb,var(--success)_30%,transparent)]",
    button: "bg-[color:var(--success-soft)] text-[color:var(--app-shell)] hover:bg-white",
    glow: "shadow-[0_18px_52px_color-mix(in_srgb,var(--success)_14%,transparent)]",
    icon: "border-[color:color-mix(in_srgb,var(--success)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_14%,transparent)] text-[color:var(--success-bg)]",
    rail: "bg-[color:var(--success)]",
    surface:
      "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--success)_16%,var(--app-shell-muted)),color-mix(in_srgb,var(--app-shell)_96%,black))]",
    text: "text-[color:var(--success-bg)]",
  },
  warning: {
    aura: "bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--warning)_20%,transparent),transparent_18rem)]",
    border: "border-[color:color-mix(in_srgb,var(--warning)_30%,transparent)]",
    button: "bg-[color:var(--warning-soft)] text-[color:var(--app-shell)] hover:bg-white",
    glow: "shadow-[0_18px_52px_color-mix(in_srgb,var(--warning)_14%,transparent)]",
    icon: "border-[color:color-mix(in_srgb,var(--warning)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--warning)_14%,transparent)] text-[color:var(--warning-bg)]",
    rail: "bg-[color:var(--warning)]",
    surface:
      "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--warning)_16%,var(--app-shell-muted)),color-mix(in_srgb,var(--app-shell)_96%,black))]",
    text: "text-[color:var(--warning-bg)]",
  },
  danger: {
    aura: "bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--danger)_20%,transparent),transparent_18rem)]",
    border: "border-[color:color-mix(in_srgb,var(--danger)_30%,transparent)]",
    button: "bg-[color:var(--danger-soft)] text-[color:var(--app-shell)] hover:bg-white",
    glow: "shadow-[0_18px_52px_color-mix(in_srgb,var(--danger)_14%,transparent)]",
    icon: "border-[color:color-mix(in_srgb,var(--danger)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_14%,transparent)] text-[color:var(--danger-bg)]",
    rail: "bg-[color:var(--danger)]",
    surface:
      "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--danger)_16%,var(--app-shell-muted)),color-mix(in_srgb,var(--app-shell)_96%,black))]",
    text: "text-[color:var(--danger-bg)]",
  },
};

const categoryTone: Record<ToolCategory, ToneName> = {
  Admin: "danger",
  Clinical: "primary",
  Docs: "info",
  Operations: "warning",
  Research: "success",
};

const toolPresentation: Record<string, ToolPresentation> = {
  differentials: {
    cadence: "Rule-outs",
    role: "Check likely rule-outs, red flags, and competing DSM-5 explanations.",
    shortLabel: "Diffs",
    tone: "success",
  },
  "dsm-5-diagnoses": {
    cadence: "DSM-5 criteria",
    role: "Open criteria, symptom clusters, and diagnostic anchors.",
    shortLabel: "DSM",
    tone: "success",
  },
  forms: {
    cadence: "Capture",
    role: "Start structured intake, review, and patient-facing form workflows.",
    shortLabel: "Forms",
    tone: "warning",
  },
  formulation: {
    cadence: "Case theory",
    role: "Build formulation from problems, risks, maintaining factors, and treatment direction.",
    shortLabel: "Form",
    tone: "primary",
  },
  medications: {
    cadence: "Prescribing",
    role: "Check prescribing context, monitoring, safety issues, and medication review.",
    shortLabel: "Meds",
    tone: "primary",
  },
  "psychiatry-notes": {
    cadence: "Output",
    role: "Open summaries, documentation flows, and review-ready note outputs.",
    shortLabel: "Notes",
    tone: "danger",
  },
  services: {
    cadence: "Pathways",
    role: "Find referral pathways, access points, and service-matching options.",
    shortLabel: "Svc",
    tone: "warning",
  },
  specifiers: {
    cadence: "Qualifiers",
    role: "Review severity, course, and specifier language for a diagnosis.",
    shortLabel: "Spec",
    tone: "info",
  },
  therapy: {
    cadence: "Treatment",
    role: "Open treatment planning, session structure, and intervention options.",
    shortLabel: "Tx",
    tone: "primary",
  },
};

const favoriteTools = defaultFavoriteToolIds
  .map((id) => toolCatalog.find((tool) => tool.id === id))
  .filter((tool): tool is ToolItem => Boolean(tool));

function isInactive(tool: ToolItem) {
  return tool.status === "offline" || tool.status === "coming-soon";
}

function getPresentation(tool: ToolItem) {
  return (
    toolPresentation[tool.id] ?? {
      cadence: tool.category,
      role: tool.description,
      shortLabel: tool.title,
      tone: categoryTone[tool.category],
    }
  );
}

function getLaunchContext(tool: ToolItem) {
  try {
    const url = new URL(tool.href);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return tool.target === "external" ? "External app" : "Internal route";
  }
}

function getStatusLabel(tool: ToolItem) {
  if (tool.status === "coming-soon") return "Soon";
  if (tool.status === "offline") return "Paused";
  if (tool.status === "beta") return "Preview";
  return "Live";
}

function LaunchCard({ tool }: { tool: ToolItem }) {
  const Icon = iconRegistry[tool.icon];
  const disabled = isInactive(tool);
  const presentation = getPresentation(tool);
  const theme = toneTheme[presentation.tone];
  const target = tool.target === "external" && tool.openInNewTab ? "_blank" : undefined;
  const rel = tool.target === "external" ? "noopener noreferrer" : undefined;

  return (
    <article
      className={cn(
        "group relative isolate overflow-hidden rounded-xl border p-4 text-[color:var(--primary-contrast)] shadow-[var(--shadow-tight)] motion-safe:transition motion-safe:duration-200 motion-safe:ease-[var(--ease-out-soft)] motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--shadow-hover)] dark:text-[color:var(--text-heading)]",
        "bg-[linear-gradient(145deg,color-mix(in_srgb,var(--app-shell-muted)_76%,transparent),color-mix(in_srgb,var(--app-shell)_96%,black))]",
        theme.border,
        disabled && "opacity-60",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 opacity-45", theme.aura)} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(color-mix(in_srgb,white_22%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,white_18%,transparent)_1px,transparent_1px)] [background-size:32px_32px]"
        aria-hidden
      />
      <div className={cn("absolute inset-x-0 top-0 h-0.5 opacity-70", theme.rail)} aria-hidden />

      <div className="relative z-10 flex min-h-52 flex-col">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg border", theme.icon)}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold",
              disabled
                ? "border-white/10 bg-white/[0.045] text-white/48"
                : "border-[color:color-mix(in_srgb,var(--success)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success-bg)]",
            )}
          >
            {disabled ? (
              <CircleDashed className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {getStatusLabel(tool)}
          </span>
        </div>

        <div className="mt-5">
          <p className={cn("text-xs font-semibold uppercase", theme.text)}>{presentation.cadence}</p>
          <h2 className="mt-2 text-2xl font-black leading-none text-[color:var(--primary-contrast)] dark:text-[color:var(--text-heading)]">
            {tool.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/68">{presentation.role}</p>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span className="nums min-w-0 truncate text-xs font-semibold text-white/48">{getLaunchContext(tool)}</span>
            {disabled ? (
              <span className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-white/46">
                Unavailable
              </span>
            ) : (
              <a
                href={tool.href}
                target={target}
                rel={rel}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-3 text-sm font-black text-[color:var(--primary-contrast)] shadow-[var(--shadow-inset)] outline-none motion-safe:transition motion-safe:duration-150 motion-safe:ease-[var(--ease-out-soft)] motion-safe:hover:-translate-y-0.5 hover:bg-[color:var(--primary-strong)] focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/30"
                aria-label={`Launch ${tool.title}`}
              >
                Launch
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function AppDock({ tools }: { tools: ToolItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {tools.map((tool) => {
        const Icon = iconRegistry[tool.icon];
        const presentation = getPresentation(tool);
        const theme = toneTheme[presentation.tone];

        return (
          <a
            key={tool.id}
            href={tool.href}
            target={tool.openInNewTab ? "_blank" : undefined}
            rel={tool.target === "external" ? "noopener noreferrer" : undefined}
            className={cn(
              "group flex min-h-[56px] items-center gap-2 overflow-hidden rounded-lg border bg-white/[0.055] px-3 text-left shadow-[var(--shadow-inset)] outline-none motion-safe:transition motion-safe:duration-150 motion-safe:ease-[var(--ease-out-soft)] motion-safe:hover:-translate-y-0.5 hover:bg-white/[0.085] focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/30",
              theme.border,
            )}
            aria-label={`Launch priority tool ${tool.title}`}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", theme.rail)} aria-hidden />
            <Icon className={cn("h-4 w-4 shrink-0 transition group-hover:scale-110", theme.text)} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-xs font-black leading-4 text-white">{presentation.shortLabel}</span>
              <span className="sr-only">{presentation.cadence}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

function HeroConsole() {
  return (
    <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-[var(--shadow-lux)] backdrop-blur-xl lg:p-4">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_0%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_16rem),linear-gradient(180deg,color-mix(in_srgb,white_9%,transparent),transparent)]"
        aria-hidden
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.07] text-[color:var(--primary-100)]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-black text-white">Priority handoffs</p>
              <p className="text-xs font-semibold text-white/46">Pinned clinical tasks</p>
            </div>
          </div>
          <span className="inline-flex min-h-8 items-center rounded-md border border-[color:color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_12%,transparent)] px-2 text-xs font-semibold text-[color:var(--success-bg)]">
            {favoriteTools.length} pinned
          </span>
        </div>
        <div className="mt-3">
          <AppDock tools={favoriteTools} />
        </div>
      </div>
    </aside>
  );
}

export default function ToolsLauncherPage() {
  return (
    <div className="min-h-full bg-[color:var(--app-shell)] text-[color:var(--primary-contrast)] dark:text-[color:var(--text-heading)]">
      <div className="relative isolate min-h-full overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-8%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_34rem),radial-gradient(circle_at_86%_8%,color-mix(in_srgb,var(--info)_16%,transparent),transparent_30rem),linear-gradient(180deg,var(--app-shell-muted)_0%,var(--app-shell)_46%,color-mix(in_srgb,var(--app-shell)_70%,black)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(color-mix(in_srgb,white_18%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,white_14%,transparent)_1px,transparent_1px)] [background-size:48px_48px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/70 to-transparent"
          aria-hidden
        />

        <main id="main-content" className="relative z-10">
          <section className="mx-auto flex min-h-[68svh] max-w-7xl flex-col px-4 pb-6 pt-safe sm:px-6 lg:min-h-[64svh]">
            <nav className="flex items-center justify-between gap-3 py-4">
              <Link
                href="/"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-white/76 shadow-[var(--shadow-inset)] outline-none transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/30"
                aria-label="Return to Clinical KB dashboard"
              >
                <LayoutList className="h-5 w-5" aria-hidden />
              </Link>
              <a
                href="#launchers"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white/76 shadow-[var(--shadow-inset)] outline-none transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]/30"
              >
                Launchers
                <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
            </nav>

            <div className="grid flex-1 items-center gap-5 py-4 sm:py-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-8">
              <div className="max-w-4xl">
                <h1 className="max-w-3xl text-5xl font-black leading-[0.92] text-white sm:text-6xl lg:text-7xl xl:text-8xl">
                  Open the right clinical tool.
                </h1>
                <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/68 sm:text-lg sm:leading-8">
                  Jump to formulation, DSM-5 criteria, medications, differentials, notes, forms, therapy, specifiers, or
                  service pathways. Each launch opens the local app shown on the card.
                </p>
              </div>

              <HeroConsole />
            </div>
          </section>

          <section id="launchers" className="scroll-mt-8 px-4 pb-10 sm:px-6">
            <div className="mx-auto max-w-7xl border-t border-white/10 pt-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-3xl font-black leading-none text-white sm:text-4xl">All clinical tools</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56">
                    Use the host label to confirm the local app, then open the tool in a new tab.
                  </p>
                </div>
                <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/54 shadow-[var(--shadow-inset)]">
                  <ExternalLink className="h-4 w-4 text-[color:var(--primary-100)]" aria-hidden />
                  Opens in a new tab
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {toolCatalog.map((tool) => (
                  <LaunchCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
