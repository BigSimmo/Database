import {
  BookOpenCheck,
  Clock3,
  FileText,
  Filter,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";

const recentSearches = [
  "lithium renal monitoring",
  "clozapine ANC thresholds",
  "acamprosate renal dose",
  "ECT consent capacity",
  "rapid tranquillisation ECG",
] as const;

const sourceCards = [
  ["Lithium monitoring guideline", "Renal, thyroid, calcium, toxicity warning signs", "Updated 2d ago"],
  ["Clozapine shared-care protocol", "ANC schedule, myocarditis screen, metabolic monitoring", "Review due"],
  ["Acamprosate prescribing note", "Dose thresholds, contraindications, PBS access", "Current"],
] as const;

function HeaderMockup() {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)]/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl sm:px-4 lg:px-6">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-2">
        <button
          type="button"
          aria-label="Open Clinical Guide menu"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Current app mode: Answer"
          className="inline-grid h-11 min-w-[10rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] sm:min-w-[14rem]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Mode
            </span>
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">Answer</span>
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label="Open document scope"
            className="hidden min-h-10 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)] sm:inline-flex"
          >
            <BookOpenCheck className="h-4 w-4" />
            All sources
          </button>
          <button
            type="button"
            aria-label="Switch theme"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
          >
            <Moon className="h-4 w-4" />
          </button>
          <span className="relative hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-xs font-bold text-[color:var(--clinical-chat-teal)] sm:grid">
            AK
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--clinical-chat-ready)]" />
          </span>
        </div>
      </div>
    </header>
  );
}

function SidebarMockup() {
  return (
    <aside className="hidden border-r border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)] lg:flex lg:min-h-screen lg:w-80 lg:flex-col">
      <div className="border-b border-[color:var(--border)] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Clinical Guide</p>
            <p className="truncate text-xs font-medium text-[color:var(--text-soft)]">Source-backed search</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-3 text-sm font-semibold text-white shadow-[var(--shadow-tight)]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>

        <section className="space-y-2">
          <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Recent chats
          </h2>
          {recentSearches.slice(0, 4).map((search) => (
            <button
              key={search}
              type="button"
              className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
            >
              <Clock3 className="h-4 w-4 text-[color:var(--text-soft)]" />
              <span className="truncate">{search}</span>
            </button>
          ))}
        </section>
      </div>
    </aside>
  );
}

function RecentSearchRail() {
  return (
    <div className="pointer-events-auto mx-auto mb-2 flex max-w-3xl items-center gap-2 px-1 lg:max-w-4xl">
      <span className="hidden shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)] sm:inline-flex">
        <Clock3 className="h-3.5 w-3.5" />
        Recent
      </span>
      <div className="polished-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-0.5 pb-1">
        {recentSearches.map((search) => (
          <button
            key={search}
            type="button"
            className="inline-flex min-h-9 max-w-[15rem] shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)]/78 px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] backdrop-blur transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-chat-teal)]" />
            <span className="truncate">{search}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Hide recent searches"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function BottomComposerMockup() {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-30 sm:bottom-4 lg:left-[calc(20rem+2rem)] lg:right-8">
      <RecentSearchRail />
      <form className="pointer-events-auto mx-auto flex min-h-[56px] max-w-3xl items-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 shadow-[var(--shadow-lux)] ring-1 ring-white/35 backdrop-blur-xl lg:max-w-4xl">
        <button
          type="button"
          aria-label="Open daily actions"
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
        >
          <Plus className="h-5 w-5" />
        </button>
        <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
          <input
            aria-label="Search indexed guidelines by question or keyword"
            placeholder="Ask a clinical question..."
            className="min-h-[44px] min-w-0 flex-1 bg-transparent px-2 text-base font-medium text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
          />
        </label>
        <button
          type="button"
          aria-label="Voice input"
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
        >
          <Mic className="h-4.5 w-4.5" />
        </button>
        <button
          type="submit"
          aria-label="Generate source-backed answer"
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function SourcePreviewGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {sourceCards.map(([title, body, meta]) => (
        <article
          key={title}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
              <FileText className="h-4 w-4" />
            </span>
            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-soft)]">
              {meta}
            </span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[color:var(--text-heading)]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{body}</p>
        </article>
      ))}
    </div>
  );
}

export default function RecentSearchesBottomMockupPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[20rem_minmax(0,1fr)]">
        <SidebarMockup />
        <div className="min-w-0">
          <HeaderMockup />
          <section className="mx-auto max-w-7xl space-y-5 px-3 py-4 pb-36 sm:px-4 sm:py-5 sm:pb-40 lg:px-8">
            <div className="grid min-h-[calc(100dvh-14rem)] place-items-center">
              <div className="w-full max-w-4xl space-y-5">
                <div className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]">
                      <Search className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-md border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--success)]">
                      Ready
                    </span>
                    <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-soft)]">
                      All sources
                    </span>
                  </div>
                  <h1 className="mt-4 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                    Ask from your indexed clinical sources
                  </h1>
                  <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
                    Recent searches sit near the bottom composer as low-emphasis shortcuts, leaving the answer canvas
                    quiet until the clinician starts a new query.
                  </p>
                </div>

                <SourcePreviewGrid />

                <div className="hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)] sm:block">
                  <div className="flex flex-wrap items-center gap-2">
                    <Filter className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                    <p className="text-sm font-semibold text-[color:var(--text-heading)]">
                      Scope and mode stay primary
                    </p>
                    <span className="rounded-md bg-[color:var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-soft)]">
                      Recent is secondary
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <BottomComposerMockup />
        </div>
      </div>
    </main>
  );
}
