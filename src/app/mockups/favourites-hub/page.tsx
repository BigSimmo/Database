import {
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Folder,
  HeartPulse,
  ListChecks,
  Pill,
  Pin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Stethoscope,
  Tag,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";

const favouriteStats = [
  ["Saved items", "42", "Across sources, medications, documents, searches, and clinical tools"],
  ["Review due", "6", "Favourites with source governance or medication safety checks pending"],
  ["Pinned sets", "5", "Reusable clinical bundles for ward, clinic, and prescribing workflows"],
  ["Used today", "18", "Recently opened, scoped, copied, or added to an answer"],
] as const;

const categoryTabs = [
  ["All", "42"],
  ["Sources", "14"],
  ["Medications", "9"],
  ["Documents", "12"],
  ["Searches", "4"],
  ["Tools", "3"],
] as const;

const favouriteCards = [
  {
    title: "Clozapine physical health protocol",
    type: "Document",
    detail: "Shared-care thresholds, monitoring cadence, escalation actions, and metabolic risk tables.",
    meta: "42 pages - review due - 4 tables",
    accent: "review",
    icon: FileText,
    tags: ["Protocol", "Clozapine", "Monitoring"],
  },
  {
    title: "Lithium monitoring quick set",
    type: "Favourite set",
    detail: "Document scope, renal/thyroid source passages, toxicity warning table, and patient leaflet.",
    meta: "4 saved items - used 2h ago",
    accent: "current",
    icon: Folder,
    tags: ["Pinned", "Shared care", "Renal"],
  },
  {
    title: "Acamprosate",
    type: "Medication",
    detail: "Quick prescribing, renal screen, dose limits, PBS access, and source-backed safety notes.",
    meta: "S4 - reviewed - prescribing page",
    accent: "medication",
    icon: Pill,
    tags: ["AUD", "Dose", "Renal screen"],
  },
  {
    title: "ECT referral and consent pathway",
    type: "Source",
    detail: "Workflow pages, consent checkpoints, capacity considerations, and related forms grouped together.",
    meta: "Current - policy - 12 pages",
    accent: "current",
    icon: BookOpenCheck,
    tags: ["Workflow", "Consent", "Forms"],
  },
] as const;

const savedCollections = [
  ["Ward round", "Lithium, clozapine, rapid tranquillisation, ECT forms", "12 items"],
  ["Prescribing safety", "Dose pages, renal alerts, pregnancy cautions, PBS source checks", "9 items"],
  ["Document QA", "Review due sources, low extraction quality, missing tables", "6 items"],
] as const;

const timelineRows = [
  ["Pinned", "Acamprosate prescribing page", "Medication"],
  ["Added", "Clozapine protocol table 4", "Source"],
  ["Scoped", "Lithium monitoring quick set", "Favourite set"],
  ["Reviewed", "ECT referral and consent pathway", "Document"],
] as const;

const addOptions = [
  ["Current answer", "Save the answer, citations, source previews, and clinical note context.", Sparkles],
  ["Medication page", "Pin dose, safety, monitoring, access, and source review state together.", Pill],
  ["Document or source", "Add a PDF, guideline, table passage, image, or signed source link.", FileText],
  ["Search scope", "Save query, filters, document scope, and ranking explanation as a reusable set.", Search],
] as const;

function toneClass(accent: (typeof favouriteCards)[number]["accent"]) {
  if (accent === "review") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  if (accent === "medication") {
    return "border-[color:var(--primary)]/30 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]";
  }
  return "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
}

function StatCard({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <article className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
      <p className="nums mt-1 text-2xl font-semibold text-[color:var(--text-heading)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{body}</p>
    </article>
  );
}

function ActionButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  const className = primary
    ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-3 text-sm font-semibold text-white shadow-[var(--shadow-tight)] hover:bg-[color:var(--primary-strong)]"
    : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]";

  return (
    <button type="button" className={className}>
      {children}
    </button>
  );
}

function FavouriteCard({ item }: { item: (typeof favouriteCards)[number] }) {
  const Icon = item.icon;
  return (
    <article className="group rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)] transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)]">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/18 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-inset)]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-muted)]">
              {item.type}
            </span>
            <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${toneClass(item.accent)}`}>
              {item.accent === "review" ? "Review due" : item.accent === "medication" ? "Prescribing" : "Current"}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-[color:var(--text-heading)]">{item.title}</h3>
          <p className="mt-1 max-w-[72ch] text-sm leading-6 text-[color:var(--text-muted)]">{item.detail}</p>
          <p className="nums mt-2 text-xs font-semibold text-[color:var(--text-soft)]">{item.meta}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-2 text-[11px] font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
              >
                <Tag className="h-3 w-3 text-[color:var(--clinical-chat-teal)]" />
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            aria-label={`Keep ${item.title} pinned`}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--clinical-chat-teal-soft)]"
          >
            <Star className="h-4 w-4 fill-current" />
          </button>
          <button
            type="button"
            aria-label={`Open ${item.title}`}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function AddOption({ option }: { option: (typeof addOptions)[number] }) {
  const [title, body, Icon] = option;
  return (
    <button
      type="button"
      className="grid min-h-[8rem] gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
      <span className="text-xs leading-5 text-[color:var(--text-muted)]">{body}</span>
    </button>
  );
}

export default function FavouritesHubMockupPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
                  <Star className="h-4.5 w-4.5 fill-current" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Clinical KB favourites mockup
                </p>
              </div>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
                A source-first favourites hub for saved clinical work
              </h1>
              <p className="mt-3 max-w-[78ch] text-base leading-7 text-[color:var(--text-muted)]">
                Save medications, documents, source passages, searches, clinical tools, and reusable bundles into one
                fast workspace without losing review state, provenance, or prescribing safety context.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton primary>
                  <Plus className="h-4 w-4" />
                  Add favourite
                </ActionButton>
                <ActionButton>
                  <Pin className="h-4 w-4" />
                  Manage pinned sets
                </ActionButton>
                <ActionButton>
                  <ShieldAlert className="h-4 w-4" />
                  Review due
                </ActionButton>
              </div>
            </div>
            <aside className="rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-4 shadow-[var(--shadow-inset)]">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4 text-[color:var(--warning)]" />
                <p className="text-sm font-bold text-[color:var(--text-heading)]">Design recommendation</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                Keep favourites as a clinical command centre: quick to add, grouped by workflow, and always showing
                source status before reuse.
              </p>
            </aside>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {favouriteStats.map(([label, value, body]) => (
            <StatCard key={label} label={label} value={value} body={body} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    Browse favourites
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">
                    Saved work, grouped by clinical use
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton>
                    <Filter className="h-4 w-4" />
                    Filters
                    <ChevronDown className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton>
                    <Clock className="h-4 w-4" />
                    Recent first
                  </ActionButton>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
                  <input
                    aria-label="Search favourites"
                    placeholder="Search favourites by medication, document, source, tag, or saved query"
                    className="min-h-[48px] w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-10 pr-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
                  />
                </label>
                <div className="polished-scroll flex gap-2 overflow-x-auto pb-1">
                  {categoryTabs.map(([label, count], index) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={index === 0}
                      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-[var(--shadow-inset)] ${
                        index === 0
                          ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
                      }`}
                    >
                      {label}
                      <span className="nums rounded-md bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-soft)]">
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              {favouriteCards.map((item) => (
                <FavouriteCard key={item.title} item={item} />
              ))}
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Add to favourites</h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                Every primary workspace can save into the hub with the right metadata attached.
              </p>
              <div className="mt-4 grid gap-2">
                {addOptions.map((option) => (
                  <AddOption key={option[0]} option={option} />
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Collections</h2>
              </div>
              <div className="mt-3 space-y-2">
                {savedCollections.map(([title, body, count]) => (
                  <button
                    type="button"
                    key={title}
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-left shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[color:var(--text-heading)]">{title}</span>
                      <span className="nums shrink-0 rounded-md bg-[color:var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-muted)]">
                        {count}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[color:var(--text-muted)]">{body}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Hub structure</h2>
              </div>
              <span className="rounded-md border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--success)]">
                Source-backed by default
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["Save anywhere", "Add from answer actions, source cards, medication pages, document rows, and search scope.", Target],
                ["Reuse safely", "Open with review status, original citations, filters, and document scope already attached.", BadgeCheck],
                ["Stay organised", "Collections, pinned sets, recency, tags, and review queues keep high-volume libraries scannable.", Database],
              ].map(([title, body, Icon]) => (
                <article
                  key={title as string}
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
                >
                  <Icon className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  <h3 className="mt-2 text-sm font-semibold text-[color:var(--text-heading)]">{title as string}</h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{body as string}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
              <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Recent activity</h2>
            </div>
            <div className="mt-3 space-y-2">
              {timelineRows.map(([action, title, type]) => (
                <div
                  key={`${action}:${title}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--clinical-chat-ready)]" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      {action} - {type}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div>
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">Clinical guardrails</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                Favourites should make repeat work faster without stripping away the source trail.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Medication favourites", "Always show dose limiter, review state, and contraindication summary.", Stethoscope],
                ["Document favourites", "Keep page, chunk, table/image counts, review status, and best passage.", BookOpen],
                ["Saved searches", "Persist query mode, filters, scope, result ordering, and coverage notes.", Search],
              ].map(([title, body, Icon]) => (
                <article
                  key={title as string}
                  className="rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-3 shadow-[var(--shadow-inset)]"
                >
                  <Icon className="h-4 w-4 text-[color:var(--warning)]" />
                  <h3 className="mt-2 text-sm font-semibold text-[color:var(--text-heading)]">{title as string}</h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text)]">{body as string}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
