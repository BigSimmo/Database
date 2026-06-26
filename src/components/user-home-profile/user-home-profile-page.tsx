import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpenCheck,
  Check,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Folder,
  Home,
  Lock,
  LogOut,
  MessageSquare,
  Palette,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Star,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

const navItems = [
  ["Home", Home, true],
  ["Chat", MessageSquare, false],
  ["Documents", Folder, false],
  ["Favourites", Star, false],
  ["Tools", Wrench, false],
  ["Settings", Settings, false],
] as const;

const profileFields = [
  ["Role", "Consultant psychiatrist"],
  ["Workspace", "Clinical KB Database"],
  ["Organisation", "Private workspace"],
  ["Primary use", "Guideline search and source-backed answers"],
] as const;

const settingsCards: Array<{
  title: string;
  body: string;
  status: string;
  icon: LucideIcon;
  tone: "default" | "success" | "warning";
}> = [
  {
    title: "Profile details",
    body: "Name, clinical role, workspace label, and default contact identity.",
    status: "Complete",
    icon: User,
    tone: "success",
  },
  {
    title: "Appearance",
    body: "Theme, compact density, answer typography, and reduced motion preference.",
    status: "System",
    icon: Palette,
    tone: "default",
  },
  {
    title: "Notifications",
    body: "Source review reminders, import status, failed jobs, and governance prompts.",
    status: "3 enabled",
    icon: Bell,
    tone: "default",
  },
  {
    title: "Privacy and data",
    body: "Query history, saved searches, exports, retention windows, and local privacy controls.",
    status: "Review",
    icon: Shield,
    tone: "warning",
  },
  {
    title: "Clinical preferences",
    body: "Default jurisdiction, source weighting, answer mode, and safety note behaviour.",
    status: "WA default",
    icon: SlidersHorizontal,
    tone: "default",
  },
  {
    title: "Security",
    body: "Session devices, account access, recovery settings, and workspace lock state.",
    status: "Protected",
    icon: Lock,
    tone: "success",
  },
];

const recentWork = [
  ["Clozapine monitoring source review", "Opened 12 min ago", "Review due"],
  ["Lithium renal safety answer", "Copied with citations", "Source-backed"],
  ["ECT consent pathway", "Added to favourites", "Current"],
  ["Acamprosate prescribing page", "Viewed from medication search", "Reviewed"],
] as const;

const quickActions = [
  ["New source-backed chat", MessageSquare],
  ["Upload documents", FileText],
  ["Review source reminders", BookOpenCheck],
  ["Open data controls", Database],
] as const;

function StatusPill({ children, tone = "default" }: { children: string; tone?: "default" | "success" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold shadow-[var(--shadow-inset)]",
        tone === "success" &&
          "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
        tone === "warning" &&
          "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
        tone === "default" && "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function IconButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-4 shadow-[var(--shadow-inset)] lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal)] text-sm font-bold text-white shadow-[var(--shadow-tight)]">
          KB
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Clinical KB</p>
          <p className="truncate text-xs font-medium text-[color:var(--text-soft)]">Private workspace</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {navItems.map(([label, Icon, active]) => (
          <button
            key={label}
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
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-3 shadow-[var(--shadow-inset)]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" />
          <p className="text-sm font-bold text-[color:var(--text-heading)]">Source review reminders</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-[color:var(--text)]">
          Six saved items need a provenance or review-date check before reuse.
        </p>
      </div>

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

function ProfileSummary() {
  return (
    <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-[color:var(--app-shell)] text-xl font-semibold text-white shadow-[var(--shadow-tight)]">
            JS
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                Good afternoon, Dr Simpson
              </h1>
              <StatusPill tone="success">Verified</StatusPill>
            </div>
            <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
              Your home page keeps account settings, clinical preferences, recent work, source review prompts, and data
              controls in one calm workspace after login.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-tight)] hover:bg-[color:var(--primary-strong)]"
              >
                <Settings className="h-4 w-4" />
                Edit settings
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              >
                <MessageSquare className="h-4 w-4" />
                Start chat
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
          <p className="text-xs font-bold uppercase text-[color:var(--text-soft)]">Account status</p>
          <div className="mt-3 space-y-2">
            {[
              ["Session", "Active"],
              ["Data mode", "Private"],
              ["Default source", "Current first"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-lg bg-[color:var(--surface-inset)] px-3 py-2"
              >
                <span className="text-sm font-medium text-[color:var(--text-muted)]">{label}</span>
                <span className="text-sm font-semibold text-[color:var(--text-heading)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsCard({ card }: { card: (typeof settingsCards)[number] }) {
  const Icon = card.icon;

  return (
    <button
      type="button"
      className="group grid min-h-[9rem] grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 text-left shadow-[var(--shadow-tight)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:shadow-[var(--shadow-hover)]"
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-[color:var(--text-heading)]">{card.title}</span>
          <StatusPill tone={card.tone}>{card.status}</StatusPill>
        </span>
        <span className="mt-2 block text-sm leading-6 text-[color:var(--text-muted)]">{card.body}</span>
      </span>
      <ChevronRight className="mt-3 h-4 w-4 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--text)]" />
    </button>
  );
}

function RightColumn() {
  return (
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Privacy and data</h2>
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["Query history", "On, private"],
            ["Saved searches", "8 retained"],
            ["Export access", "Ready"],
            ["Local auth", "Session guarded"],
          ].map(([label, value]) => (
            <button
              key={label}
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left text-sm shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
            >
              <span className="font-medium text-[color:var(--text-muted)]">{label}</span>
              <span className="font-semibold text-[color:var(--text-heading)]">{value}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Quick actions</h2>
        </div>
        <div className="mt-3 grid gap-2">
          {quickActions.map(([label, Icon]) => (
            <button
              key={label}
              type="button"
              className="flex min-h-12 items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-4 shadow-[var(--shadow-inset)]">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-[color:var(--warning)]" />
          <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Clinical note</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
          Keep source review reminders visible on the home page so saved answers are not reused without provenance
          checks.
        </p>
      </section>
    </aside>
  );
}

export default function UserHomeProfilePage() {
  return (
    <main id="main-content" className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] px-4 py-3 shadow-[var(--shadow-inset)] backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
                <input
                  aria-label="Search profile, settings, and recent work"
                  placeholder="Search settings"
                  className="min-h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-10 pr-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
                />
              </div>
              <IconButton icon={Bell} label="Open notifications" />
              <IconButton icon={Settings} label="Open settings" />
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--app-shell)] text-sm font-semibold text-white">
                JS
              </span>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
            <ProfileSummary />

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                        <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Profile</h2>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                        Simple account identity and default clinical workspace context.
                      </p>
                    </div>
                    <StatusPill tone="success">Ready after login</StatusPill>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {profileFields.map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
                      >
                        <p className="text-xs font-bold uppercase text-[color:var(--text-soft)]">{label}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                        <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Settings</h2>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                        ChatGPT-style rows with clear status, compact controls, and quick access to deeper settings.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
                    >
                      Manage all
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {settingsCards.map((card) => (
                      <SettingsCard key={card.title} card={card} />
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                    <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Recent clinical work</h2>
                  </div>
                  <div className="mt-3 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                    {recentWork.map(([title, detail, status]) => (
                      <button
                        key={title}
                        type="button"
                        className="grid w-full gap-2 px-3 py-3 text-left transition hover:bg-[color:var(--surface-subtle)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
                          <span className="mt-1 block text-xs font-medium text-[color:var(--text-muted)]">
                            {detail}
                          </span>
                        </span>
                        <StatusPill tone={status === "Review due" ? "warning" : "success"}>{status}</StatusPill>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <RightColumn />
            </section>

            <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  <h2 className="text-base font-semibold text-[color:var(--text-heading)]">
                    Recommended home structure
                  </h2>
                </div>
                <StatusPill tone="success">Mockup direction</StatusPill>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  ["Start with identity", "Show the signed-in user, workspace, role, and session safety before tools."],
                  ["Keep settings scannable", "Use rows and compact cards rather than a decorative dashboard grid."],
                  [
                    "Surface governance",
                    "Keep source review and privacy controls visible without turning them into warnings everywhere.",
                  ],
                ].map(([title, body]) => (
                  <article
                    key={title}
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
                  >
                    <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{body}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
