"use client";

/**
 * Design-scratch study: nine clinician-workflow UX features (#7–#15).
 * Uses live design-system tokens and components (Chip, Button, Sheet,
 * VerificationNotice). Mockups-only — not wired into production modes.
 */

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCopy,
  FileText,
  Filter,
  History,
  Hospital,
  MapPin,
  Pill,
  Share2,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { VerificationNotice } from "@/components/ui/verification-notice";
import { cn, panelSubtle } from "@/components/ui-primitives";

type FeatureId =
  | "continue"
  | "split-read"
  | "prefer-local"
  | "refer"
  | "forms-path"
  | "rx-pack"
  | "evidence-preview"
  | "filter-sheet"
  | "handoff";

const FEATURES: Array<{
  id: FeatureId;
  number: string;
  title: string;
  oneLiner: string;
}> = [
  { id: "continue", number: "07", title: "Continue strip", oneLiner: "Resume last clinical contexts in one tap." },
  { id: "split-read", number: "08", title: "Split reading", oneLiner: "Claim beside highlighted source page." },
  { id: "prefer-local", number: "09", title: "Prefer local", oneLiner: "WA / Perth source lens chip." },
  { id: "refer", number: "10", title: "Refer action", oneLiner: "Answer → Services with query filled." },
  { id: "forms-path", number: "11", title: "Forms pathway", oneLiner: "WA MH Act step strip." },
  { id: "rx-pack", number: "12", title: "Prescribing pack", oneLiner: "Key sources drawer for a medicine." },
  { id: "evidence-preview", number: "13", title: "Evidence preview", oneLiner: "Sources while answer verifies." },
  { id: "filter-sheet", number: "14", title: "Phone Filter sheet", oneLiner: "One bottom-sheet filter pattern." },
  { id: "handoff", number: "15", title: "Ward handoff pack", oneLiner: "Copy short cited handoff snippet." },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function Frame({ label, children, phone }: { label: string; children: ReactNode; phone?: boolean }) {
  return (
    <div className="grid gap-2">
      <p className="text-2xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{label}</p>
      <div
        className={cn(
          panelSubtle,
          "overflow-hidden bg-[color:var(--surface)]",
          phone ? "mx-auto w-full max-w-[390px]" : "w-full",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function FeatureNav({ active, onSelect }: { active: FeatureId; onSelect: (id: FeatureId) => void }) {
  return (
    <nav aria-label="Feature studies" className="flex flex-wrap gap-2">
      {FEATURES.map((f) => {
        const selected = f.id === active;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            aria-pressed={selected}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-lg border px-3 text-left text-sm font-semibold transition",
              focusRing,
              selected
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <span className="nums text-2xs font-extrabold opacity-70">{f.number}</span>
            <span>{f.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* 07 Continue strip                                                     */
/* ------------------------------------------------------------------ */

function ContinueStripStudy() {
  const [active, setActive] = useState(0);
  const items = [
    { mode: "Answer", query: "Clozapine ANC threshold", source: "WA Clozapine Protocol" },
    { mode: "Documents", query: "Lithium monitoring table", source: "EMHS Lithium Guide" },
    { mode: "Prescribing", query: "Acamprosate renal dose", source: "AMH monograph" },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Desktop — Answer home">
        <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3">
          <p className="text-xs font-semibold text-[color:var(--text-muted)]">Continue</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {items.map((item, i) => (
              <button
                key={item.query}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "min-h-12 shrink-0 rounded-lg border px-3 py-2 text-left transition",
                  focusRing,
                  i === active
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)] hover:bg-[color:var(--surface)]",
                )}
              >
                <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-[color:var(--text-muted)]">
                  <History className="size-icon-xs" aria-hidden />
                  {item.mode}
                </span>
                <span className="mt-0.5 block max-w-[11rem] truncate text-sm font-semibold text-[color:var(--text-heading)]">
                  {item.query}
                </span>
                <span className="mt-0.5 block max-w-[11rem] truncate text-2xs text-[color:var(--text-muted)]">
                  {item.source}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-5">
          <p className="text-sm text-[color:var(--text-muted)]">
            Resumed: <span className="font-semibold text-[color:var(--text)]">{items[active].query}</span>
          </p>
        </div>
      </Frame>
      <Frame label="Phone" phone>
        <div className="px-3 py-3">
          <p className="mb-2 text-2xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            Continue
          </p>
          <ul className="grid gap-2">
            {items.map((item, i) => (
              <li key={item.query}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left",
                    focusRing,
                    i === active
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
                  )}
                >
                  <History className="size-icon-sm shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                      {item.query}
                    </span>
                    <span className="block truncate text-2xs text-[color:var(--text-muted)]">
                      {item.mode} · {item.source}
                    </span>
                  </span>
                  <ChevronRight className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Frame>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 Split reading                                                      */
/* ------------------------------------------------------------------ */

function SplitReadingStudy() {
  return (
    <Frame label="Desktop — claim ↔ cited page">
      <div className="grid min-h-[320px] md:grid-cols-2">
        <div className="border-b border-[color:var(--border)] p-4 md:border-b-0 md:border-r">
          <Chip appearance={{ kind: "information", tone: "accent" }} size="compact">
            Claim
          </Chip>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text)]">
            “Interrupt clozapine when ANC falls below{" "}
            <span className="nums font-extrabold text-[color:var(--text-heading)]">1.5 × 10⁹/L</span> and seek
            haematology advice.”
          </p>
          <p className="mt-3 text-2xs text-[color:var(--text-muted)]">Cited: WA Clozapine Protocol · p.12 · Table 3</p>
          <div className="mt-4">
            <VerificationNotice state="ready" attribution="model" sourceCount={2} />
          </div>
        </div>
        <div className="bg-[color:var(--surface-subtle)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[color:var(--text-muted)]">Source preview</p>
            <Chip appearance={{ kind: "status", tone: "warning" }} size="compact">
              Verify here
            </Chip>
          </div>
          <div className={cn(panelSubtle, "bg-[color:var(--surface)] p-3")}>
            <p className="text-2xs font-bold uppercase tracking-wide text-[color:var(--text-muted)]">
              Table 3 · ANC actions
            </p>
            <div className="mt-2 overflow-hidden rounded-md border border-[color:var(--border)]">
              <div className="grid grid-cols-2 bg-[color:var(--surface-subtle)] px-2 py-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
                <span>ANC</span>
                <span>Action</span>
              </div>
              <div className="grid grid-cols-2 border-t border-[color:var(--border)] bg-[color:var(--warning-soft)] px-2 py-2 text-xs ring-2 ring-inset ring-[color:var(--warning)]">
                <span className="nums font-extrabold">&lt; 1.5</span>
                <span className="font-semibold">Interrupt + haematology</span>
              </div>
              <div className="grid grid-cols-2 border-t border-[color:var(--border)] px-2 py-2 text-xs text-[color:var(--text-muted)]">
                <span className="nums">1.5–2.0</span>
                <span>Increase monitoring</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 09 Prefer local                                                       */
/* ------------------------------------------------------------------ */

function PreferLocalStudy() {
  const [on, setOn] = useState(true);
  const authorities = ["WA Health", "EMHS", "SMHS", "PCH"];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Documents results — lens on">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
          <MapPin className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden />
          {on ? (
            <Chip
              appearance={{ kind: "information", tone: "accent" }}
              size="standard"
              removeLabel="Remove prefer local lens"
              onRemove={() => setOn(false)}
            >
              Prefer WA / Perth
            </Chip>
          ) : (
            <Button type="button" variant="secondary" size="sm" icon={MapPin} onClick={() => setOn(true)}>
              Prefer local
            </Button>
          )}
          <span className="text-2xs text-[color:var(--text-muted)]">
            {on ? "Local protocols ranked in scope UI" : "All jurisdictions"}
          </span>
        </div>
        <ul className="divide-y divide-[color:var(--border)]">
          {(on
            ? [
                { title: "EMHS Lithium Monitoring", tag: "EMHS", local: true },
                { title: "WA Clozapine Protocol", tag: "WA Health", local: true },
                { title: "SMHS Acute Sedation", tag: "SMHS", local: true },
              ]
            : [
                { title: "NICE Depression NG222", tag: "NICE", local: false },
                { title: "EMHS Lithium Monitoring", tag: "EMHS", local: true },
                { title: "RANZCP Clinical Guideline", tag: "RANZCP", local: false },
              ]
          ).map((row) => (
            <li key={row.title} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-[color:var(--text-heading)]">{row.title}</span>
              <Chip
                appearance={row.local ? { kind: "status", tone: "success" } : { kind: "information", tone: "quiet" }}
                size="compact"
              >
                {row.tag}
              </Chip>
            </li>
          ))}
        </ul>
      </Frame>
      <Frame label="Authority chips">
        <div className="flex flex-wrap gap-2 p-4">
          {authorities.map((a) => (
            <Chip key={a} appearance={{ kind: "category", tone: "source" }} size="standard">
              {a}
            </Chip>
          ))}
        </div>
        <p className="border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--text-muted)]">
          Optional UI scope only — does not change retrieval ranking formulas.
        </p>
      </Frame>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 Refer action                                                       */
/* ------------------------------------------------------------------ */

function ReferActionStudy() {
  const [opened, setOpened] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Answer actions">
        <div className="space-y-3 p-4">
          <p className="text-sm leading-6 text-[color:var(--text)]">
            For Aboriginal and Torres Strait Islander people in crisis in WA, 13YARN provides 24/7 culturally safe
            support.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" icon={ClipboardCopy}>
              Copy
            </Button>
            <Button type="button" variant="primary" size="sm" icon={Share2} onClick={() => setOpened(true)}>
              Refer
            </Button>
          </div>
        </div>
      </Frame>
      <Frame label={opened ? "Services — query pre-filled" : "After Refer"}>
        {opened ? (
          <div className="p-4">
            <h3 className="text-lg font-extrabold text-[color:var(--text-heading)]">crisis ATSI phone WA</h3>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">Services · 3 matches</p>
            <ul className="mt-3 grid gap-2">
              {[
                { name: "13YARN", note: "24/7 · National / WA accessible" },
                { name: "Aboriginal Mental Health Liaison", note: "Hospital · EMHS" },
                { name: "Crisis assessment (local CMH)", note: "Fremantle catchment" },
              ].map((s) => (
                <li key={s.name} className={cn(panelSubtle, "flex items-center justify-between gap-2 px-3 py-2")}>
                  <span>
                    <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{s.name}</span>
                    <span className="block text-2xs text-[color:var(--text-muted)]">{s.note}</span>
                  </span>
                  <Hospital className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden />
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setOpened(false)}>
              Reset demo
            </Button>
          </div>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center p-6 text-center text-sm text-[color:var(--text-muted)]">
            Tap <strong className="mx-1 text-[color:var(--text)]">Refer</strong> to open Services with the same query.
          </div>
        )}
      </Frame>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 11 Forms pathway                                                      */
/* ------------------------------------------------------------------ */

function FormsPathwayStudy() {
  const steps = [
    { id: "4a", label: "Transport 4A", done: true },
    { id: "4b", label: "Extension 4B", done: false, current: true },
    { id: "psolis", label: "PSOLIS", done: false },
  ];
  return (
    <Frame label="Forms — WA MH Act pathway">
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <p className="text-2xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Pathway</p>
        <ol className="mt-3 flex flex-wrap items-center gap-2">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-lg border px-3 text-sm font-semibold",
                  focusRing,
                  step.current
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : step.done
                      ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                )}
              >
                {step.done ? <Check className="size-icon-xs" aria-hidden /> : null}
                <span className="nums text-2xs opacity-70">{i + 1}</span>
                {step.label}
              </button>
              {i < steps.length - 1 ? (
                <ArrowRight className="size-icon-xs text-[color:var(--text-muted)]" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <div className="p-4">
        <h3 className="text-base font-extrabold text-[color:var(--text-heading)]">Form 4B — Extension</h3>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Continues involuntary transport authority. Confirm against the current WA MH Act form pack.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip appearance={{ kind: "category", tone: "form" }} size="compact">
            Form
          </Chip>
          <Chip appearance={{ kind: "information", tone: "quiet" }} size="compact">
            WA MH Act
          </Chip>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 12 Prescribing source pack                                            */
/* ------------------------------------------------------------------ */

function PrescribingPackStudy() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Frame label="Medication page">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-extrabold text-[color:var(--text-heading)]">
              <Pill className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden />
              Clozapine
            </p>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">Confirm against source before prescribing.</p>
          </div>
          <Button type="button" variant="primary" size="sm" icon={BookOpen} onClick={() => setOpen(true)}>
            Source pack
          </Button>
        </div>
        <div className="space-y-2 p-4 text-sm text-[color:var(--text-muted)]">
          <p>Dose and monitoring summary would render here.</p>
          <VerificationNotice state="ready" attribution="extractive" sourceCount={3} />
        </div>
      </Frame>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Clozapine — source pack"
        description="Key monitoring tables, PBS notes, and local protocols."
      >
        <ul className="grid gap-2 p-1">
          {[
            { title: "WA Clozapine Protocol · ANC table", kind: "Local protocol" },
            { title: "AMH — monitoring schedule", kind: "Monograph" },
            { title: "PBS Authority notes", kind: "PBS" },
          ].map((row) => (
            <li key={row.title}>
              <button
                type="button"
                className={cn(
                  panelSubtle,
                  "flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-[color:var(--surface-subtle)]",
                  focusRing,
                )}
              >
                <span>
                  <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{row.title}</span>
                  <span className="block text-2xs text-[color:var(--text-muted)]">{row.kind}</span>
                </span>
                <FileText className="size-icon-sm shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 13 Evidence preview                                                   */
/* ------------------------------------------------------------------ */

function EvidencePreviewStudy() {
  return (
    <Frame label="Answer generating — evidence visible">
      <div className="border-b border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--warning)]">
          <TriangleAlert className="size-icon-sm shrink-0" aria-hidden />
          Selected evidence — answer still being verified
        </p>
        <p className="mt-1 text-2xs text-[color:var(--text-muted)]">
          Not final. Incomplete preview is discarded if verification fails.
        </p>
      </div>
      <ul className="divide-y divide-[color:var(--border)]">
        {[
          { title: "WA Clozapine Protocol", page: "p.12" },
          { title: "EMHS Haematology pathway", page: "p.4" },
          { title: "AMH Clozapine monograph", page: "Monitoring" },
        ].map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 px-4 py-3">
            <span className="nums grid size-7 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{s.title}</span>
              <span className="block text-2xs text-[color:var(--text-muted)]">{s.page}</span>
            </span>
            <Sparkles
              className="size-icon-sm animate-pulse text-[color:var(--text-muted)] motion-reduce:animate-none"
              aria-hidden
            />
          </li>
        ))}
      </ul>
      <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3">
        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--border)]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[color:var(--clinical-accent)] motion-reduce:animate-none" />
        </div>
        <p className="mt-2 text-2xs text-[color:var(--text-muted)]">Checking citations…</p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 14 Shared phone Filter sheet                                          */
/* ------------------------------------------------------------------ */

function FilterSheetStudy() {
  const [open, setOpen] = useState(true);
  const [types, setTypes] = useState<string[]>(["Guideline"]);
  const toggle = (v: string) => setTypes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <Frame label="Phone — Filter sheet" phone>
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-3 py-2">
        <p className="truncate text-sm font-extrabold text-[color:var(--text-heading)]">lithium monitoring</p>
        <Button type="button" variant="secondary" size="sm" icon={Filter} onClick={() => setOpen(true)}>
          Filter
          {types.length ? (
            <span className="nums ml-1 rounded-md bg-[color:var(--clinical-accent-soft)] px-1.5 text-2xs text-[color:var(--clinical-accent)]">
              {types.length}
            </span>
          ) : null}
        </Button>
      </div>
      <p className="px-3 py-4 text-xs text-[color:var(--text-muted)]">Results list would sit here.</p>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filter"
        description="Same sheet pattern across catalogue modes."
        mobilePlacement="bottom"
        mobileSize="content"
      >
        <div className="grid gap-4 p-1">
          <fieldset>
            <legend className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
              Document type
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Guideline", "Table", "Protocol", "Form"].map((t) => {
                const on = types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(t)}
                    className={cn(
                      "inline-flex min-h-12 items-center rounded-lg border px-3 text-sm font-semibold",
                      focusRing,
                      on
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" icon={X} onClick={() => setTypes([])}>
              Clear
            </Button>
            <Button type="button" variant="primary" size="sm" block onClick={() => setOpen(false)}>
              Apply filters
            </Button>
          </div>
        </div>
      </Sheet>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 15 Ward handoff pack                                                  */
/* ------------------------------------------------------------------ */

function HandoffPackStudy() {
  const [copied, setCopied] = useState(false);
  const snippet = [
    "HANDOFF (draft — not a clinical note)",
    "Q: Clozapine ANC interrupt threshold",
    "Summary: Interrupt below 1.5×10⁹/L; seek haematology.",
    "Sources: (1) WA Clozapine Protocol p.12 (2) EMHS pathway p.4",
    "Verify every claim against the linked source before acting.",
  ].join("\n");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Frame label="Answer toolbar">
        <div className="space-y-3 p-4">
          <p className="text-sm text-[color:var(--text)]">
            Interrupt clozapine when ANC &lt; 1.5 × 10⁹/L and seek haematology advice.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" icon={ClipboardCopy}>
              Copy answer
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Share2}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(snippet);
                  setCopied(true);
                } catch {
                  /* demo-only — do not claim success if clipboard failed */
                }
              }}
            >
              Ward handoff
            </Button>
          </div>
          {copied ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--success)]" role="status">
              <Check className="size-icon-xs" aria-hidden />
              Handoff snippet copied
            </p>
          ) : null}
        </div>
      </Frame>
      <Frame label="Clipboard preview">
        <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-mono text-2xs leading-5 text-[color:var(--text)]">
          {snippet}
        </pre>
      </Frame>
    </div>
  );
}

function StudyBody({ id }: { id: FeatureId }) {
  switch (id) {
    case "continue":
      return <ContinueStripStudy />;
    case "split-read":
      return <SplitReadingStudy />;
    case "prefer-local":
      return <PreferLocalStudy />;
    case "refer":
      return <ReferActionStudy />;
    case "forms-path":
      return <FormsPathwayStudy />;
    case "rx-pack":
      return <PrescribingPackStudy />;
    case "evidence-preview":
      return <EvidencePreviewStudy />;
    case "filter-sheet":
      return <FilterSheetStudy />;
    case "handoff":
      return <HandoffPackStudy />;
  }
}

export function ClinicianWorkflowFeaturesMockupsPage() {
  const [active, setActive] = useState<FeatureId>("continue");
  const meta = FEATURES.find((f) => f.id === active)!;

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <header className="grid gap-2">
        <p className="text-2xs font-extrabold uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
          Design study · mockups only
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
          Clinician workflow features
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
          Interactive comps for features 07–15. Built with design-system tokens, Chip, Button, Sheet, and
          VerificationNotice. Not production routes — use these to review UX before adoption PRs.
        </p>
      </header>

      <FeatureNav active={active} onSelect={setActive} />

      <section aria-labelledby="active-feature-title" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="nums text-2xs font-extrabold text-[color:var(--text-muted)]">{meta.number}</p>
            <h2 id="active-feature-title" className="text-xl font-extrabold text-[color:var(--text-heading)]">
              {meta.title}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{meta.oneLiner}</p>
          </div>
        </div>
        <StudyBody id={active} />
      </section>

      <section aria-labelledby="notes-title" className={cn(panelSubtle, "grid gap-2 bg-[color:var(--surface)] p-4")}>
        <h2 id="notes-title" className="text-sm font-extrabold text-[color:var(--text-heading)]">
          Implementation notes
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-[color:var(--text-muted)]">
          <li>Clinical colour reserved for source/safety state — not decoration.</li>
          <li>Prefer local is UI scope only; RAG ranking stays untouched.</li>
          <li>Evidence preview must discard on verification failure (conservative degrade).</li>
          <li>Phone Filter sheet must keep one-composer / search-chrome ownership rules.</li>
          <li>Handoff pack is a draft snippet — never presented as a final clinical note.</li>
        </ul>
      </section>
    </main>
  );
}
