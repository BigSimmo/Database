import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  Gauge,
  HeartPulse,
  ListChecks,
  MonitorCheck,
  Pill,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const quickRows = [
  ["Indication", "Alcohol abstinence maintenance"],
  ["Form", "333 mg enteric-coated tablet"],
  ["Typical dose", "666 mg three times daily with meals"],
  ["Maximum", "1998 mg/day"],
  ["Schedule", "S4"],
  ["Access", "Streamlined PBS authority"],
] as const;

const safetyRows = [
  ["Renal", "Do not use if renal insufficiency is present; check serum creatinine before prescribing."],
  ["Hepatic", "Avoid severe hepatic failure. Mild to moderate impairment still needs review."],
  ["Pregnancy", "Contraindicated in pregnancy and breastfeeding in the reviewed PI."],
  ["Age", "Avoid under 18 and over 65 where safety and efficacy are not established."],
] as const;

const monitoringRows = [
  ["Baseline", "Renal function, hepatic status, pregnancy or lactation status, alcohol withdrawal completion."],
  ["Early review", "Adherence, gastrointestinal intolerance, mood symptoms, ongoing alcohol use."],
  ["Ongoing", "Renal function if clinical status changes; continue psychosocial support."],
] as const;

const sourceRows = [
  ["Australian PI", "Reviewed source - Campral product information"],
  ["PBS", "Streamlined authority item present"],
  ["Clinical KB", "Related guideline passages available"],
] as const;

const navItems = ["Summary", "Dose", "Safety", "Monitoring", "Sources"] as const;

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warn" | "ok" }) {
  const toneClass =
    tone === "warn"
      ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
      : tone === "ok"
        ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)]";

  return (
    <div className={`rounded-lg border px-3 py-2 shadow-[var(--shadow-inset)] ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase text-current/70">{label}</p>
      <p className="nums mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function SearchResultMock({ variant }: { variant: "compact" | "split" | "clinical" }) {
  const resultClass =
    variant === "split"
      ? "grid gap-3 lg:grid-cols-[1fr_22rem]"
      : variant === "clinical"
        ? "grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]"
        : "grid gap-3";

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
            <Search className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--text-heading)]">Search: acamprosate dose renal</p>
            <p className="truncate text-xs font-medium text-[color:var(--text-muted)]">
              Medication result appears beside source-backed documents, not instead of them.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)]">
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)]">Answer</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)]">Sources</span>
          <span className="rounded-full bg-[color:var(--clinical-chat-teal)] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-tight)]">
            Medication
          </span>
        </div>
      </div>

      <div className={`mt-3 ${resultClass}`}>
        <a
          href="#medication-page"
          className="group block rounded-lg border border-[color:var(--primary)]/25 bg-[color:var(--clinical-chat-teal-soft)]/60 p-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--primary)]/50 hover:bg-[color:var(--clinical-chat-teal-soft)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Acamprosate</h3>
                <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[11px] font-bold text-[color:var(--text-muted)]">
                  S4
                </span>
                <span className="rounded-md border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--success)]">
                  Reviewed
                </span>
              </div>
              <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">
                Anti-craving option for maintaining alcohol abstinence. Renal screening is the prescribing limiter.
              </p>
            </div>
            <span className="inline-flex min-h-9 items-center rounded-lg bg-[color:var(--primary)] px-3 text-xs font-bold text-[color:var(--primary-contrast)]">
              Open medication page
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MiniStat label="Dose" value="666 mg TDS" />
            <MiniStat label="Max" value="1998 mg/day" tone="warn" />
            <MiniStat label="Renal" value="Screen first" tone="warn" />
          </div>
        </a>

        {variant !== "compact" ? (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
            <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Matched evidence</p>
            <div className="mt-2 space-y-2 text-sm">
              {sourceRows.slice(0, variant === "split" ? 2 : 3).map(([label, value]) => (
                <div key={label} className="flex gap-2 border-t border-[color:var(--border)] pt-2 first:border-t-0 first:pt-0">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" />
                  <p className="min-w-0">
                    <span className="font-semibold text-[color:var(--text)]">{label}: </span>
                    <span className="text-[color:var(--text-muted)]">{value}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RowList({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <div className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <p className="text-xs font-bold uppercase text-[color:var(--text-soft)]">{label}</p>
          <p className="text-sm leading-6 text-[color:var(--text)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PageHeader({ direction, title, body }: { direction: string; title: string; body: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border)] pb-4">
      <div>
        <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">{direction}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal text-[color:var(--text-heading)]">{title}</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-6 text-[color:var(--text-muted)]">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {navItems.map((item, index) => (
          <span
            key={item}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              index === 0
                ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DirectionOne() {
  return (
    <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <PageHeader
        direction="Direction 1"
        title="Decision Strip"
        body="Best fit if the medication page should feel like a direct extension of the current answer workflow: search first, then a streamlined prescribing sheet."
      />
      <div className="mt-4 grid gap-4">
        <SearchResultMock variant="compact" />
        <div id="medication-page" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="space-y-4">
            <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-tight)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Medication page</p>
                  <h3 className="mt-1 text-3xl font-semibold text-[color:var(--text-heading)]">Acamprosate</h3>
                  <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">
                    Addiction Medicine - GABA / Glutamate modulator - S4
                  </p>
                </div>
                <span className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 text-xs font-bold text-[color:var(--success)]">
                  Source reviewed
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <MiniStat label="Can prescribe" value="Yes, screen" tone="ok" />
                <MiniStat label="Dose" value="666 mg TDS" />
                <MiniStat label="Max dose" value="1998 mg/day" tone="warn" />
                <MiniStat label="Main limiter" value="Renal" tone="warn" />
              </div>
            </section>

            <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-tight)]">
              <div className="mb-3 flex items-center gap-3">
                <Pill className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Quick prescribing</h4>
              </div>
              <RowList rows={quickRows} />
            </section>

            <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-tight)]">
              <div className="mb-3 flex items-center gap-3">
                <ShieldAlert className="h-4 w-4 text-[color:var(--warning)]" />
                <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Safety checks before signing</h4>
              </div>
              <RowList rows={safetyRows} />
            </section>
          </main>

          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-3 shadow-[var(--shadow-inset)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" />
                <p className="text-sm font-bold text-[color:var(--warning)]">Do not skip renal screen</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                Renal insufficiency is the key prescribing stop point in the reviewed content.
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
              <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Source trail</p>
              <div className="mt-2 space-y-2">
                {sourceRows.map(([label, value]) => (
                  <p key={label} className="text-sm leading-5">
                    <span className="font-semibold text-[color:var(--text)]">{label}</span>
                    <br />
                    <span className="text-[color:var(--text-muted)]">{value}</span>
                  </p>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function DirectionTwo() {
  return (
    <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <PageHeader
        direction="Direction 2"
        title="Ward Workspace"
        body="Best fit if the page should be dense but scannable: a broad first viewport with four prescribing lanes and minimal chrome."
      />
      <div className="mt-4 grid gap-4">
        <SearchResultMock variant="split" />
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-tight)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-[color:var(--text-heading)]">Acamprosate prescribing workspace</h3>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Everything needed to start, avoid, adjust, and monitor without leaving the page.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs font-bold text-[color:var(--text-muted)]">
                AUD
              </span>
              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs font-bold text-[color:var(--text-muted)]">
                PBS
              </span>
              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs font-bold text-[color:var(--text-muted)]">
                TGA
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {[
              ["Start", "666 mg TDS after withdrawal period", Stethoscope],
              ["Adjust", "Weight under 60 kg uses lower daily split", Gauge],
              ["Avoid", "Renal insufficiency, pregnancy, breastfeeding", ShieldAlert],
              ["Monitor", "Renal function, adherence, mood, GI effects", MonitorCheck],
            ].map(([label, value, Icon]) => (
              <div key={label as string} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
                <Icon className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <p className="mt-2 text-xs font-bold uppercase text-[color:var(--text-soft)]">{label as string}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--text)]">{value as string}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Prescribing data</h4>
                </div>
                <RowList rows={quickRows} />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Monitoring</h4>
                </div>
                <RowList rows={monitoringRows} />
              </div>
            </div>
            <aside className="rounded-lg border border-[color:var(--border)] bg-[color:var(--clinical-chat-document)] p-3 shadow-[var(--shadow-inset)]">
              <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Patient-context checks</p>
              <div className="mt-3 grid gap-2">
                {["eGFR / serum creatinine", "Pregnancy or lactation", "Severe hepatic failure", "Age under 18 or over 65"].map(
                  (item) => (
                    <label key={item} className="flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-sm font-semibold text-[color:var(--text)]">
                      <span className="h-4 w-4 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]" />
                      {item}
                    </label>
                  ),
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </section>
  );
}

function DirectionThree() {
  return (
    <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)]">
      <PageHeader
        direction="Direction 3"
        title="Evidence-Led Page"
        body="Best fit if Clinical KB should remain source-first: prescribing details are visible, but every key line sits beside provenance and review status."
      />
      <div className="mt-4 grid gap-4">
        <SearchResultMock variant="clinical" />
        <section className="grid gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-tight)] xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
          <nav className="space-y-2">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
              <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Medication</p>
              <h3 className="mt-1 text-xl font-semibold text-[color:var(--text-heading)]">Acamprosate</h3>
              <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">Addiction Medicine - S4</p>
            </div>
            {navItems.map((item, index) => (
              <a
                key={item}
                href="#medication-page"
                className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${
                  index === 0
                    ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {item}
              </a>
            ))}
          </nav>

          <main className="space-y-4">
            <div className="rounded-lg border-l-4 border-l-[color:var(--primary)] border-y-[color:var(--border)] border-r-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                <p className="text-sm font-bold text-[color:var(--text-heading)]">Prescribing summary</p>
              </div>
              <p className="mt-2 max-w-[68ch] text-base leading-7 text-[color:var(--text)]">
                Consider for alcohol abstinence maintenance after withdrawal when renal function, pregnancy or lactation
                status, hepatic severity, and age do not trigger an avoid rule.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Pill className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
                  <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Dose and access</h4>
                </div>
                <RowList rows={quickRows.slice(1, 6)} />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-[color:var(--warning)]" />
                  <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Safety screen</h4>
                </div>
                <RowList rows={safetyRows} />
              </div>
            </div>
          </main>

          <aside className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
              <p className="text-sm font-bold text-[color:var(--text-heading)]">Evidence stack</p>
            </div>
            <div className="mt-3 space-y-3">
              {sourceRows.map(([label, value]) => (
                <div key={label} className="border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0">
                  <p className="text-sm font-semibold text-[color:var(--text)]">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[color:var(--warning)]" />
                <p className="text-xs font-bold uppercase text-[color:var(--warning)]">Clinical note</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                Keep the provenance footer when copying prescribing text.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </section>
  );
}

export default function MedicationPrescribingMockupsPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Clinical KB medication search mockups</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
                Three lightweight directions for prescribing-focused medication pages
              </h1>
              <p className="mt-3 max-w-[74ch] text-base leading-7 text-[color:var(--text-muted)]">
                These mockups keep the quiet Clinical KB teal and source-first styling while borrowing the Medication app
                information model: quick prescribing, decision summary, safety screen, monitoring, patient-context checks,
                and source review status.
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
              <p className="text-xs font-semibold uppercase text-[color:var(--text-soft)]">Design recommendation</p>
              <p className="mt-1 max-w-xs text-sm font-semibold leading-6 text-[color:var(--text)]">
                Direction 1 is the strongest default: lowest cognitive load, closest to the current answer workflow, and
                easiest to ship incrementally.
              </p>
            </div>
          </div>
        </header>

        <DirectionOne />
        <DirectionTwo />
        <DirectionThree />

        <section className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
            <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">Review notes</h2>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm leading-6 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
              Current Clinical KB works best when primary actions stay teal, clinical notes use sand, and evidence remains
              close to the answer. The mockups preserve that rhythm.
            </p>
            <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm leading-6 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
              Medication app content maps cleanly to search tabs plus pages: stats, quick rows, sections, patient metadata,
              source status, and related guideline evidence.
            </p>
            <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm leading-6 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
              The implementation should start read-only and source-backed. Patient-context matching can be layered in after
              the basic medication tab and page route are reliable.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
