import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleDashed,
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
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui-primitives";
import { type ToolCategory, type ToolIconName, type ToolItem, toolCatalog } from "@/lib/tools";

type CardTheme = {
  accent: string;
  border: string;
  button: string;
  glow: string;
  icon: string;
  pill: string;
  rail: string;
  surface: string;
};

type ClinicalSignal = {
  label: string;
  value: string;
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

const clinicalSignals: ClinicalSignal[] = [
  { label: "Project suite", value: "9 local clinical apps" },
  { label: "Clinical workflow", value: "Assessment to handover" },
  { label: "Fast path", value: "One click to each workspace" },
];

const categoryTheme: Record<ToolCategory, CardTheme> = {
  Clinical: {
    accent: "text-cyan-100",
    border: "border-cyan-200/24",
    button: "bg-cyan-200 text-slate-950 hover:bg-white",
    glow: "shadow-[0_20px_70px_rgb(34_211_238_/_11%)]",
    icon: "border-cyan-200/30 bg-cyan-200/14 text-cyan-100",
    pill: "border-cyan-100/20 bg-cyan-100/[0.08] text-cyan-100",
    rail: "from-cyan-200 via-teal-200 to-emerald-200",
    surface: "from-cyan-950/72 via-slate-950 to-slate-950",
  },
  Operations: {
    accent: "text-amber-100",
    border: "border-amber-200/24",
    button: "bg-amber-200 text-slate-950 hover:bg-white",
    glow: "shadow-[0_20px_70px_rgb(251_191_36_/_11%)]",
    icon: "border-amber-200/30 bg-amber-200/14 text-amber-100",
    pill: "border-amber-100/20 bg-amber-100/[0.08] text-amber-100",
    rail: "from-amber-200 via-orange-200 to-rose-200",
    surface: "from-amber-950/62 via-slate-950 to-slate-950",
  },
  Docs: {
    accent: "text-violet-100",
    border: "border-violet-200/24",
    button: "bg-violet-200 text-slate-950 hover:bg-white",
    glow: "shadow-[0_20px_70px_rgb(196_181_253_/_11%)]",
    icon: "border-violet-200/30 bg-violet-200/14 text-violet-100",
    pill: "border-violet-100/20 bg-violet-100/[0.08] text-violet-100",
    rail: "from-violet-200 via-fuchsia-200 to-cyan-100",
    surface: "from-violet-950/66 via-slate-950 to-slate-950",
  },
  Research: {
    accent: "text-emerald-100",
    border: "border-emerald-200/24",
    button: "bg-emerald-200 text-slate-950 hover:bg-white",
    glow: "shadow-[0_20px_70px_rgb(110_231_183_/_11%)]",
    icon: "border-emerald-200/30 bg-emerald-200/14 text-emerald-100",
    pill: "border-emerald-100/20 bg-emerald-100/[0.08] text-emerald-100",
    rail: "from-emerald-200 via-lime-100 to-cyan-100",
    surface: "from-emerald-950/62 via-slate-950 to-slate-950",
  },
  Admin: {
    accent: "text-fuchsia-100",
    border: "border-fuchsia-200/24",
    button: "bg-fuchsia-200 text-slate-950 hover:bg-white",
    glow: "shadow-[0_20px_70px_rgb(244_114_182_/_11%)]",
    icon: "border-fuchsia-200/30 bg-fuchsia-200/14 text-fuchsia-100",
    pill: "border-fuchsia-100/20 bg-fuchsia-100/[0.08] text-fuchsia-100",
    rail: "from-fuchsia-200 via-rose-200 to-amber-100",
    surface: "from-fuchsia-950/62 via-slate-950 to-slate-950",
  },
};

function isInactive(tool: ToolItem) {
  return tool.status === "offline" || tool.status === "coming-soon";
}

function getClinicalTrack(tool: ToolItem) {
  const trackById: Partial<Record<ToolItem["id"], string>> = {
    differentials: "Differential",
    "dsm-5-diagnoses": "Diagnosis",
    forms: "Capture",
    formulation: "Case theory",
    medications: "Prescribing",
    "psychiatry-notes": "Notes",
    services: "Pathways",
    specifiers: "Qualifiers",
    therapy: "Treatment",
  };

  return trackById[tool.id] ?? "Clinical";
}

function getShortProjectLabel(tool: ToolItem) {
  const shortLabelById: Partial<Record<ToolItem["id"], string>> = {
    differentials: "Diffs",
    "dsm-5-diagnoses": "DSM",
    forms: "Forms",
    formulation: "Form",
    medications: "Meds",
    "psychiatry-notes": "Notes",
    services: "Svc",
    specifiers: "Specs",
    therapy: "Tx",
  };

  return shortLabelById[tool.id] ?? tool.title;
}

function getLaunchContext(tool: ToolItem) {
  try {
    const url = new URL(tool.href);
    const port = url.port ? `:${url.port}` : "";
    return `Local ${port}`;
  } catch {
    return tool.target === "external" ? "External" : "Internal";
  }
}

function getStatusLabel(tool: ToolItem) {
  if (tool.status === "coming-soon") {
    return "Soon";
  }

  if (tool.status === "offline") {
    return "Paused";
  }

  if (tool.status === "beta") {
    return "Preview";
  }

  return "Local";
}

function LaunchCard({ tool }: { tool: ToolItem }) {
  const Icon = iconRegistry[tool.icon];
  const disabled = isInactive(tool);
  const target = tool.target === "external" && tool.openInNewTab ? "_blank" : undefined;
  const rel = tool.target === "external" ? "noopener noreferrer" : undefined;
  const theme = categoryTheme[tool.category];
  const statusLabel = getStatusLabel(tool);
  const track = getClinicalTrack(tool);
  const launchContext = getLaunchContext(tool);

  return (
    <article
      className={cn(
        "group relative isolate overflow-hidden rounded-md border bg-gradient-to-br p-4 text-white transition duration-300 hover:-translate-y-1",
        theme.border,
        theme.glow,
        theme.surface,
        disabled && "opacity-70",
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", theme.rail)} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,.1),transparent_34%,rgba(255,255,255,.04))]" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.04] blur-2xl transition duration-300 group-hover:bg-white/[0.08]" />

      <div className="relative z-10 flex min-h-[16rem] flex-col">
        <div className="flex items-start justify-between gap-4">
          <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-md border", theme.icon)}>
            <Icon className="h-6 w-6" />
          </span>
          <span
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black",
              disabled ? "border-white/14 bg-white/[0.06] text-white/54" : theme.pill,
            )}
          >
            {disabled ? <CircleDashed className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {statusLabel}
          </span>
        </div>

        <div className="mt-6">
          <p className={cn("text-xs font-black uppercase tracking-[0.18em]", theme.accent)}>{track}</p>
          <h2 className="mt-2 text-2xl font-black leading-none text-white">{tool.title}</h2>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/68">{tool.description}</p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-3 text-xs font-bold text-white/48">
            <ExternalLink className="h-3.5 w-3.5" />
            {launchContext}
          </span>
          {disabled ? (
            <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/[0.05] px-4 text-sm font-bold text-white/48">
              Unavailable
            </span>
          ) : (
            <a
              href={tool.href}
              target={target}
              rel={rel}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition",
                theme.button,
              )}
              aria-label={`Launch ${tool.title}`}
            >
              Launch
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ProjectTabStrip() {
  return (
    <div className="mt-6 grid max-w-2xl grid-cols-2 gap-1.5 sm:flex sm:max-w-3xl sm:flex-wrap sm:gap-1">
      {toolCatalog.map((tool) => {
        const Icon = iconRegistry[tool.icon];
        const theme = categoryTheme[tool.category];

        return (
          <a
            key={tool.id}
            href={tool.href}
            target={tool.openInNewTab ? "_blank" : undefined}
            rel={tool.target === "external" ? "noopener noreferrer" : undefined}
            aria-label={`Open ${tool.title}`}
            className={cn(
              "group/tab relative inline-flex min-h-7 min-w-0 items-center gap-1.5 overflow-hidden rounded-md border bg-white/[0.045] px-2 text-[0.64rem] font-black text-white/68 shadow-[inset_0_1px_0_rgb(255_255_255_/_7%)] transition hover:-translate-y-0.5 hover:bg-white/[0.075] hover:text-white sm:px-1.5",
              theme.border,
            )}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r", theme.rail)} />
            <Icon className={cn("h-3 w-3 shrink-0 transition group-hover/tab:scale-110", theme.accent)} />
            <span className="truncate">{getShortProjectLabel(tool)}</span>
          </a>
        );
      })}
    </div>
  );
}

function ClinicalSignalPanel() {
  return (
    <div className="relative hidden min-h-[31rem] lg:block">
      <div className="absolute left-6 top-0 h-52 w-52 rounded-md border border-cyan-200/20 bg-cyan-200/[0.08] shadow-[0_24px_90px_rgb(34_211_238_/_12%)]" />
      <div className="absolute right-0 top-24 h-52 w-52 rounded-md border border-violet-200/20 bg-violet-200/[0.08] shadow-[0_24px_90px_rgb(196_181_253_/_10%)]" />
      <div className="absolute bottom-0 left-20 h-52 w-52 rounded-md border border-emerald-200/20 bg-emerald-200/[0.08] shadow-[0_24px_90px_rgb(110_231_183_/_10%)]" />
      <div className="absolute left-1/2 top-[45%] w-80 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/16 bg-slate-950/84 p-5 shadow-[inset_0_1px_0_rgb(255_255_255_/_10%),0_30px_90px_rgb(0_0_0_/_36%)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <span className="grid h-12 w-12 place-items-center rounded-md border border-cyan-100/24 bg-cyan-100/[0.1] text-cyan-100">
            <Sparkles className="h-6 w-6" />
          </span>
          <div className="text-right">
            <p className="text-xs font-black text-white/44">Clinical launch room</p>
            <p className="mt-1 text-sm font-black text-cyan-100">Project suite</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {clinicalSignals.map((signal) => (
            <div
              key={signal.label}
              className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.045] px-3 py-3"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/34">{signal.label}</p>
                <p className="mt-1 text-sm font-bold text-white/78">{signal.value}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-100" />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-white/34">
          <div className="h-px bg-white/12" />
          <Target className="h-5 w-5 text-violet-100" />
          <div className="h-px bg-white/12" />
        </div>
      </div>
      <Search className="absolute left-16 top-14 h-10 w-10 text-cyan-100" />
      <ShieldAlert className="absolute bottom-14 left-36 h-10 w-10 text-emerald-100" />
      <Target className="absolute right-14 top-40 h-10 w-10 text-violet-100" />
    </div>
  );
}

export default function ToolsLauncherPage() {
  return (
    <div className="min-h-full bg-[#050d10] text-white">
      <div className="relative isolate min-h-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#07161b_0%,#071014_42%,#020608_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.11)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-cyan-200/[0.08] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/58 to-transparent" />

        <section className="relative z-10 mx-auto flex min-h-svh max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
          <nav className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-cyan-100">Clinical KB Tools Atelier</p>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/[0.06] px-3 text-sm font-bold text-white/84 transition hover:border-white/28 hover:bg-white/[0.1]"
            >
              <LayoutList className="h-4 w-4" />
              Dashboard
            </Link>
          </nav>

          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="max-w-4xl">
              <p className="text-sm font-black text-white/54">Command studio</p>
              <h1 className="mt-4 text-6xl font-black leading-[0.88] text-white sm:text-8xl lg:text-9xl">
                Launch the clinical stack.
              </h1>
              <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-white/68 sm:text-xl sm:leading-9">
                A refined command surface for formulation, diagnosis, therapy, medications, services, differentials,
                forms, specifiers, and psychiatry notes.
              </p>

              <div className="mt-8 h-px max-w-xl bg-gradient-to-r from-cyan-100/42 via-white/16 to-transparent" />
              <ProjectTabStrip />
            </div>

            <ClinicalSignalPanel />
          </div>

          <a
            href="#launchers"
            className="mb-2 inline-flex w-fit items-center gap-2 rounded-md border border-white/14 bg-white/[0.06] px-4 py-3 text-sm font-black text-white/84 transition hover:border-white/28 hover:bg-white/[0.1]"
          >
            Open launchers
            <ArrowDown className="h-4 w-4" />
          </a>
        </section>

        <main id="launchers" className="relative z-10 mx-auto max-w-7xl px-4 pb-10 sm:px-6">
          <div className="border-t border-white/10 pt-8">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-3xl font-black leading-none text-white sm:text-4xl">Clinical app launchers</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                  Direct routes into the main local clinical applications in this workspace.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-white/48">
                <Sparkles className="h-4 w-4 text-cyan-100" />
                Launch only, no dashboard noise
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {toolCatalog.map((tool) => (
                <LaunchCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
