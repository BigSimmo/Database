"use client";

import {
  ArrowLeft,
  Database,
  FileText,
  Globe2,
  Hash,
  MapPin,
  Server,
  ShieldAlert,
  Timer,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * Design-scratch study for `/privacy`.
 *
 * Diagnosis of today's page (from live phone screenshots):
 * - Back control sits under the Dynamic Island / status bar (no safe-area owner).
 * - Seven identical white cards flatten hierarchy — the Important notice and
 *   region/provider facts compete equally with body sections.
 * - No way to scan or jump a long governance document on phone.
 *
 * All three directions share Clinical White / Sky Graphite tokens, keep amber
 * reserved for the Important obligation, and keep governance section headings
 * + body wording identical to `src/app/privacy/page.tsx` (pinned by
 * `tests/privacy-ui.test.ts`). Layout and chrome only.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const DRAFT =
  "This is draft product information based on the repository's configured behaviour. It is not legal advice, a final privacy policy, or an assertion of governance approval.";

const IMPORTANT =
  "Do not enter identifiable patient details such as names, dates of birth, or record numbers. Requests are processed by the application service in Singapore. With external provider mode configured, question text may be sent to the OpenAI API for retrieval embedding even when the final response is source-only; model-backed answer synthesis also sends the question and selected evidence.";

type Section = {
  heading: string;
  body: string;
  icon: LucideIcon;
};

const SECTIONS: Section[] = [
  {
    heading: "What this tool is",
    icon: FileText,
    body: "Clinical KB is a knowledge base over clinical reference material. It is not a patient-record system and its provider-backed features do not ask for patient identifiers. The Safety Plan Generator accepts sensitive working content and support contacts but deliberately omits a patient-identifier field.",
  },
  {
    heading: "What is collected",
    icon: Database,
    body: "Questions, generated answers, account identifiers, uploaded documents, retrieved excerpts, document metadata, and operational or retrieval telemetry may be processed. Free text and uploaded material can contain sensitive information if you enter it. Safety-plan working content is different: it remains in the current browser tab and is not sent to the application service or stored by Clinical KB.",
  },
  {
    heading: "How questions are handled",
    icon: Hash,
    body: "Raw question text is not written to query logs by default; logs use a keyed one-way hash. Generated answer text is also omitted from durable query logs by default. A short-lived response cache can contain the answer while its read TTL is valid.",
  },
  {
    heading: "Where data is stored and processed",
    icon: MapPin,
    body: "Documents, extracted evidence, metadata, account records, and owner-scoped operational records are stored in the configured Supabase project in Sydney. The production application and ingestion worker currently run on Railway in Singapore, so questions, retrieved evidence, answers, and ingestion material are processed in or transit through Singapore. File buckets are private and links are time-limited. The operator must verify deployed regions and contractual controls.",
  },
  {
    heading: "External provider processing",
    icon: Globe2,
    body: "When external provider mode is configured, question text may be sent to the OpenAI API to create a retrieval embedding, including when the final response is source-only. When model-backed answer synthesis is used, the question and selected source excerpts are also sent. This processing may occur outside Australia. The operator must verify provider regions, retention terms, contracts, and cross-border obligations.",
  },
  {
    heading: "Retention",
    icon: Timer,
    body: "Repository migrations configure 30-day retention for RAG query records, 90-day retention for retrieval logs and query-miss telemetry, and a bounded hourly purge of expired response-cache rows when the database scheduler is available. The operator must verify that those scheduled jobs are active. Uploaded documents remain until removed under the applicable process. Safety-plan working content has no Clinical KB retention: it is discarded when the component is cleared or the tab is closed. Clipboard, print, and PDF copies are outside the app and must follow the organisation's approved record-handling process.",
  },
  {
    heading: "Your responsibilities",
    icon: UserCheck,
    body: "Do not enter patient-identifiable information. In the Safety Plan Generator, add any patient identifier only after export through your organisation's approved clinical-record process. Upload only material you are authorised to use, keep access credentials private, review original linked sources before relying on clinical output, and report suspected privacy or access issues through your organisation's approved process.",
  },
];

type DirectionId = "ledger" | "trust-map" | "indexed";

const directions: Array<{
  id: DirectionId;
  number: string;
  name: string;
  summary: string;
  strengths: string[];
  cost: string;
  recommended?: boolean;
}> = [
  {
    id: "ledger",
    number: "01",
    name: "Quiet ledger",
    summary:
      "One continuous reading surface. Sticky chrome owns the safe-area; the Important obligation leads with a left amber spine; sections divide with hairlines instead of a card stack.",
    strengths: ["Calmest reading measure", "Clearest hierarchy", "Least chrome"],
    cost: "No jump navigation on long phones — scroll is the only path.",
    recommended: true,
  },
  {
    id: "trust-map",
    number: "02",
    name: "Trust map",
    summary:
      "Ops-clarity first: a three-chip processing map (Sydney / Singapore / OpenAI) sits under the Important notice, then icon-led section cards in a responsive grid.",
    strengths: ["Region facts scan in one glance", "Desktop uses width well", "Icons aid recall"],
    cost: "Slightly busier; cards return, so it is denser than the ledger.",
  },
  {
    id: "indexed",
    number: "03",
    name: "Indexed brief",
    summary:
      "Document navigation for a long policy: phone gets a sticky section-chip strip; desktop gets a left TOC rail + article column. Same copy, jumpable structure.",
    strengths: ["Best long-doc UX", "TOC mirrors clinical briefs", "Sticky back always reachable"],
    cost: "Most chrome; chip strip needs horizontal scroll on narrow phones.",
  },
];

function BackControl({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label="Go back"
      className={cn(
        "inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        compact && "min-h-11 min-w-11",
      )}
    >
      <ArrowLeft aria-hidden="true" className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
    </button>
  );
}

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-11 shrink-0 items-end justify-between px-5 pb-1.5 text-[10px] font-semibold tabular-nums",
        dark ? "text-white/90" : "text-[color:var(--text-heading)]",
      )}
    >
      <span>9:41</span>
      <span className="absolute left-1/2 top-2 h-7 w-28 -translate-x-1/2 rounded-full bg-[color:var(--text-heading)]" />
      <span className="tracking-tight">■■■ ▮</span>
    </div>
  );
}

function DeviceChrome({
  label,
  widthLabel,
  phone = false,
  children,
}: {
  label: string;
  widthLabel: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[24rem]")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{widthLabel}</span>
      </div>
      <div
        className={cn(
          "overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] shadow-[var(--shadow-tight)]",
          phone ? "rounded-[1.75rem]" : "rounded-2xl",
        )}
      >
        {phone ? <StatusBar /> : null}
        <div className={cn(phone ? "h-[42rem] overflow-y-auto" : "h-[42rem] overflow-y-auto")}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — Quiet ledger                                                   */
/* ------------------------------------------------------------------ */

function LedgerFrame({ phone = false }: { phone?: boolean }) {
  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <div
        className={cn(
          "sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] backdrop-blur-xl",
          phone ? "px-3 py-3" : "px-8 pb-4 pt-5",
        )}
      >
        <div className={cn("flex min-h-12 items-center gap-3", !phone && "mx-auto max-w-[42rem]")}>
          <BackControl compact={phone} />
          <div className="min-w-0">
            <p className={eyebrowText}>Privacy</p>
            <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Privacy & data handling</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
            Draft
          </span>
        </div>
      </div>

      <div className={cn(phone ? "px-3 py-4" : "px-8 py-8")}>
        <article
          className={cn(
            "overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]",
            phone ? "rounded-2xl" : "mx-auto max-w-[42rem] rounded-3xl",
          )}
        >
          <div className={cn(phone ? "space-y-5 p-4" : "space-y-6 p-8")}>
            <header className="space-y-3">
              {!phone ? (
                <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-heading)]">
                  Privacy & data handling
                </h1>
              ) : (
                <h1 className="text-xl font-semibold tracking-tight text-[color:var(--text-heading)]">
                  Privacy & data handling
                </h1>
              )}
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p>
            </header>

            <aside className="flex gap-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-3.5 sm:p-4">
              <span
                aria-hidden="true"
                className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-[color:var(--warning)]"
              />
              <div className="min-w-0 space-y-1.5">
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)]">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Important
                </p>
                <p className="text-sm leading-6 text-[color:var(--text-heading)]">{IMPORTANT}</p>
              </div>
            </aside>

            <div className="divide-y divide-[color:var(--border)]">
              {SECTIONS.map((section) => (
                <section key={section.heading} className={cn(phone ? "py-4" : "py-5")}>
                  <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{section.heading}</h2>
                  <p className="mt-1.5 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
                </section>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Trust map                                                      */
/* ------------------------------------------------------------------ */

const REGION_CHIPS: Array<{ label: string; detail: string; tone: "neutral" | "accent" | "warning" }> = [
  { label: "Sydney", detail: "Supabase storage", tone: "accent" },
  { label: "Singapore", detail: "App + worker", tone: "neutral" },
  { label: "External", detail: "OpenAI API", tone: "warning" },
];

function TrustMapFrame({ phone = false }: { phone?: boolean }) {
  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <div
        className={cn(
          "sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
          phone ? "px-3 py-3" : "px-8 pb-5 pt-5",
        )}
      >
        <div className={cn(!phone && "mx-auto max-w-[72rem]")}>
          <div className="flex min-h-12 items-center gap-3">
            <BackControl compact={phone} />
            <div className="min-w-0 flex-1">
              <p className={eyebrowText}>Privacy</p>
              <h1
                className={cn(
                  "font-semibold tracking-tight text-[color:var(--text-heading)]",
                  phone ? "truncate text-base" : "text-2xl",
                )}
              >
                Privacy & data handling
              </h1>
            </div>
          </div>
          {!phone ? (
            <p className="mt-3 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p>
          ) : null}
        </div>
      </div>

      <div className={cn(phone ? "space-y-3 px-3 py-3" : "mx-auto max-w-[72rem] space-y-5 px-8 py-8")}>
        {phone ? <p className="text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p> : null}

        <aside className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)]">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Important
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-heading)]">{IMPORTANT}</p>
        </aside>

        <section
          aria-label="Where processing happens"
          className={cn(
            "rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]",
            !phone && "p-4",
          )}
        >
          <div className="mb-2.5 flex items-center gap-2">
            <Server className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
              Processing map
            </p>
          </div>
          <div className={cn("grid gap-2", phone ? "grid-cols-1" : "grid-cols-3")}>
            {REGION_CHIPS.map((chip) => (
              <div
                key={chip.label}
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  chip.tone === "accent" &&
                    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]",
                  chip.tone === "warning" && "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]",
                  chip.tone === "neutral" && "border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
                )}
              >
                <p className="text-sm font-semibold text-[color:var(--text-heading)]">{chip.label}</p>
                <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{chip.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className={cn("grid gap-3", phone ? "grid-cols-1" : "grid-cols-2")}>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.heading}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-inset)]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--surface-subtle)] text-[color:var(--clinical-accent)]">
                    <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{section.heading}</h2>
                    <p className="mt-1.5 text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Indexed brief                                                  */
/* ------------------------------------------------------------------ */

function IndexedFrame({ phone = false }: { phone?: boolean }) {
  const chipLabels = SECTIONS.map((section) => section.heading.split(" ").slice(0, 2).join(" "));

  if (phone) {
    return (
      <div className="min-h-full bg-[color:var(--background)]">
        <div className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] backdrop-blur-xl">
          <div className="flex min-h-12 items-center gap-3 px-3 py-3">
            <BackControl compact />
            <div className="min-w-0 flex-1">
              <p className={eyebrowText}>Privacy</p>
              <h1 className="truncate text-base font-semibold text-[color:var(--text-heading)]">
                Privacy & data handling
              </h1>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chipLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => undefined}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-2xs font-semibold",
                  focusRing,
                  index === 0
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 px-3 py-3">
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p>
          <aside className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-3.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)]">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Important
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-heading)]">{IMPORTANT}</p>
          </aside>
          {SECTIONS.map((section, index) => (
            <section
              key={section.heading}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4"
            >
              <p className="text-3xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-1 text-base font-semibold text-[color:var(--text-heading)]">{section.heading}</h2>
              <p className="mt-1.5 text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <div className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-8 pb-5 pt-5">
        <div className="mx-auto flex max-w-[78rem] items-center gap-3">
          <BackControl />
          <div className="min-w-0">
            <p className={eyebrowText}>Privacy</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-heading)]">
              Privacy & data handling
            </h1>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
            Draft · not legal advice
          </span>
        </div>
      </div>

      <div className="mx-auto grid max-w-[78rem] gap-8 px-8 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)] lg:sticky lg:top-28">
          <p className="px-2 pb-2 text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            On this page
          </p>
          <nav aria-label="Privacy sections" className="grid gap-0.5">
            {SECTIONS.map((section, index) => (
              <button
                key={section.heading}
                type="button"
                onClick={() => undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold transition",
                  focusRing,
                  index === 0
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                <span className="w-5 tabular-nums text-3xs font-extrabold opacity-70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{section.heading}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-5">
          <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p>
          <aside className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)]">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Important
            </p>
            <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[color:var(--text-heading)]">{IMPORTANT}</p>
          </aside>
          <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
            <div className="divide-y divide-[color:var(--border)]">
              {SECTIONS.map((section, index) => (
                <section key={section.heading} className="px-7 py-6">
                  <p className="text-3xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--text-heading)]">{section.heading}</h2>
                  <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectionPreview({ id }: { id: DirectionId }) {
  const Frame = id === "ledger" ? LedgerFrame : id === "trust-map" ? TrustMapFrame : IndexedFrame;
  return (
    <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <DeviceChrome label="Desktop" widthLabel="1440 × 900">
        <Frame />
      </DeviceChrome>
      <DeviceChrome label="Phone" widthLabel="390 × 844" phone>
        <Frame phone />
      </DeviceChrome>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PrivacyPageDirectionsMockups() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Privacy page — redesign study
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Three elevated directions for `/privacy`
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Grounded in Clinical White / Sky Graphite. Amber stays reserved for the Important obligation. Governance
            section headings and body copy are unchanged from production — chrome, hierarchy, and phone safe-area only.
            Each direction shows desktop and phone together.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="diagnosis-title"
          className="grid gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
        >
          <div className="min-w-0">
            <h2 id="diagnosis-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
              What is wrong with today
            </h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[color:var(--text-muted)]">
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">Back control in the notch.</span>{" "}
                `/privacy` sits outside the search shell and never pads `safe-area-inset-top`, so the arrow climbs into
                the Dynamic Island / status bar on notched phones.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">Card stack flattens risk.</span> The
                Important notice and seven body sections share the same raised-card treatment, so the obligation does
                not outrank retention or tool-definition copy.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">No long-doc navigation.</span> A phone
                user must scroll the entire policy with no section index — unusual for a governance page of this length.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">Region facts are buried.</span> Sydney
                / Singapore / OpenAI processing sits mid-page in prose, though it is the fact clinicians ask about
                first.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3">
            <p className="mb-2 text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Locked for this study
            </p>
            <ul className="grid gap-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
              <li>Clinical White / Sky Graphite role tokens only</li>
              <li>Amber = Important obligation only (clinical colour reserved)</li>
              <li>Section headings + body wording match production</li>
              <li>Back control is min 48×48 and below safe-area in every frame</li>
              <li>Production already ships the safe-area pad fix independently</li>
            </ul>
          </div>
        </section>

        {directions.map((direction) => (
          <section
            key={direction.id}
            id={direction.id}
            aria-labelledby={`${direction.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {direction.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id={`${direction.id}-title`}
                      className="text-lg font-extrabold text-[color:var(--text-heading)]"
                    >
                      {direction.name}
                    </h2>
                    {direction.recommended ? (
                      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                    {direction.summary}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-2xs font-medium leading-4 text-[color:var(--text-soft)]">
                    <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {direction.cost}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {direction.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-extrabold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
            <DirectionPreview id={direction.id} />
          </section>
        ))}

        <section
          aria-labelledby="recommendation-title"
          className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5"
        >
          <h2 id="recommendation-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Recommendation
          </h2>
          <p className="max-w-4xl text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-semibold text-[color:var(--text-heading)]">Ship 01 Quiet ledger</span> as the default
            privacy surface — one measure, one voice, Important spine first, sticky safe-area chrome. Adopt the{" "}
            <span className="font-semibold text-[color:var(--text-heading)]">processing-map strip from 02</span> as an
            optional insert under Important if operators want region facts above the fold. Keep 03 Indexed brief as the
            escalation if the page grows past seven sections or counsel wants jump links.
          </p>
          <p className="max-w-4xl text-sm leading-6 text-[color:var(--text-muted)]">
            The safe-area back-control fix is already applied on production `/privacy` in this branch and does not wait
            on the direction choice.
          </p>
        </section>
      </div>
    </main>
  );
}
