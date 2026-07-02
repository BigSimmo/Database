import {
  BatteryFull,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Globe2,
  HelpCircle,
  Keyboard,
  LockKeyhole,
  MessageSquare,
  Palette,
  PanelTop,
  Settings,
  Signal,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UserRound,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { appBackdrop, cn } from "@/components/ui-primitives";

export type SettingsSearchMockupVariant = "general" | "clinical" | "premium";

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
  modalTitle?: string;
  tone: "balanced" | "compact" | "premium";
  summary: SettingsRow[];
  sections: SettingsSection[];
  phoneSections: SettingsSection[];
};

const navItems: Array<{ label: string; icon: LucideIcon }> = [
  { label: "General", icon: Settings },
  { label: "Clinical defaults", icon: Stethoscope },
  { label: "Personalisation", icon: Sparkles },
  { label: "Notifications", icon: Bell },
  { label: "Security", icon: LockKeyhole },
  { label: "Account", icon: CircleUserRound },
  { label: "Keyboard", icon: Keyboard },
  { label: "Help & About", icon: HelpCircle },
];

const concepts: Record<SettingsSearchMockupVariant, Concept> = {
  general: {
    eyebrow: "Concept 01",
    title: "Refined account & app hub",
    subtitle:
      "A softer ChatGPT-style settings surface with balanced spacing, quiet cards, and one precise Aegean accent emphasis.",
    activeNav: "Account",
    modalTitle: "Account & app",
    tone: "balanced",
    summary: [
      { label: "Profile", value: "Dr Simpson", icon: UserRound },
      { label: "Clinical setup", value: "WA, adults", icon: Stethoscope },
      { label: "Default view", value: "Ask", icon: PanelTop },
    ],
    sections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Clinical role", value: "Consultant psychiatrist", icon: Stethoscope },
        ],
      },
      {
        title: "Clinical defaults",
        rows: [
          { label: "Jurisdiction", value: "Western Australia", icon: Globe2 },
          { label: "Default population", value: "Adults", icon: CircleUserRound },
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
        ],
      },
      {
        title: "App preferences",
        rows: [
          { label: "Appearance", value: "System", icon: Palette },
          { label: "Interface density", value: "Comfortable", icon: Settings },
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
        title: "App preferences",
        rows: [
          { label: "Landing view", value: "Ask", icon: PanelTop },
          { label: "Density", value: "Comfort", icon: Settings },
        ],
      },
    ],
  },
  clinical: {
    eyebrow: "Concept 02",
    title: "Precision account & app hub",
    subtitle:
      "A tighter premium settings hub with stronger hierarchy, compact rows, and clinical defaults kept easy to scan.",
    activeNav: "Account",
    modalTitle: "Account & app",
    tone: "compact",
    summary: [
      { label: "Profile", value: "Dr Simpson", icon: UserRound },
      { label: "Clinical setup", value: "WA psychiatry", icon: Stethoscope },
      { label: "Default view", value: "Ask", icon: PanelTop },
    ],
    sections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Email", value: "Private", icon: MessageSquare },
          { label: "Clinical role", value: "Consultant psychiatrist", icon: Stethoscope },
        ],
      },
      {
        title: "Clinical defaults",
        rows: [
          { label: "Jurisdiction", value: "Western Australia", icon: Globe2 },
          { label: "Default population", value: "Adults", icon: CircleUserRound },
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
        ],
      },
      {
        title: "App preferences",
        rows: [
          { label: "Appearance", value: "System", icon: Palette },
          { label: "Interface density", value: "Compact", icon: Settings },
        ],
      },
    ],
    phoneSections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Clinical role", value: "Psychiatry", icon: Stethoscope },
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
        title: "App",
        rows: [
          { label: "Landing view", value: "Ask", icon: PanelTop },
          { label: "Density", value: "Compact", icon: Settings },
        ],
      },
    ],
  },
  premium: {
    eyebrow: "Concept 03",
    title: "Profile-led account hub",
    subtitle:
      "A more personal settings direction with a stronger profile moment, elegant grouping, and restrained clinical context.",
    activeNav: "Account",
    modalTitle: "Account & app",
    tone: "premium",
    summary: [
      { label: "Profile", value: "Dr Simpson", icon: UserRound },
      { label: "Clinical setup", value: "WA, adults", icon: Stethoscope },
      { label: "Favourites", value: "Protocols", icon: Sparkles },
    ],
    sections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Clinical role", value: "Consultant psychiatrist", icon: Stethoscope },
        ],
      },
      {
        title: "Clinical defaults",
        rows: [
          { label: "Jurisdiction", value: "Western Australia", icon: Globe2 },
          { label: "Default population", value: "Adults", icon: CircleUserRound },
          { label: "Answer style", value: "Conservative", icon: SlidersHorizontal },
        ],
      },
      {
        title: "App experience",
        rows: [
          { label: "Home modules", value: "Recent, protocols", icon: PanelTop },
          { label: "Favourite areas", value: "Mood, psychosis", icon: Sparkles },
        ],
      },
    ],
    phoneSections: [
      {
        title: "Account",
        rows: [
          { label: "Profile", value: "Dr Simpson", icon: UserRound },
          { label: "Clinical role", value: "Psychiatry", icon: Stethoscope },
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
        title: "App experience",
        rows: [
          { label: "Home modules", value: "Recent", icon: PanelTop },
          { label: "Favourites", value: "Protocols", icon: Sparkles },
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
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition shadow-[var(--shadow-inset)]",
        active
          ? "border-[color:var(--clinical-accent)]/30 bg-[color:var(--app-shell)] text-white shadow-[0_8px_20px_rgba(0,108,103,0.18)]"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
    </span>
  );
}

function DesktopNav({ active }: { active: string }) {
  return (
    <nav className="space-y-1 p-3">
      <button
        type="button"
        aria-label="Close settings"
        className="mb-4 grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)] transition hover:bg-[color:var(--surface-subtle)]"
      >
        <X className="h-5 w-5" strokeWidth={1.8} />
      </button>
      {navItems.map(({ label, icon: Icon }) => {
        const selected = label === active;
        return (
          <button
            key={label}
            type="button"
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative grid min-h-10 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-transparent px-3 text-left text-sm font-medium transition",
              selected
                ? "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]",
            )}
          >
            <Icon className={cn("h-4 w-4", selected && "text-[color:var(--clinical-accent)]")} strokeWidth={1.8} />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SummaryTile({ row, index, tone }: { row: SettingsRow; index: number; tone: Concept["tone"] }) {
  const Icon = row.icon ?? Settings;
  const accent =
    (tone === "balanced" && index === 1) || (tone === "compact" && index === 1) || (tone === "premium" && index === 0);

  return (
    <button
      type="button"
      className={cn(
        "relative grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-lg border px-3 text-left transition",
        tone === "compact" ? "min-h-[70px]" : "",
        tone === "premium" ? "min-h-[82px]" : "shadow-[var(--shadow-tight)]",
        accent
          ? "border-[color:var(--clinical-accent)]/24 bg-[color:var(--clinical-accent-soft)]/42 shadow-[0_12px_26px_rgba(15,31,38,0.09)] before:absolute before:bottom-3 before:left-0 before:top-3 before:w-0.5 before:rounded-full before:bg-[color:var(--clinical-accent)]"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-raised)]",
      )}
    >
      <IconFrame icon={Icon} active={accent} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-[color:var(--text-muted)]">{row.label}</span>
        <span className="mt-1 block truncate text-sm font-semibold text-[color:var(--text-heading)]">{row.value}</span>
      </span>
    </button>
  );
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 text-2xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
      {children}
    </span>
  );
}

function DesktopProfileStrip({ tone }: { tone: Concept["tone"] }) {
  return (
    <button
      type="button"
      className={cn(
        "mt-4 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-4 text-left",
        tone === "compact" ? "min-h-[76px]" : tone === "premium" ? "min-h-[88px]" : "min-h-[78px]",
        tone === "compact"
          ? "border-[color:var(--clinical-accent)]/16 bg-[color:var(--surface-inset)] shadow-[var(--shadow-tight)]"
          : tone === "premium"
            ? "border-[color:var(--clinical-accent)]/18 bg-[color:var(--surface-lux)] shadow-[0_12px_30px_rgba(15,31,38,0.08)]"
            : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)] ring-1 ring-white/45",
      )}
    >
      <span
        className={cn(
          "relative grid shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent)]/10 bg-[color:var(--clinical-accent-soft)] font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]",
          tone === "premium" ? "h-14 w-14 text-base" : "h-12 w-12 text-sm",
        )}
      >
        DS
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
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

function SettingRow({ row, tone }: { row: SettingsRow; tone: Concept["tone"] }) {
  const Icon = row.icon;
  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] text-left last:border-b-0",
        tone === "compact" ? "min-h-[46px] py-1.5" : "min-h-[48px] py-1.5",
      )}
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
          <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" strokeWidth={1.8} />
        </span>
      )}
    </button>
  );
}

function DesktopModal({ concept }: { concept: Concept }) {
  return (
    <section
      className={cn(
        "h-[800px] w-[880px] overflow-hidden rounded-lg border bg-[color:var(--surface)] shadow-[0_18px_52px_rgba(15,31,38,0.11)] ring-1 ring-white/45",
        concept.tone === "premium" ? "border-[color:var(--clinical-accent)]/15" : "border-[color:var(--border-lux)]",
      )}
    >
      <div className="grid h-full grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--border)] bg-[color:var(--surface-lux)]">
          <DesktopNav active={concept.activeNav} />
        </aside>
        <div className="min-w-0 overflow-hidden px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                {concept.eyebrow}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[color:var(--text-heading)]">
                {concept.modalTitle ?? concept.activeNav}
              </h2>
            </div>
            <span className="rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
              Clinician account
            </span>
          </div>

          <DesktopProfileStrip tone={concept.tone} />

          <div className={cn("mt-4 grid gap-3 sm:grid-cols-3", concept.tone === "compact" && "gap-2.5")}>
            {concept.summary.map((row, index) => (
              <SummaryTile key={row.label} row={row} index={index} tone={concept.tone} />
            ))}
          </div>

          <div
            className={cn(
              "mt-4 h-[524px] overflow-hidden rounded-lg border bg-[color:var(--surface-lux)] px-5 shadow-[var(--shadow-lux)] ring-1 ring-white/35",
              concept.tone === "premium"
                ? "border-[color:var(--clinical-accent)]/15"
                : "border-[color:var(--border-lux)]",
            )}
          >
            {concept.sections.map((section, index) => (
              <div
                key={section.title}
                className={cn(
                  index > 0 && "border-t border-[color:var(--border)]",
                  concept.tone === "compact" ? "pt-3" : "pt-4",
                )}
              >
                <h3
                  className={cn(
                    "text-sm font-semibold text-[color:var(--text-heading)]",
                    index === 0 ? (concept.tone === "compact" ? "pt-3" : "pt-4") : "",
                  )}
                >
                  {section.title}
                </h3>
                <div className={cn(concept.tone === "compact" ? "mt-1.5" : "mt-2")}>
                  {section.rows.map((row) => (
                    <SettingRow key={row.label} row={row} tone={concept.tone} />
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
    <div className="flex h-9 items-center justify-between px-5 text-2xs font-bold text-[color:var(--text-heading)]">
      <span>9:41</span>
      <span className="flex items-center gap-1.5 text-[color:var(--text-heading)]">
        <Signal className="h-3.5 w-3.5" strokeWidth={2} />
        <Wifi className="h-3.5 w-3.5" strokeWidth={2} />
        <BatteryFull className="h-4 w-4" strokeWidth={2} />
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

function PhoneProfileRow({ tone }: { tone: Concept["tone"] }) {
  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 text-left",
        tone === "premium"
          ? "min-h-[82px] border-[color:var(--clinical-accent)]/18 bg-[color:var(--surface-lux)] shadow-[0_10px_24px_rgba(15,31,38,0.08)]"
          : "min-h-[74px] border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)] ring-1 ring-white/40",
      )}
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent)]/10 bg-[color:var(--clinical-accent-soft)] text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        DS
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">Dr Simpson</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--text-muted)]">
          Consultant psychiatrist, WA
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-[color:var(--text-muted)]" strokeWidth={1.8} />
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
            "inline-flex min-h-8 items-center justify-center rounded-lg border px-2 text-2xs font-semibold shadow-[var(--shadow-inset)]",
            index === 0
              ? "border-[color:var(--clinical-accent)]/25 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
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
      <h2 className="mb-1.5 px-1 text-2xs font-semibold tracking-[0.02em] text-[color:var(--text-soft)]">
        {section.title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-lux)]">
        {section.rows.map((row, index) => {
          const Icon = row.icon ?? Settings;
          return (
            <button
              key={row.label}
              type="button"
              className="grid min-h-[51px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 text-left last:border-b-0"
            >
              <IconFrame icon={Icon} active={index === 0 && section.title === "Clinical defaults"} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[color:var(--text-heading)]">{row.label}</span>
              </span>
              <span className="inline-flex min-w-0 items-center gap-2 text-right text-xs font-medium text-[color:var(--text-muted)]">
                <span className="max-w-[86px] truncate">{row.value}</span>
                <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} />
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
    <section className="h-[760px] w-full max-w-[350px] rounded-[42px] bg-[color:var(--app-shell)] p-2 shadow-[0_22px_55px_rgba(15,31,38,0.18)]">
      <div className="relative h-full overflow-hidden rounded-[34px] bg-[color:var(--surface-raised)]">
        <PhoneStatusBar />
        <PhoneBackdrop />

        <div className="absolute inset-x-3 top-11 rounded-[24px] border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 pb-4 pt-3 shadow-[0_18px_42px_rgba(15,31,38,0.14)] ring-1 ring-white/45">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <span />
            <p className="text-base font-semibold leading-6 text-[color:var(--text-heading)]">Settings</p>
            <button
              type="button"
              aria-label="Close settings"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]"
            >
              <X className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="mt-3 space-y-4">
            <PhoneProfileRow tone={concept.tone} />
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
          "fixed inset-0 z-[2147483647] overflow-auto px-4 py-7 text-[color:var(--text-heading)] sm:px-8",
        )}
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
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
      <div className="lg:hidden">
        <PhoneSheet concept={concept} />
      </div>
      <div className="hidden lg:block">
        <DesktopModal concept={concept} />
      </div>
    </BoardShell>
  );
}
