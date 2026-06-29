import {
  Bell,
  BookOpenCheck,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  FileText,
  Fingerprint,
  Globe2,
  HelpCircle,
  History,
  Keyboard,
  LockKeyhole,
  MessageSquare,
  MonitorSmartphone,
  Palette,
  PanelTop,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  TextCursorInput,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { appBackdrop, cn } from "@/components/ui-primitives";

export type SettingsSearchMockupVariant = "general" | "clinical" | "privacy";

type SettingsRow = {
  label: string;
  description?: string;
  value?: string;
  enabled?: boolean;
  icon?: LucideIcon;
};

type SettingsSection = {
  title: string;
  rows: SettingsRow[];
};

type Concept = {
  eyebrow: string;
  title: string;
  subtitle: string;
  activeNav: string;
  summary: SettingsRow[];
  sections: SettingsSection[];
  phoneSections: SettingsSection[];
};

const navItems: Array<{ label: string; icon: LucideIcon }> = [
  { label: "General", icon: Settings },
  { label: "Clinical defaults", icon: Stethoscope },
  { label: "Personalisation", icon: Sparkles },
  { label: "Notifications", icon: Bell },
  { label: "Privacy", icon: ShieldCheck },
  { label: "Security", icon: LockKeyhole },
  { label: "Account", icon: CircleUserRound },
  { label: "Keyboard", icon: Keyboard },
  { label: "Help & About", icon: HelpCircle },
];

const concepts: Record<SettingsSearchMockupVariant, Concept> = {
  general: {
    eyebrow: "Concept 01",
    title: "Account & app hub",
    subtitle:
      "The best default landing page: profile, clinical defaults, app preferences, and privacy in one calm settings surface.",
    activeNav: "Account",
    summary: [
      { label: "Profile", value: "Dr Simpson", icon: UserRound },
      { label: "Clinical defaults", value: "WA, adults", icon: Stethoscope },
      { label: "Privacy", value: "No identifiers", icon: ShieldCheck },
    ],
    sections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Email", value: "Private", icon: MessageSquare },
          { label: "Clinical role", value: "Consultant psychiatrist", icon: Stethoscope },
          { label: "Organisation", value: "Not shown", icon: Building2 },
        ],
      },
      {
        title: "Clinical defaults",
        rows: [
          { label: "Jurisdiction", value: "Western Australia", icon: Globe2 },
          { label: "Default population", value: "Adults", icon: CircleUserRound },
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
          { label: "Citation display", value: "Inline", icon: FileText },
        ],
      },
      {
        title: "App preferences",
        rows: [
          { label: "Appearance", value: "System", icon: Palette },
          { label: "Interface density", value: "Comfortable", icon: Settings },
          { label: "Default landing view", value: "Ask", icon: PanelTop },
        ],
      },
      {
        title: "Privacy & security",
        rows: [
          { label: "No patient identifiers reminder", value: "On", icon: ShieldCheck },
          { label: "App lock", value: "5 minutes", icon: LockKeyhole },
        ],
      },
    ],
    phoneSections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Clinical role", value: "Psychiatrist", icon: Stethoscope },
        ],
      },
      {
        title: "Clinical defaults",
        rows: [
          { label: "Jurisdiction", value: "WA", icon: Globe2 },
          { label: "Population", value: "Adults", icon: CircleUserRound },
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
        ],
      },
      {
        title: "App & privacy",
        rows: [
          { label: "Landing view", value: "Ask", icon: PanelTop },
          { label: "No identifiers", value: "On", icon: ShieldCheck },
        ],
      },
    ],
  },
  clinical: {
    eyebrow: "Concept 02",
    title: "Clinical defaults",
    subtitle:
      "A focused settings view for how clinical answers should behave before the user asks anything.",
    activeNav: "Clinical defaults",
    summary: [
      { label: "Jurisdiction", value: "WA", icon: Globe2 },
      { label: "Population", value: "Adults", icon: CircleUserRound },
      { label: "Evidence", value: "Current first", icon: BookOpenCheck },
    ],
    sections: [
      {
        title: "Clinical context",
        rows: [
          { label: "Jurisdiction", value: "Western Australia", icon: Globe2 },
          { label: "Default population", value: "Adults", icon: CircleUserRound },
          { label: "Clinical role", value: "Consultant psychiatrist", icon: Stethoscope },
          { label: "Specialty focus", value: "Psychiatry", icon: Sparkles },
        ],
      },
      {
        title: "Answer behaviour",
        rows: [
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
          { label: "Default answer length", value: "Standard", icon: TextCursorInput },
          { label: "Evidence preference", value: "Current guidance first", icon: BookOpenCheck },
          { label: "Citation display", value: "Inline and expandable", icon: FileText },
        ],
      },
      {
        title: "Clinical safeguards",
        rows: [
          {
            label: "Medication safety prompts",
            description: "Surface contraindications, interactions, and baseline checks when relevant.",
            enabled: true,
            icon: ShieldCheck,
          },
          {
            label: "Monitoring reminders",
            description: "Include baseline tests and follow-up monitoring prompts in medicine answers.",
            enabled: true,
            icon: Clock3,
          },
          {
            label: "Clarify vague prompts",
            description: "Ask a short follow-up question before answering unsafe or underspecified requests.",
            enabled: true,
            icon: MessageSquare,
          },
        ],
      },
    ],
    phoneSections: [
      {
        title: "Clinical context",
        rows: [
          { label: "Jurisdiction", value: "WA", icon: Globe2 },
          { label: "Population", value: "Adults", icon: CircleUserRound },
          { label: "Clinical role", value: "Psychiatry", icon: Stethoscope },
        ],
      },
      {
        title: "Answers",
        rows: [
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
          { label: "Evidence", value: "Current first", icon: BookOpenCheck },
          { label: "Citations", value: "Inline", icon: FileText },
        ],
      },
      {
        title: "Safeguards",
        rows: [
          { label: "Safety prompts", value: "On", icon: ShieldCheck },
          { label: "Clarify first", value: "On", icon: MessageSquare },
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "Concept 03",
    title: "Privacy & security",
    subtitle:
      "A privacy-led settings view for patient-identifier reminders, history behaviour, device protection, and sessions.",
    activeNav: "Privacy",
    summary: [
      { label: "Identifiers", value: "Warn first", icon: ShieldCheck },
      { label: "App lock", value: "On", icon: LockKeyhole },
      { label: "Sessions", value: "This device", icon: MonitorSmartphone },
    ],
    sections: [
      {
        title: "Privacy",
        rows: [
          {
            label: "No patient identifiers reminder",
            description: "Warn before prompts or saved notes include identifiable patient details.",
            enabled: true,
            icon: ShieldCheck,
          },
          {
            label: "Private mode by default",
            description: "Start new clinical sessions without saving detailed prompt content.",
            enabled: false,
            icon: LockKeyhole,
          },
          {
            label: "Topic-only history",
            description: "Show recent work by topic and guideline, not patient details.",
            enabled: true,
            icon: History,
          },
          {
            label: "Save detailed prompts",
            description: "Keep full prompt text in history when private mode is off.",
            enabled: false,
            icon: FileText,
          },
        ],
      },
      {
        title: "Data controls",
        rows: [
          { label: "Clear recent activity", value: "Available", icon: Trash2 },
          { label: "Export my data", value: "Available", icon: Download },
          { label: "Delete my data", value: "Request", icon: Trash2 },
        ],
      },
      {
        title: "Security",
        rows: [
          { label: "App lock", value: "After 5 minutes", icon: LockKeyhole },
          { label: "Biometric unlock", value: "On", icon: Fingerprint },
          { label: "Active sessions", value: "This device", icon: MonitorSmartphone },
          { label: "Trusted devices", value: "1 device", icon: ShieldCheck },
        ],
      },
      {
        title: "Notifications",
        rows: [
          {
            label: "Hide notification previews",
            description: "Keep clinical content hidden on the lock screen and notification tray.",
            enabled: true,
            icon: Bell,
          },
        ],
      },
    ],
    phoneSections: [
      {
        title: "Privacy",
        rows: [
          { label: "Identifier warning", value: "On", icon: ShieldCheck },
          { label: "Private mode", value: "Off", icon: LockKeyhole },
          { label: "Topic-only history", value: "On", icon: History },
        ],
      },
      {
        title: "Security",
        rows: [
          { label: "App lock", value: "5 min", icon: LockKeyhole },
          { label: "Biometric unlock", value: "On", icon: Fingerprint },
          { label: "Sessions", value: "1", icon: MonitorSmartphone },
        ],
      },
      {
        title: "Notifications",
        rows: [
          { label: "Previews", value: "Hidden", icon: Bell },
          { label: "Quiet hours", value: "Off", icon: Clock3 },
        ],
      },
    ],
  },
};

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
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
        active
          ? "border-[color:var(--app-shell)] bg-[color:var(--app-shell)] text-white"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function DesktopNav({ active }: { active: string }) {
  return (
    <nav className="space-y-1 p-3">
      <button
        type="button"
        aria-label="Close settings"
        className="mb-3 grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)] transition hover:bg-[color:var(--surface-subtle)]"
      >
        <X className="h-5 w-5" />
      </button>
      {navItems.map(({ label, icon: Icon }) => {
        const selected = label === active;
        return (
          <button
            key={label}
            type="button"
            aria-current={selected ? "page" : undefined}
            className={cn(
              "grid min-h-10 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
              selected
                ? "bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)]"
                : "text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SummaryTile({ row }: { row: SettingsRow }) {
  const Icon = row.icon ?? Settings;

  return (
    <button
      type="button"
      className="grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left shadow-[var(--shadow-tight)]"
    >
      <IconFrame icon={Icon} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-[color:var(--text-muted)]">{row.label}</span>
        <span className="mt-1 block truncate text-sm font-semibold text-[color:var(--text-heading)]">{row.value}</span>
      </span>
    </button>
  );
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-2 text-[11px] font-semibold text-[color:var(--text-muted)]">
      {children}
    </span>
  );
}

function DesktopProfileStrip() {
  return (
    <button
      type="button"
      className="mt-4 grid min-h-[74px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-left shadow-[var(--shadow-tight)]"
    >
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-sm font-bold text-[color:var(--clinical-chat-teal)]">
        DS
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--surface)] bg-emerald-600" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">Dr Simpson</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--text-muted)]">
          Consultant psychiatrist, Western Australia
        </span>
      </span>
      <span className="flex flex-wrap justify-end gap-1.5">
        <StatusChip>Private</StatusChip>
        <StatusChip>No PHI</StatusChip>
      </span>
    </button>
  );
}

function SettingRow({ row }: { row: SettingsRow }) {
  const Icon = row.icon;
  return (
    <button
      type="button"
      className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] py-2.5 text-left last:border-b-0"
    >
      {Icon ? <IconFrame icon={Icon} /> : <span className="h-8 w-8" />}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[color:var(--text-heading)]">{row.label}</span>
        {row.description ? (
          <span className="mt-0.5 block max-w-xl text-xs leading-5 text-[color:var(--text-muted)]">
            {row.description}
          </span>
        ) : null}
      </span>
      {typeof row.enabled === "boolean" ? (
        <Toggle enabled={row.enabled} />
      ) : (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--text-heading)]">
          {row.value}
          <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" />
        </span>
      )}
    </button>
  );
}

function DesktopModal({ concept }: { concept: Concept }) {
  return (
    <section className="h-[800px] w-[880px] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-elevated)]">
      <div className="grid h-full grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-raised)]">
          <DesktopNav active={concept.activeNav} />
        </aside>
        <div className="min-w-0 overflow-hidden px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-chat-teal)]">
                {concept.eyebrow}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[color:var(--text-heading)]">{concept.activeNav}</h2>
            </div>
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
              Private workspace
            </span>
          </div>

          <DesktopProfileStrip />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {concept.summary.map((row) => (
              <SummaryTile key={row.label} row={row} />
            ))}
          </div>

          <div className="mt-4 h-[524px] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-5 shadow-[var(--shadow-tight)]">
            {concept.sections.map((section, index) => (
              <div key={section.title} className={cn(index > 0 && "border-t border-[color:var(--border)] pt-4")}>
                <h3 className={cn("text-sm font-semibold text-[color:var(--text-heading)]", index === 0 ? "pt-4" : "")}>
                  {section.title}
                </h3>
                <div className="mt-2">
                  {section.rows.map((row) => (
                    <SettingRow key={row.label} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneStatusBar() {
  return (
    <div className="flex h-9 items-center justify-between px-5 text-[11px] font-bold text-[color:var(--text-heading)]">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-4 rounded-[3px] border border-[color:var(--text-heading)]" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--text-heading)]" />
      </span>
    </div>
  );
}

function PhoneBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-5 top-[118px] opacity-60" aria-hidden="true">
      <div className="h-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]" />
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="grid min-h-[58px] grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-lg bg-[color:var(--surface-inset)] px-3"
          >
            <span className="h-8 w-8 rounded-lg bg-[color:var(--surface-subtle)]" />
            <span className="space-y-2">
              <span className="block h-2.5 w-36 rounded-full bg-[color:var(--border)]" />
              <span className="block h-2 w-24 rounded-full bg-[color:var(--border)]" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneProfileRow() {
  return (
    <button
      type="button"
      className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left shadow-[var(--shadow-tight)]"
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-sm font-bold text-[color:var(--clinical-chat-teal)]">
        DS
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-emerald-600" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">Dr Simpson</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--text-muted)]">
          Consultant psychiatrist, WA
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-[color:var(--text-muted)]" />
    </button>
  );
}

function PhoneClinicalStatus() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {["Private", "WA", "No PHI"].map((item, index) => (
        <span
          key={item}
          className={cn(
            "inline-flex min-h-8 items-center justify-center rounded-lg border px-2 text-[11px] font-semibold",
            index === 0
              ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function PhoneSettingsSection({ section }: { section: SettingsSection }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
        {section.title}
      </h3>
      <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        {section.rows.map((row, index) => {
          const Icon = row.icon ?? Settings;
          return (
            <button
              key={row.label}
              type="button"
              className="grid min-h-[52px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 text-left last:border-b-0"
            >
              <IconFrame
                icon={Icon}
                active={
                  index === 0 &&
                  ["Clinical defaults", "Answers", "Safeguards", "Privacy", "Security"].includes(section.title)
                }
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[color:var(--text-heading)]">{row.label}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-2 text-right text-xs font-medium text-[color:var(--text-muted)]">
                <span className="max-w-[86px] truncate">{row.value}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PhoneSheet({ concept }: { concept: Concept }) {
  return (
    <section className="h-[760px] w-[350px] rounded-[42px] bg-[color:var(--app-shell)] p-2 shadow-[var(--shadow-elevated)]">
      <div className="relative h-full overflow-hidden rounded-[34px] bg-[color:var(--surface-raised)]">
        <PhoneStatusBar />
        <PhoneBackdrop />

        <div className="absolute inset-x-3 top-11 rounded-[22px] border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 pb-4 pt-3 shadow-[var(--shadow-elevated)]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <span />
            <p className="text-base font-semibold leading-6 text-[color:var(--text-heading)]">Settings</p>
            <button
              type="button"
              aria-label="Close settings"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 space-y-4">
            <PhoneProfileRow />
            <PhoneClinicalStatus />
            {concept.phoneSections.map((section) => (
              <PhoneSettingsSection key={section.title} section={section} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BoardShell({ children, concept }: { children: ReactNode; concept: Concept }) {
  return (
    <>
      <style>{`nextjs-portal,[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none!important}`}</style>
      <main
        className={cn(
          appBackdrop,
          "fixed inset-0 z-[2147483647] overflow-auto px-8 py-7 text-[color:var(--text-heading)]",
        )}
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-chat-teal)]">
                {concept.eyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-semibold">{concept.title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">{concept.subtitle}</p>
            </div>
            <span className="hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)] sm:inline-flex">
              Desktop + iPhone settings popup
            </span>
          </div>
          <div className="grid items-start gap-7 lg:grid-cols-[370px_minmax(0,1fr)]">{children}</div>
        </div>
      </main>
    </>
  );
}

export function SettingsSearchMockupPage({ variant }: { variant: SettingsSearchMockupVariant }) {
  const concept = concepts[variant];

  return (
    <BoardShell concept={concept}>
      <PhoneSheet concept={concept} />
      <DesktopModal concept={concept} />
    </BoardShell>
  );
}
