"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";

import { LiveSignalPerfectedFrame } from "@/components/privacy-live-signal-perfected-mockups";
import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * Privacy page redesign study — second pass.
 *
 * First pass (ledger / trust-map / indexed) read as a generic SaaS policy card
 * stack. This pass aims for a clinical instrument: brand-led first viewport,
 * atmospheric wash (not flat white), amber reserved for the obligation, and
 * three layouts that are structurally different rather than three skins on
 * the same card list.
 *
 * Governance headings + body wording match production
 * (`tests/privacy-ui.test.ts`). Layout and chrome only.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const DRAFT =
  "Draft product information from configured repository behaviour — not legal advice, not a final policy, not governance approval.";

const IMPORTANT =
  "Do not enter identifiable patient details such as names, dates of birth, or record numbers. Requests are processed by the application service in Singapore. With external provider mode configured, question text may be sent to the OpenAI API for retrieval embedding even when the final response is source-only; model-backed answer synthesis also sends the question and selected evidence.";

type Section = { heading: string; body: string; short: string };

const SECTIONS: Section[] = [
  {
    heading: "What this tool is",
    short: "Tool",
    body: "PsychSift is a knowledge base over clinical reference material. It is not a patient-record system and its provider-backed features do not ask for patient identifiers. The Safety Plan Generator accepts sensitive working content and support contacts but deliberately omits a patient-identifier field.",
  },
  {
    heading: "What is collected",
    short: "Collected",
    body: "Questions, generated answers, account identifiers, administrator-provided documents, retrieved excerpts, document metadata, and operational or retrieval telemetry may be processed. Free text and source material can contain sensitive information. Safety-plan working content is different: it remains in the current browser tab and is not sent to the application service or stored by PsychSift.",
  },
  {
    heading: "How questions are handled",
    short: "Questions",
    body: "Raw question text is not written to query logs by default; logs use a keyed one-way hash. Generated answer text is also omitted from durable query logs by default. A short-lived response cache can contain the answer while its read TTL is valid.",
  },
  {
    heading: "Where data is stored and processed",
    short: "Regions",
    body: "Documents, extracted evidence, metadata, account records, and owner-scoped operational records are stored in the configured Supabase project in Sydney. The production application and ingestion worker currently run on Railway in Singapore, so questions, retrieved evidence, answers, and ingestion material are processed in or transit through Singapore. File buckets are private and links are time-limited. The operator must verify deployed regions and contractual controls.",
  },
  {
    heading: "External provider processing",
    short: "Providers",
    body: "When external provider mode is configured, question text may be sent to the OpenAI API to create a retrieval embedding, including when the final response is source-only. When model-backed answer synthesis is used, the question and selected source excerpts are also sent. This processing may occur outside Australia. The operator must verify provider regions, retention terms, contracts, and cross-border obligations.",
  },
  {
    heading: "Retention",
    short: "Retention",
    body: "Repository migrations configure 30-day retention for RAG query records, 90-day retention for retrieval logs and query-miss telemetry, and a bounded hourly purge of expired response-cache rows when the database scheduler is available. The operator must verify that those scheduled jobs are active. Administrator-provided documents remain until removed under the applicable process. Safety-plan working content has no PsychSift retention: it is discarded when the component is cleared or the tab is closed. Clipboard, print, and PDF copies are outside the app and must follow the organisation's approved record-handling process.",
  },
  {
    heading: "Your responsibilities",
    short: "You",
    body: "Do not enter patient-identifiable information. In the Safety Plan Generator, add any patient identifier only after export through your organisation's approved clinical-record process. Documents are added only through the administrator backend; administrators must use authorised material. Keep access credentials private, review original linked sources before relying on clinical output, and report suspected privacy or access issues through your organisation's approved process.",
  },
];

type DirectionId = "theatre" | "passport" | "signal";

const directions: Array<{
  id: DirectionId;
  number: string;
  name: string;
  verdict: string;
  summary: string;
  strengths: string[];
  cost: string;
  recommended?: boolean;
}> = [
  {
    id: "theatre",
    number: "01",
    name: "Statement theatre",
    verdict: "Brand-led first viewport",
    summary:
      "First screen is one composition: PsychSift mark, display title, and a full-bleed amber obligation band — then a calm 68ch reading column. Desktop pins a graphite command rail; phone keeps sticky glass chrome below the notch.",
    strengths: ["Hero reads as brand, not a form", "Obligation is the loudest plane", "Almost no card chrome"],
    cost: "Long scroll on phone with no section jump.",
  },
  {
    id: "passport",
    number: "02",
    name: "Data passport",
    verdict: "Sealed instrument brief",
    summary:
      "A graphite command masthead seals the page. Region facts become a precision instrument strip (Sydney · Singapore · OpenAI). Giant watermark section numbers do the hierarchy work — one white brief panel, not a farm of cards.",
    strengths: ["Feels issued, not stacked", "Regions above the fold", "Typographic weight"],
    cost: "Command masthead is heavier chrome than 01.",
  },
  {
    id: "signal",
    number: "03",
    name: "Live signal",
    verdict: "Perfected · selected",
    summary:
      "Sticky fused obligation chrome with Full/Less disclosure, one-line gists on every collapsed row, region ticker as instrument strip, living signal index (desktop) and jump chips (phone). Obligation never scrolls away.",
    strengths: ["Always-on Important", "Scan without opening", "Phone density solved"],
    cost: "Full bodies still sit one tap behind — first section opens by default.",
    recommended: true,
  },
];

const atmosphere =
  "bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_srgb,var(--clinical-accent-soft)_55%,transparent),transparent_42%),radial-gradient(ellipse_at_90%_10%,color-mix(in_srgb,var(--surface-inset)_80%,transparent),transparent_38%),var(--background)]";

function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[0.7rem] bg-[color:var(--text-heading)] font-black tracking-[-0.05em] text-[color:var(--surface)] shadow-[var(--shadow-inset)]",
        size === "sm" && "h-9 w-9 text-2xs",
        size === "md" && "h-11 w-11 text-xs",
        size === "lg" && "h-14 w-14 text-sm",
      )}
    >
      KB
    </span>
  );
}

function BackControl({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label="Go back"
      className={cn(
        "inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full transition active:translate-y-px",
        focusRing,
        tone === "light"
          ? "border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)]"
          : "border border-white/15 bg-white/8 text-white/90 hover:bg-white/14",
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

function StatusBar({ invert = false }: { invert?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-11 shrink-0 items-end justify-between px-5 pb-1.5 text-3xs font-semibold tabular-nums",
        invert ? "text-white/85" : "text-[color:var(--text-heading)]",
      )}
    >
      <span>9:41</span>
      <span
        className={cn(
          "absolute left-1/2 top-2 h-7 w-28 -translate-x-1/2 rounded-full",
          invert ? "bg-black/80" : "bg-[color:var(--text-heading)]",
        )}
      />
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
        <span className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{widthLabel}</span>
      </div>
      <div
        className={cn(
          "overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]",
          phone ? "rounded-[1.85rem]" : "rounded-2xl",
        )}
      >
        {phone ? <StatusBar /> : null}
        <div className="h-[46rem] overflow-y-auto overscroll-contain">
          {/*
            Jump clearance is section scroll-mt only (see Live Signal perfected).
            Pairing scroll-pt here compounds and lands mid-frame.
          */}
          {children}
        </div>
      </div>
    </div>
  );
}

function RegionStrip({ compact = false }: { compact?: boolean }) {
  const cells = [
    { place: "Sydney", role: "Supabase storage", tone: "accent" as const },
    { place: "Singapore", role: "App + worker", tone: "neutral" as const },
    { place: "External", role: "OpenAI API", tone: "warn" as const },
  ];
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]",
        compact
          ? "grid-cols-1 divide-y divide-[color:var(--border)]"
          : "grid-cols-3 divide-x divide-[color:var(--border)]",
      )}
    >
      {cells.map((cell) => (
        <div key={cell.place} className={cn("min-w-0", compact ? "px-3.5 py-2.5" : "px-4 py-3")}>
          <p
            className={cn(
              "text-2xs font-extrabold uppercase tracking-[0.12em]",
              cell.tone === "accent" && "text-[color:var(--clinical-accent)]",
              cell.tone === "warn" && "text-[color:var(--warning-text)]",
              cell.tone === "neutral" && "text-[color:var(--text-muted)]",
            )}
          >
            {cell.place}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">{cell.role}</p>
        </div>
      ))}
    </div>
  );
}

function ObligationBand({ density = "full" }: { density?: "full" | "compact" | "bar" }) {
  if (density === "bar") {
    return (
      <div className="flex items-start gap-2.5 border-y border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" aria-hidden="true" />
        <p className="min-w-0 text-2xs font-semibold leading-4 text-[color:var(--text-heading)]">
          <span className="font-extrabold uppercase tracking-[0.08em] text-[color:var(--warning-text)]">
            Important —{" "}
          </span>
          Do not enter identifiable patient details. Processing may include Singapore and OpenAI.
        </p>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "relative overflow-hidden border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]",
        density === "full" ? "rounded-2xl p-5 sm:p-6" : "rounded-xl p-4",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[color:var(--warning)]/10"
      />
      <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--warning-text)]">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        Important
      </p>
      <p
        className={cn(
          "relative mt-2 max-w-[68ch] font-medium text-[color:var(--text-heading)]",
          density === "full" ? "text-base-minus leading-7 sm:text-base" : "text-sm leading-6",
        )}
      >
        {IMPORTANT}
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — Statement theatre                                              */
/* ------------------------------------------------------------------ */

function TheatreFrame({ phone = false }: { phone?: boolean }) {
  if (phone) {
    return (
      <div className={cn("min-h-full", atmosphere)}>
        <div className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] px-3 py-3 backdrop-blur-xl">
          <div className="flex min-h-12 items-center gap-3">
            <BackControl />
            <BrandMark size="sm" />
            <div className="min-w-0 flex-1">
              <p className={eyebrowText}>PsychSift</p>
              <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Privacy</p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-10 pt-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Privacy
          </p>
          <h1 className="mt-2 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[color:var(--text-heading)]">
            Privacy & data handling
          </h1>
          <p className="mt-3 max-w-[42ch] text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p>
        </div>

        <ObligationBand density="compact" />

        <div className="space-y-8 px-4 py-8">
          {SECTIONS.map((section, index) => (
            <section key={section.heading} className="relative">
              <p className="nums text-3xs font-extrabold tracking-[0.14em] text-[color:var(--clinical-accent)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
                {section.heading}
              </h2>
              <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      <aside className="flex w-[19rem] shrink-0 flex-col justify-between bg-[color:var(--command)] px-6 py-7 text-[color:var(--surface)]">
        <div>
          <div className="flex items-center gap-3">
            <BackControl tone="dark" />
            <BrandMark size="md" />
          </div>
          <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.16em] text-white/55">PsychSift</p>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.04em]">
            Privacy & data handling
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/65">{DRAFT}</p>
        </div>
        <div className="space-y-3 border-t border-white/12 pt-5">
          <p className="text-2xs font-extrabold uppercase tracking-[0.14em] text-white/45">Processing</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>Sydney · storage</li>
            <li>Singapore · app + worker</li>
            <li>External · OpenAI</li>
          </ul>
        </div>
      </aside>

      <div className={cn("min-w-0 flex-1", atmosphere)}>
        <div className="mx-auto max-w-[44rem] px-10 py-10">
          <ObligationBand density="full" />
          <div className="mt-10 space-y-9">
            {SECTIONS.map((section, index) => (
              <section key={section.heading} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4">
                <p
                  aria-hidden="true"
                  className="nums pt-1 text-2xl font-black tracking-[-0.04em] text-[color:var(--clinical-accent-soft)]"
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]">
                    {section.heading}
                  </h2>
                  <p className="mt-2 max-w-[68ch] text-base-minus leading-7 text-[color:var(--text-muted)]">
                    {section.body}
                  </p>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Data passport                                                  */
/* ------------------------------------------------------------------ */

function PassportFrame({ phone = false }: { phone?: boolean }) {
  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <header
        className={cn(
          "bg-[color:var(--command)] text-[color:var(--surface)]",
          phone ? "px-3 pb-5 pt-3" : "px-10 pb-8 pt-6",
        )}
      >
        <div className={cn("flex items-center gap-3", !phone && "mx-auto max-w-[72rem]")}>
          <BackControl tone="dark" />
          <BrandMark size={phone ? "sm" : "md"} />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.14em] text-white/55">
              PsychSift · sealed brief
            </p>
            <h1 className={cn("font-extrabold tracking-[-0.03em]", phone ? "truncate text-base" : "text-2xl")}>
              Privacy & data handling
            </h1>
          </div>
          <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-white/85">
            Draft
          </span>
        </div>
        {!phone ? <p className="mx-auto mt-4 max-w-[72rem] text-sm leading-6 text-white/65">{DRAFT}</p> : null}
      </header>

      <div className={cn(phone ? "space-y-4 px-3 py-4" : "mx-auto max-w-[72rem] space-y-6 px-10 py-8")}>
        {phone ? <p className="text-sm leading-6 text-[color:var(--text-muted)]">{DRAFT}</p> : null}
        <ObligationBand density={phone ? "compact" : "full"} />
        <RegionStrip compact={phone} />

        <article
          className={cn(
            "relative overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]",
            phone ? "rounded-2xl" : "rounded-3xl",
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 top-8 select-none font-black leading-none tracking-[-0.06em] text-[color:var(--surface-wash)]"
            style={{ fontSize: "7rem" }}
          >
            KB
          </div>
          <div
            className={cn(phone ? "divide-y divide-[color:var(--border)]" : "divide-y divide-[color:var(--border)]")}
          >
            {SECTIONS.map((section, index) => (
              <section
                key={section.heading}
                className={cn(
                  "relative",
                  phone ? "px-4 py-5" : "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-6 px-8 py-7",
                )}
              >
                <p
                  className={cn(
                    "nums font-black tracking-[-0.05em] text-[color:var(--clinical-accent)]",
                    phone ? "text-sm" : "pt-0.5 text-3xl",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div className={phone ? "mt-1" : undefined}>
                  <h2
                    className={cn(
                      "font-semibold text-[color:var(--text-heading)]",
                      phone ? "text-base" : "text-lg tracking-[-0.02em]",
                    )}
                  >
                    {section.heading}
                  </h2>
                  <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">{section.body}</p>
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Live signal (perfected frame)                                  */
/* ------------------------------------------------------------------ */

function SignalFrame({ phone = false }: { phone?: boolean }) {
  return <LiveSignalPerfectedFrame phone={phone} />;
}

function DirectionPreview({ id }: { id: DirectionId }) {
  const Frame = id === "theatre" ? TheatreFrame : id === "passport" ? PassportFrame : SignalFrame;
  return (
    <div className="grid gap-6 bg-[color:var(--surface-wash)] p-4 sm:p-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
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
            Privacy page — redesign study · pass 2
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Dramatically elevated directions
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Pass 1 was three skins on a card stack. Pass 2 changes structure: brand-led theatre, sealed passport, and a
            live obligation signal. Still Clinical White / Sky Graphite. Still the same governance wording. Amber only
            for Important. Back control always below the notch.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="reject-title"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5"
        >
          <h2 id="reject-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Why pass 1 was rejected
          </h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-[color:var(--text-muted)] sm:grid-cols-3">
            <li>
              <span className="font-semibold text-[color:var(--text-heading)]">Generic SaaS cards.</span> Seven white
              panels equalised the Important obligation with Retention.
            </li>
            <li>
              <span className="font-semibold text-[color:var(--text-heading)]">No brand presence.</span> The first
              viewport could belong to any product after removing the nav.
            </li>
            <li>
              <span className="font-semibold text-[color:var(--text-heading)]">Same structure thrice.</span> Ledger /
              map / TOC were skins, not distinct compositions.
            </li>
          </ul>
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
                    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
                      {direction.verdict}
                    </span>
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
            <span className="font-semibold text-[color:var(--text-heading)]">Ship 03 Live Signal (perfected).</span> The
            obligation stays on screen, collapsed rows carry gists so clinicians can scan without opening every section,
            and phone jump chips solve long-doc navigation. Dedicated review route:{" "}
            <code>/mockups/privacy-live-signal-perfected</code>.
          </p>
        </section>
      </div>
    </main>
  );
}
