"use client";

import {
  ArrowLeft,
  BatteryFull,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Globe2,
  Keyboard,
  LayoutGrid,
  LockKeyhole,
  Monitor,
  Palette,
  PanelTop,
  Scale,
  ShieldCheck,
  Signal,
  Sparkles,
  Stethoscope,
  Sun,
  Type,
  VibrateOff,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { appBackdrop, cn } from "@/components/ui-primitives";

export type SettingsFeatureGroupId =
  | "source-evidence"
  | "answer-reading"
  | "clinical-workflow"
  | "privacy-trust"
  | "productivity"
  | "accessibility-device";

type FeatureRow = {
  label: string;
  adds: string;
  value?: string;
  enabled?: boolean;
  icon: LucideIcon;
};

type FeatureGroup = {
  id: SettingsFeatureGroupId;
  order: number;
  title: string;
  shortTitle: string;
  summary: string;
  icon: LucideIcon;
  rows: FeatureRow[];
};

export const SETTINGS_FEATURE_GROUPS: ReadonlyArray<FeatureGroup> = [
  {
    id: "source-evidence",
    order: 1,
    title: "Source & evidence",
    shortTitle: "Source",
    summary: "Control how answers prefer, show, and reconcile clinical sources.",
    icon: BookOpen,
    rows: [
      {
        label: "Show source-only answers by default",
        adds: "Skip AI synthesis and show cited sources first unless you ask for a generated answer",
        enabled: true,
        icon: FileText,
      },
      {
        label: "Local-first vs best-evidence",
        adds: "Decide whether WA/local protocols or broader best evidence wins when sources conflict",
        value: "Local first",
        icon: Scale,
      },
      {
        label: "Preferred authority set",
        adds: "Choose which publishers/authorities to prioritise (e.g. WA Health, RANZCP, TGA/PBS, BMJ)",
        value: "WA · RANZCP · PBS",
        icon: ShieldCheck,
      },
      {
        label: "Conflict surfacing when sources disagree",
        adds: "Show a clear conflict notice when local and non-local guidance differ",
        enabled: true,
        icon: CircleAlert,
      },
      {
        label: "Richer citation detail",
        adds: "Always show page, section path, and publisher with each citation",
        enabled: true,
        icon: BookOpen,
      },
      {
        label: "Always open evidence drawer",
        adds: "Open the evidence/source panel automatically with every answer",
        enabled: false,
        icon: PanelTop,
      },
    ],
  },
  {
    id: "answer-reading",
    order: 2,
    title: "Answer reading",
    shortTitle: "Reading",
    summary: "Make answers easier to verify, copy, and read in clinical settings.",
    icon: Type,
    rows: [
      {
        label: "Copy with citations + source status by default",
        adds: "Copied answers include citations and source status automatically",
        enabled: true,
        icon: ClipboardList,
      },
      {
        label: "Session-sticky filters",
        adds: "Remember jurisdiction, population, and scope filters for the current browser session",
        enabled: true,
        icon: Sparkles,
      },
      {
        label: "Always-on safety / disclaimer strip",
        adds: "Keep the “reference, not clinical decision support” notice visible on answers",
        enabled: true,
        icon: CircleAlert,
      },
      {
        label: "Answer text size / reading measure",
        adds: "Adjust answer reading size and line length for ward/laptop use",
        value: "Comfortable",
        icon: Type,
      },
    ],
  },
  {
    id: "clinical-workflow",
    order: 3,
    title: "Clinical workflow",
    shortTitle: "Workflow",
    summary: "Start in the right mode and keep practice context ready without PHI.",
    icon: Stethoscope,
    rows: [
      {
        label: "Default clinical mode on launch",
        adds: "Open straight into Answer, Prescribing, Differentials, DSM, Forms, etc.",
        value: "Answer",
        icon: LayoutGrid,
      },
      {
        label: "Default query mode",
        adds: "Set the usual search intent to auto, protocol, dosing, or differential",
        value: "Auto",
        icon: Sparkles,
      },
      {
        label: "Pinned mode dock / favourites strip",
        adds: "Choose which modes appear first in the phone/desktop dock",
        value: "Answer · Rx · DSM",
        icon: PanelTop,
      },
      {
        label: "Ward / service context",
        adds: "Optional non-PHI practice label (e.g. EMHS adult acute, CAMHS) to bias forms/services/protocols",
        value: "EMHS adult acute",
        icon: Stethoscope,
      },
      {
        label: "Prescribing locale helpers",
        adds: "Prefer Australian/PBS naming, spelling, and unit display conventions",
        enabled: true,
        icon: Globe2,
      },
    ],
  },
  {
    id: "privacy-trust",
    order: 4,
    title: "Privacy & trust",
    shortTitle: "Privacy",
    summary: "Keep the app honest about data mode, sync, and PHI boundaries.",
    icon: LockKeyhole,
    rows: [
      {
        label: "Demo vs live mode indicator",
        adds: "Clearly show whether the app is using demo data or the live knowledge base",
        value: "Live",
        icon: Eye,
      },
      {
        label: "Local-only mode",
        adds: "Keep favourites and preferences on this device only, with no account sync",
        enabled: false,
        icon: LockKeyhole,
      },
      {
        label: "Auto-clear recent searches",
        adds: "Clear recent searches after the session, after 24 hours, or never",
        value: "After session",
        icon: ShieldCheck,
      },
      {
        label: "PHI reminder cadence",
        adds: "Show periodic reminders not to enter protected health information",
        value: "Weekly",
        icon: CircleAlert,
      },
      {
        label: "Upload retention / deletion clarity",
        adds: "Show who can see uploaded docs and make deletion/retention status clear",
        value: "Owner only",
        icon: FileText,
      },
      {
        label: "Export / import preferences + favourites",
        adds: "Download/upload a backup file to move settings between devices",
        value: "Export…",
        icon: Download,
      },
      {
        label: "Signed-in device list / session revoke",
        adds: "See active signed-in sessions and sign them out remotely",
        value: "1 device",
        icon: Monitor,
      },
    ],
  },
  {
    id: "productivity",
    order: 5,
    title: "Productivity",
    shortTitle: "Productivity",
    summary: "Speed up repeated clinical lookups and document review habits.",
    icon: FolderOpen,
    rows: [
      {
        label: "Saved search templates",
        adds: "Save reusable searches with mode and filters baked in",
        value: "3 saved",
        icon: ClipboardList,
      },
      {
        label: "Favourites folders / tags",
        adds: "Organise favourites into folders or tags",
        value: "Protocols · Meds",
        icon: FolderOpen,
      },
      {
        label: "PDF open behaviour",
        adds: "Choose whether PDFs open in-app or in a new tab",
        value: "In-app",
        icon: FileText,
      },
      {
        label: "Remember document viewer zoom / layout",
        adds: "Restore last zoom and layout when reopening documents",
        enabled: true,
        icon: Eye,
      },
      {
        label: "Custom keyboard shortcuts",
        adds: "Remap shortcuts like focus search, command menu, and new question",
        value: "Defaults",
        icon: Keyboard,
      },
      {
        label: "Offline reading pack for favourites",
        adds: "Download favourited documents for offline hospital/clinic use",
        value: "12 docs",
        icon: Download,
      },
    ],
  },
  {
    id: "accessibility-device",
    order: 6,
    title: "Accessibility / device",
    shortTitle: "Access",
    summary: "Tune display and device behaviour for ward phones and shared workstations.",
    icon: Palette,
    rows: [
      {
        label: "Larger text / reading options",
        adds: "Increase text size for easier ward/phone reading",
        value: "Large",
        icon: Type,
      },
      {
        label: "Force light mode",
        adds: "Keep the app in light mode even if the device is in dark mode",
        enabled: true,
        icon: Sun,
      },
      {
        label: "Reduced transparency / simpler chrome",
        adds: "Reduce glass/blur effects for clearer, faster UI",
        enabled: false,
        icon: Monitor,
      },
      {
        label: "Haptics off",
        adds: "Disable vibration feedback on shared or clinical devices",
        enabled: true,
        icon: VibrateOff,
      },
    ],
  },
];

function Toggle({ enabled }: { enabled?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        enabled ? "bg-[color:var(--app-shell)]" : "bg-[color:var(--border-strong)]/55",
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "absolute h-5 w-5 rounded-full bg-white shadow-[var(--shadow-tight)] transition",
          enabled ? "right-0.5" : "left-0.5",
        )}
      />
    </span>
  );
}

function IconFrame({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)] transition",
        active
          ? "border-[color:var(--clinical-accent)]/30 bg-[color:var(--app-shell)] text-white"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}

function PhoneStatusBar() {
  return (
    <div className="flex h-9 items-center justify-between px-5 text-2xs font-bold text-[color:var(--text-heading)]">
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <Signal className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        <Wifi className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        <BatteryFull className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </span>
    </div>
  );
}

function PhoneFeatureRow({ row, index }: { row: FeatureRow; index: number }) {
  const Icon = row.icon;
  return (
    <div className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 py-2.5 last:border-b-0">
      <IconFrame icon={Icon} active={index === 0} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[color:var(--text-heading)]">{row.label}</p>
        <p className="mt-0.5 line-clamp-2 text-2xs leading-4 text-[color:var(--text-muted)]">{row.adds}</p>
      </div>
      {typeof row.enabled === "boolean" ? (
        <Toggle enabled={row.enabled} />
      ) : (
        <span className="inline-flex max-w-[78px] items-center gap-1 text-right text-2xs font-medium text-[color:var(--text-muted)]">
          <span className="truncate">{row.value}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function PhoneSheet({ group }: { group: FeatureGroup }) {
  return (
    <section className="h-[760px] w-full max-w-[350px] rounded-[42px] bg-[color:var(--app-shell)] p-2 shadow-[0_22px_55px_rgba(15,31,38,0.18)]">
      <div className="relative h-full overflow-hidden rounded-[34px] bg-[color:var(--surface-raised)]">
        <PhoneStatusBar />
        <div className="absolute inset-x-3 top-11 bottom-3 overflow-hidden rounded-[24px] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[0_18px_42px_rgba(15,31,38,0.14)] ring-1 ring-white/45">
          <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)]">
              <ArrowLeft className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-[color:var(--text-heading)]">Settings</p>
              <p className="truncate text-2xs font-medium text-[color:var(--text-muted)]">
                {group.order}. {group.title}
              </p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)]">
              <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
          </div>

          <div className="h-[calc(100%-60px)] overflow-y-auto px-3 py-3">
            <div className="mb-3 rounded-xl border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)]/50 px-3 py-2.5">
              <p className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                New · recommended
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--text-heading)]">{group.title}</p>
              <p className="mt-1 text-2xs leading-4 text-[color:var(--text-muted)]">{group.summary}</p>
            </div>

            <section>
              <h2 className="mb-1.5 px-1 text-2xs font-semibold tracking-[0.02em] text-[color:var(--text-soft)]">
                {group.title}
              </h2>
              <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)]">
                {group.rows.map((row, index) => (
                  <PhoneFeatureRow key={row.label} row={row} index={index} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopFeatureRow({ row }: { row: FeatureRow }) {
  const Icon = row.icon;
  return (
    <div className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-[color:var(--border)] py-3 last:border-b-0">
      <IconFrame icon={Icon} />
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">{row.label}</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--text-muted)]">
          <span className="font-semibold text-[color:var(--text-soft)]">Adds: </span>
          {row.adds}
        </p>
      </div>
      {typeof row.enabled === "boolean" ? (
        <Toggle enabled={row.enabled} />
      ) : (
        <span className="inline-flex items-center gap-2 pt-1 text-sm font-medium text-[color:var(--text-heading)]">
          {row.value}
          <ChevronRight className="h-4 w-4 text-[color:var(--text-muted)]" strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function DesktopModal({
  group,
  groups,
  activeId,
  onSelect,
}: {
  group: FeatureGroup;
  groups: ReadonlyArray<FeatureGroup>;
  activeId: SettingsFeatureGroupId;
  onSelect: (id: SettingsFeatureGroupId) => void;
}) {
  return (
    <section className="h-[800px] w-full max-w-[920px] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[0_18px_52px_rgba(15,31,38,0.11)] ring-1 ring-white/45">
      <div className="grid h-full grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3">
          <div className="mb-4 flex items-center gap-2 px-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)]">
              <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                Recommended
              </p>
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">New settings</p>
            </div>
          </div>
          <nav className="space-y-1" aria-label="Recommended settings groups">
            {groups.map((item) => {
              const Icon = item.icon;
              const selected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "relative grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-transparent px-3 text-left text-sm font-medium transition",
                    selected
                      ? "border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]",
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4", selected && "text-[color:var(--clinical-accent)]")}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">
                      {item.order}. {item.shortTitle}
                    </span>
                    <span className="block truncate text-2xs font-medium text-[color:var(--text-soft)]">
                      {item.rows.length} options
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 overflow-y-auto px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                Group {group.order} of 6
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[color:var(--text-heading)]">{group.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--text-muted)]">{group.summary}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
              <Check className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
              Mockup only
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-5 shadow-[var(--shadow-lux)] ring-1 ring-white/35">
            <div className="border-b border-[color:var(--border)] py-4">
              <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">{group.title}</h3>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                Each row shows the control and what it adds.
              </p>
            </div>
            {group.rows.map((row) => (
              <DesktopFeatureRow key={row.label} row={row} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GalleryCard({ group }: { group: FeatureGroup }) {
  const Icon = group.icon;
  return (
    <article className="rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-lux)]">
      <div className="mb-4 flex items-start gap-3">
        <IconFrame icon={Icon} active />
        <div className="min-w-0">
          <p className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
            Recommended {group.order}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">{group.title}</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{group.summary}</p>
        </div>
      </div>
      <ol className="space-y-2.5">
        {group.rows.map((row, index) => (
          <li
            key={row.label}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2.5 shadow-[var(--shadow-inset)]"
          >
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">
              {index + 1}. {row.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
              <span className="font-semibold text-[color:var(--text-soft)]">Adds: </span>
              {row.adds}
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}

function BoardShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <style>{`nextjs-portal,[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none!important}`}</style>
      <main
        className={cn(
          appBackdrop,
          "fixed inset-0 z-[100] overflow-auto px-4 py-7 text-[color:var(--text-heading)] sm:px-8",
        )}
      >
        <div className="mx-auto max-w-[1380px]">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                Settings mockups
              </p>
              <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">{subtitle}</p>
            </div>
            {actions}
          </div>
          {children}
        </div>
      </main>
    </>
  );
}

export function SettingsRecommendedFeaturesMockupPage({
  initialGroupId = "source-evidence",
  mode = "interactive",
}: {
  initialGroupId?: SettingsFeatureGroupId;
  mode?: "interactive" | "gallery";
}) {
  const [activeId, setActiveId] = useState<SettingsFeatureGroupId>(initialGroupId);
  const group = useMemo(
    () => SETTINGS_FEATURE_GROUPS.find((item) => item.id === activeId) ?? SETTINGS_FEATURE_GROUPS[0],
    [activeId],
  );

  if (mode === "gallery") {
    return (
      <BoardShell
        title="Recommended new settings — full gallery"
        subtitle="All six recommended groups with every new option and what it adds. Design scratch only; not wired into product settings."
        actions={
          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
            32 new options · 6 groups
          </span>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {SETTINGS_FEATURE_GROUPS.map((item) => (
            <GalleryCard key={item.id} group={item} />
          ))}
        </div>
      </BoardShell>
    );
  }

  return (
    <BoardShell
      title={`${group.order}. ${group.title}`}
      subtitle={group.summary}
      actions={
        <div className="flex flex-wrap gap-2">
          {SETTINGS_FEATURE_GROUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-xs font-semibold transition",
                item.id === activeId
                  ? "border-[color:var(--clinical-accent)]/30 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
              )}
            >
              {item.order}. {item.shortTitle}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid items-start gap-7 lg:grid-cols-[370px_minmax(0,1fr)]">
        <div className="flex justify-center lg:justify-start">
          <PhoneSheet group={group} />
        </div>
        <div className="hidden lg:block">
          <DesktopModal group={group} groups={SETTINGS_FEATURE_GROUPS} activeId={activeId} onSelect={setActiveId} />
        </div>
      </div>
    </BoardShell>
  );
}
