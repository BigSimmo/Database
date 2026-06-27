import {
  Bell,
  BookOpen,
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Home,
  KeyRound,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

const primaryActions: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  tone: "primary" | "neutral";
}> = [
  {
    title: "Ask",
    body: "Clinical question",
    icon: MessageSquare,
    tone: "primary",
  },
  {
    title: "Sources",
    body: "Guidelines and evidence",
    icon: BookOpen,
    tone: "neutral",
  },
  {
    title: "Review",
    body: "Source queue",
    icon: ClipboardCheck,
    tone: "neutral",
  },
  {
    title: "Settings",
    body: "Defaults",
    icon: Settings,
    tone: "neutral",
  },
];

const recentWork = [
  {
    title: "Lithium monitoring in adults",
    detail: "Guidelines - RANZCP",
    time: "11:32 am",
    status: "Current",
  },
  {
    title: "ECT indications and safety",
    detail: "Guidelines - RANZCP",
    time: "Yesterday",
    status: "Saved",
  },
  {
    title: "Antipsychotic metabolic monitoring",
    detail: "Guidelines - RACGP",
    time: "2 days ago",
    status: "Reviewed",
  },
] as const;

const contextChips = ["WA", "Adults", "Conservative", "Current sources"] as const;

const reviewQueue = [
  {
    title: "NICE NG222 - Depression in adults",
    priority: "High priority",
    due: "1d",
  },
  {
    title: "APA Practice Guideline - Schizophrenia",
    priority: "Medium priority",
    due: "2d",
  },
  {
    title: "CANMAT 2023 Update - Bipolar Disorder",
    priority: "Medium priority",
    due: "3d",
  },
] as const;

const savedProtocols = [
  {
    title: "Depression management",
    detail: "WA Health",
  },
  {
    title: "Psychosis first episode",
    detail: "RANZCP",
  },
  {
    title: "Lithium monitoring",
    detail: "RANZCP",
  },
  {
    title: "ECT quick reference",
    detail: "APA",
  },
] as const;

const importStatus = [
  {
    title: "RANZCP guidelines",
    detail: "Updated 2h ago",
    status: "Ready",
  },
  {
    title: "NICE updates",
    detail: "Updated 1d ago",
    status: "Ready",
  },
  {
    title: "APA guidelines",
    detail: "In progress",
    status: "Reviewing",
  },
  {
    title: "Cochrane reviews",
    detail: "Queued",
    status: "Queued",
  },
] as const;

const preferenceSummary = [
  ["Jurisdiction", "WA"],
  ["Population", "Adults"],
  ["Answer style", "Conservative"],
  ["Source policy", "Current sources"],
] as const;

const preferenceRows: Array<{
  title: string;
  body: string;
  status: string;
  icon: LucideIcon;
}> = [
  {
    title: "Clinical defaults",
    body: "Adults 18+, WA region, current reviewed sources first",
    status: "Edit",
    icon: SlidersHorizontal,
  },
  {
    title: "Privacy and governance",
    body: "No patient identifiers on home, citation trail preserved",
    status: "On",
    icon: ShieldCheck,
  },
  {
    title: "Session security",
    body: "Current device protected with guarded local auth",
    status: "Protected",
    icon: KeyRound,
  },
  {
    title: "Clinical notifications",
    body: "Only source review, import status, and governance prompts",
    status: "Clinical only",
    icon: Bell,
  },
] as const;

const desktopNav: Array<{
  title: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
}> = [
  { title: "Home", icon: Home, active: true },
  { title: "Ask", icon: MessageSquare },
  { title: "Sources", icon: BookOpen },
  { title: "Review", icon: ClipboardCheck, badge: "3" },
  { title: "Protocols", icon: BookOpenCheck },
  { title: "Import", icon: FileText },
  { title: "Settings", icon: Settings },
  { title: "Account", icon: UserRound },
];

const mobileNav = desktopNav.filter(({ title }) => ["Home", "Ask", "Sources", "Review", "Settings"].includes(title));

const clinicalState = [
  ["Role", "Consultant psychiatrist"],
  ["Jurisdiction", "Western Australia"],
  ["Answer mode", "Source-backed guidance"],
  ["Source policy", "Current first"],
] as const;

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "success" | "warning" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold shadow-[var(--shadow-inset)]",
        tone === "neutral" && "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
        tone === "success" &&
          "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
        tone === "warning" &&
          "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
        tone === "primary" &&
          "border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
      )}
    >
      {children}
    </span>
  );
}

function DesktopSidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-4 shadow-[var(--shadow-inset)] lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
          <BookOpenCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Clinical KB</p>
          <p className="truncate text-xs font-medium text-[color:var(--text-soft)]">Private workspace</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {desktopNav.map(({ title, icon: Icon, active, badge }) => (
          <button
            key={title}
            type="button"
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
              active
                ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="min-w-0 flex-1 text-left">{title}</span>
            {badge ? <StatusPill tone="warning">{badge}</StatusPill> : null}
          </button>
        ))}
      </nav>

      <section className="mt-auto rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-3 shadow-[var(--shadow-inset)]">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[color:var(--warning)]" />
          <h2 className="text-sm font-bold text-[color:var(--text-heading)]">Review attention</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-[color:var(--text)]">
          Three saved sources need a date or provenance check before reuse.
        </p>
      </section>

      <button
        type="button"
        className="mt-3 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}

function DesktopTopBar() {
  return (
    <header className="sticky top-0 z-10 hidden border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] px-8 py-3 shadow-[var(--shadow-inset)] backdrop-blur-xl lg:block">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
          <span className="sr-only">Search clinical work and settings</span>
          <input
            placeholder="Search clinical work, settings, and sources"
            className="min-h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-10 pr-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
          />
        </label>
        <button
          type="button"
          aria-label="Open notifications"
          className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
        >
          <Bell className="h-4 w-4" />
        </button>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--app-shell)] text-sm font-semibold text-white">
          JS
        </span>
      </div>
    </header>
  );
}

function MobileHeader() {
  return (
    <header className="lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[color:var(--text-heading)]">Clinical KB</p>
            <p className="truncate text-xs font-semibold text-[color:var(--text-soft)]">Private workspace</p>
          </div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--surface-subtle)] text-sm font-semibold text-[color:var(--clinical-chat-teal)]">
          JS
        </span>
      </div>
    </header>
  );
}

function HeroHome() {
  return (
    <section className="pt-4 lg:pt-0">
      <p className="text-sm font-medium text-[color:var(--text-muted)] sm:text-base">Good afternoon,</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-4xl lg:text-5xl">
        Dr Simpson
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[color:var(--text-muted)] sm:mt-3">
        <span className="inline-flex items-center gap-2">
          <UserRound className="h-4 w-4" />
          Consultant psychiatrist
        </span>
        <span className="hidden h-4 w-px bg-[color:var(--border)] sm:block" />
        <span className="inline-flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          WA
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
        <StatusPill tone="primary">Private</StatusPill>
        <StatusPill tone="primary">Current first</StatusPill>
        <StatusPill tone="primary">No PHI</StatusPill>
      </div>
    </section>
  );
}

function ClinicalComposer() {
  return (
    <section className="pt-4 lg:pt-6">
      <div className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[color:var(--text-heading)] sm:text-lg">
              Ask with clinical context
            </h2>
            <p className="mt-1 hidden text-sm leading-5 text-[color:var(--text-muted)] sm:block">
              Start source-backed answers with your preferred jurisdiction, population, and safety posture.
            </p>
          </div>
          <span className="hidden shrink-0 sm:inline-flex">
            <StatusPill tone="success">Source-backed</StatusPill>
          </span>
        </div>

        <button
          type="button"
          className="mt-3 grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] sm:min-h-14"
        >
          <MessageSquare className="h-5 w-5 text-[color:var(--clinical-chat-teal)]" />
          <span className="truncate text-sm font-semibold text-[color:var(--text-muted)]">
            Ask about a guideline, medication, protocol, or safety question
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal)] text-white sm:h-9 sm:w-9">
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 sm:mt-3">
          {contextChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex min-h-7 shrink-0 items-center rounded-md border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] px-2.5 text-xs font-semibold text-[color:var(--clinical-chat-teal)] sm:min-h-8 sm:px-3"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrimaryActions() {
  return (
    <section aria-labelledby="quick-actions-heading" className="pt-3 lg:pt-4">
      <h2 id="quick-actions-heading" className="sr-only">
        Quick actions
      </h2>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {primaryActions.map(({ title, body, icon: Icon, tone }) => (
          <button
            key={title}
            type="button"
            className={cn(
              "group flex min-h-16 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center shadow-[var(--shadow-inset)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] sm:min-h-28 sm:p-4",
              tone === "primary"
                ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)]"
                : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)]",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg transition group-hover:scale-105 sm:h-11 sm:w-11",
                tone === "primary"
                  ? "bg-[color:var(--clinical-chat-teal)] text-white"
                  : "bg-[color:var(--surface-subtle)] text-[color:var(--clinical-chat-teal)]",
              )}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="mt-1.5 text-xs font-semibold text-[color:var(--text-heading)] sm:mt-2 sm:text-base">
              {title}
            </span>
            <span className="mt-0.5 hidden text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:block">
              {body}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ClinicalToolkit() {
  return (
    <section className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
            <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Saved protocols</h2>
          </div>
          <button
            type="button"
            className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]"
          >
            Manage
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {savedProtocols.map(({ title, detail }) => (
            <button
              key={title}
              type="button"
              className="min-h-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
            >
              <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{title}</span>
              <span className="mt-1 block text-xs font-medium text-[color:var(--text-muted)]">{detail}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
            <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Import status</h2>
          </div>
          <StatusPill tone="success">Healthy</StatusPill>
        </div>
        <div className="mt-3 divide-y divide-[color:var(--border)]">
          {importStatus.slice(0, 3).map(({ title, detail, status }) => (
            <button
              key={title}
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
                <span className="mt-1 block text-xs font-medium text-[color:var(--text-muted)]">{detail}</span>
              </span>
              <StatusPill tone={status === "Reviewing" ? "warning" : "success"}>{status}</StatusPill>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentWork() {
  return (
    <section className="pt-5 lg:pt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[color:var(--text-heading)] sm:text-xl">Recent work</h2>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 divide-y divide-[color:var(--border)]">
        {recentWork.map(({ title, detail, time, status }, index) => (
          <button
            key={title}
            type="button"
            className={cn(
              "w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left transition hover:bg-[color:var(--surface-subtle)] sm:grid sm:px-2 sm:py-3",
              index > 1 ? "hidden sm:grid" : "grid",
            )}
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] sm:h-12 sm:w-12">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)] sm:text-base">
                {title}
              </span>
              <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
                <span>{detail}</span>
                <span className="h-1 w-1 rounded-full bg-[color:var(--clinical-chat-teal)]" />
                <span>{status}</span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-[color:var(--text-soft)]">
              <span className="hidden sm:inline">{time}</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SourceReviewQueue() {
  return (
    <section className="mt-5 rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-4 shadow-[var(--shadow-inset)] lg:mt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-lg font-semibold text-[color:var(--text-heading)] sm:text-xl">Source review</h2>
          <StatusPill tone="warning">3</StatusPill>
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[color:var(--warning)] transition hover:bg-[color:var(--surface)]"
        >
          View queue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 divide-y divide-[color:var(--clinical-chat-sand-border)]">
        {reviewQueue.map(({ title, priority, due }) => (
          <button
            key={title}
            type="button"
            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"
          >
            <span className="h-2 w-2 rounded-full bg-[color:var(--warning)]" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
              <span className="mt-1 block text-xs font-semibold text-[color:var(--warning)]">
                {priority} - {due}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function PrivacyGovernance() {
  return (
    <section className="mt-4 rounded-lg border border-[color:var(--success-border)] bg-[color:var(--success-soft)] p-4 shadow-[var(--shadow-inset)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--success)] shadow-[var(--shadow-inset)]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Privacy and governance</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            Topic-based home content, visible citation trails, and no patient identifiers.
          </p>
        </div>
      </div>
    </section>
  );
}

function PreferenceRows() {
  return (
    <section className="mt-4 space-y-3">
      {preferenceRows.map(({ title, body, status, icon: Icon }) => (
        <button
          key={title}
          type="button"
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 text-left shadow-[var(--shadow-soft)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-[color:var(--text-heading)]">{title}</span>
            <span className="mt-1 block text-sm leading-5 text-[color:var(--text-muted)]">{body}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-[color:var(--clinical-chat-teal)]">
            <span className="hidden sm:inline">{status}</span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      ))}
    </section>
  );
}

function DesktopRightRail() {
  return (
    <aside className="hidden space-y-4 xl:block xl:sticky xl:top-20 xl:self-start">
      <section className="rounded-lg border border-[color:var(--success-border)] bg-[color:var(--success-soft)] p-4 shadow-[var(--shadow-inset)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--success)] shadow-[var(--shadow-inset)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">Privacy and governance</h2>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
              Topic-based home content, citation trails, and no patient identifiers.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Clinical context</h2>
        </div>
        <dl className="mt-3 divide-y divide-[color:var(--border)]">
          {clinicalState.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-2">
              <dt className="text-xs font-bold uppercase text-[color:var(--text-soft)]">{label}</dt>
              <dd className="text-sm font-semibold text-[color:var(--text-heading)]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Answer preferences</h2>
        </div>
        <dl className="mt-3 divide-y divide-[color:var(--border)]">
          {preferenceSummary.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-sm font-medium text-[color:var(--text-muted)]">{label}</dt>
              <dd className="text-sm font-semibold text-[color:var(--text-heading)]">{value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
        >
          Adjust defaults
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-3 bottom-2 z-20 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-glass)] px-1.5 py-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl lg:hidden"
    >
      <div className="grid grid-cols-5">
        {mobileNav.map(({ title, icon: Icon, active, badge }) => (
          <button
            key={title}
            type="button"
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition",
              active
                ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <span className="relative">
              <Icon className="h-4 w-4" />
              {badge ? (
                <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--warning)] px-1 text-[9px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </span>
            {title}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function UserHomeProfilePage() {
  return (
    <main id="main-content" className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
      <div className="flex min-h-screen">
        <DesktopSidebar />

        <div className="min-w-0 flex-1">
          <DesktopTopBar />

          <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
            <MobileHeader />

            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6">
              <div className="min-w-0">
                <HeroHome />
                <ClinicalComposer />
                <PrimaryActions />
                <RecentWork />
                <SourceReviewQueue />
                <ClinicalToolkit />
                <PrivacyGovernance />
                <PreferenceRows />
              </div>

              <DesktopRightRail />
            </div>
          </div>
        </div>
      </div>

      <MobileNav />
    </main>
  );
}
