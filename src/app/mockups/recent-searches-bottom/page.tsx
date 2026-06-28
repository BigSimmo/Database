import {
  Clock3,
  FileText,
  Filter,
  Search,
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

function RecentSearchRail() {
  return (
    <div className="pointer-events-auto fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl items-center gap-2 px-1 lg:max-w-4xl">
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
    <main className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] text-[color:var(--text)]">
      <section className="mx-auto max-w-7xl space-y-5 px-3 py-6 pb-48 sm:px-4 sm:py-8 lg:px-8">
        <div className="grid min-h-[calc(100dvh-18rem)] place-items-center">
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
                Recent searches sit near the bottom composer as low-emphasis shortcuts, leaving the answer canvas quiet
                until the clinician starts a new query.
              </p>
            </div>

            <SourcePreviewGrid />

            <div className="hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)] sm:block">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">Scope and mode stay primary</p>
                <span className="rounded-md bg-[color:var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-soft)]">
                  Recent is secondary
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <RecentSearchRail />
    </main>
  );
}
