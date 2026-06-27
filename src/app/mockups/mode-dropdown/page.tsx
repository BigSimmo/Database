import {
  BookOpenCheck,
  ChevronDown,
  Check,
  FileText,
  Heart,
  ListChecks,
  Menu,
  Moon,
  Search,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";

const modes = [
  {
    label: "Answer",
    description: "Source-backed clinical answer",
    icon: Sparkles,
    active: true,
  },
  {
    label: "Documents",
    description: "Search indexed PDFs and notes",
    icon: FileText,
    active: false,
  },
  {
    label: "Prescribing",
    description: "Medication checks and guidance",
    icon: Stethoscope,
    active: false,
  },
  {
    label: "Evidence",
    description: "Tables, quotes, images, PDFs",
    icon: ListChecks,
    active: false,
  },
  {
    label: "Favourites",
    description: "Saved sources and workflows",
    icon: Heart,
    active: false,
  },
  {
    label: "Profile",
    description: "Home, preferences, review queue",
    icon: UserRound,
    active: false,
  },
] as const;

function HeaderMockup({ expanded = false, compact = false }: { expanded?: boolean; compact?: boolean }) {
  const activeMode = modes.find((mode) => mode.active) ?? modes[0];
  const ActiveIcon = activeMode.icon;

  return (
    <div
      className={[
        "relative rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
        expanded ? "z-30 mb-64" : "",
      ].join(" ")}
    >
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-lux)]/95 px-3 py-2 text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl sm:px-4 lg:px-6">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2">
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] lg:hidden"
            aria-label="Open Clinical Guide menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative z-20 mx-auto sm:mx-0">
            <button
              type="button"
              className="inline-grid h-11 min-w-[10.75rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] sm:min-w-[14rem]"
              aria-haspopup="true"
              aria-expanded={expanded}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]">
                <ActiveIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Mode
                </span>
                <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                  {activeMode.label}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" />
            </button>

            {expanded ? (
              <div
                role="group"
                className="absolute left-1/2 top-[calc(100%+0.5rem)] z-10 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1.5 text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-white/25 backdrop-blur-md dark:ring-white/10 sm:left-0 sm:translate-x-0"
              >
                {modes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.label}
                      type="button"
                      aria-pressed={mode.active}
                      className={[
                        "grid min-h-[3.25rem] w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left transition",
                        mode.active
                          ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-8 w-8 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                          mode.active
                            ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--surface)]"
                            : "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{mode.label}</span>
                        <span className="block truncate text-[11px] font-medium text-[color:var(--text-soft)]">
                          {mode.description}
                        </span>
                      </span>
                      {mode.active ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {compact ? null : (
              <button
                type="button"
                className="hidden min-h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] sm:inline-flex"
              >
                <BookOpenCheck className="h-4 w-4" />
                All documents
              </button>
            )}
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              aria-label="Toggle theme"
            >
              <Moon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className={compact ? "px-3 pb-3 pt-5" : "px-6 pb-6 pt-8"}>
        <form className="mx-auto flex min-h-14 max-w-4xl items-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 shadow-[var(--shadow-inset)]">
          <Search className="h-5 w-5 shrink-0 text-[color:var(--text-soft)]" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--text-soft)]">
            Ask a clinical question...
          </span>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--clinical-chat-teal)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-tight)]"
          >
            Answer
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ModeDropdownMockupPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Clinical KB mockup
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)]">
            Search mode dropdown
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            The existing Answer/Documents segmented control is replaced by one compact mode button that can scale to
            more app modes without widening the top bar.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <HeaderMockup expanded />
            <HeaderMockup />
          </div>

          <aside className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Interaction notes</h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[color:var(--text-muted)]">
              <p>
                The selected mode owns the icon, label, composer placeholder, and submit text. The menu uses radio
                semantics so only one mode is active at a time.
              </p>
              <p>
                New modes can be added as rows without changing the header width. The active row keeps the current teal
                treatment from the old Answer tab.
              </p>
            </div>
          </aside>
        </section>

        <section className="max-w-sm">
          <HeaderMockup compact />
        </section>
      </div>
    </main>
  );
}
