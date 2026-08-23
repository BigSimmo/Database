"use client";

// Design-scratch: the Answer RESULT after a question has returned — ChatGPT-style
// thread, three citation treatments. Does not change production retrieval, ranking,
// or the live answer card. Shared mockup chrome is suppressed for this route
// (`src/app/mockups/mockups-layout-client.tsx`) because every frame draws its own
// Answer top bar and docked composer.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Menu,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

const PRIVACY_LINE = "Do not enter patient-identifiable information.";
const PRIVACY_LINK = "Privacy and data processing";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type Device = "phone" | "desktop";
type DirectionId = "simple" | "sophisticated" | "perfected";
type SourceStatus = "current" | "review-due";

type Source = {
  id: number;
  title: string;
  locator: string;
  status: SourceStatus;
  quote: string;
  reviewed: string;
};

const QUESTION = "When can weekly clozapine FBCs move to monthly, and what neutrophil threshold applies?";

const FOLLOW_UP = "What if the ANC is 1.4?";

const SOURCES: Source[] = [
  {
    id: 1,
    title: "WA Clozapine Protocol 2024",
    locator: "p. 14 · Monitoring schedule",
    status: "current",
    quote:
      "After 18 weeks of weekly full blood counts with ANC remaining at or above 1.5 × 10⁹/L, monitoring may move to monthly.",
    reviewed: "Reviewed Mar 2026",
  },
  {
    id: 2,
    title: "Haematology monitoring table",
    locator: "Table 2 · Neutrophil thresholds",
    status: "current",
    quote:
      "Green zone: ANC ≥ 1.5 × 10⁹/L — continue and, after 18 weeks, monthly FBC is permitted. Amber: 1.0–1.49 — increase frequency; do not extend the interval.",
    reviewed: "Reviewed Jan 2026",
  },
  {
    id: 3,
    title: "Clozapine shared-care checklist",
    locator: "p. 3 · Dispensing gate",
    status: "review-due",
    quote:
      "The GP or nominated prescriber must sight the latest valid blood result before authorising supply. Do not dispense on an overdue FBC.",
    reviewed: "Review due",
  },
];

const currentDefects = [
  "The answer is a raised verified card (query echo, verification notice, support strength, footer) rather than an assistant message.",
  "UserQuestionBubble exists, but the result path often uses AnswerCardQueryEcho — the page does not read as a conversation.",
  "Citations are a count capsule plus sheets. Claims in the prose have no numbered marks, so a reader cannot jump from a sentence to its source.",
  "Verification, support, and degraded banners sit above the prose and compete with it, instead of living on the claim they qualify.",
  "Evidence opens in drawers, so checking a reference leaves the reading position.",
  "Prior turns can persist, but the current result still wears card chrome — two models on one page.",
  "The composer is the universal search pill, not a docked chat input, so the page still feels like search-with-a-result.",
];

const directions: Array<{
  id: DirectionId;
  kicker: string;
  title: string;
  verdict: string;
  description: string;
  changes: string[];
}> = [
  {
    id: "simple",
    kicker: "Simple · ChatGPT-faithful",
    title: "A message, not a card",
    verdict: "Smallest change that reads as chat",
    description:
      "Right-aligned question, left-aligned prose, numbered pills in the sentence, quiet source chips under the message. Trust is a whisper. No support card, no verification banner, no evidence drawer.",
    changes: [
      "Drop AnswerCard chrome on the current turn — the assistant message is the surface.",
      "Inline numbered pills are the only citation control; chips below repeat them for scanability.",
      "A tap opens a quote preview in the thread, not a sheet over the page.",
      "Composer docks as a chat pill. Privacy line stays verbatim under it.",
    ],
  },
  {
    id: "sophisticated",
    kicker: "Sophisticated · Claim ↔ source",
    title: "The sentence lights the source",
    verdict: "Best for verification while reading",
    description:
      "Superscript citations highlight the supporting sentence. Desktop keeps a slim sources rail that lights the match; phone uses a sheet inside the frame. Hover and tap work both ways: rail to claim, claim to rail.",
    changes: [
      "Each cited sentence is a highlight target, not only the mark beside it.",
      "Desktop rail shows currency (current / review due) beside the source — green and amber stay clinical, never decorative.",
      "Phone sheet is framed, not a page-level modal, so the thread stays in view.",
      "Follow-up chips sit above the composer, still inside the chat.",
    ],
  },
  {
    id: "perfected",
    kicker: "Perfected · Never leave the chat",
    title: "The source comes to the paragraph",
    verdict: "The product direction if one ships",
    description:
      "A follow-up turn is already on screen. Tapping a footnote expands an inline source card under that paragraph (desktop) or a compact sheet (phone). A Sources strip at the end of the message mirrors the marks. Copy and regenerate stay ghosted under the assistant turn.",
    changes: [
      "No modal. The quote is an inline card in the reading flow, or a compact in-frame sheet on a phone.",
      "End-of-message Sources strip expands the same records; hovering a mark also lights the strip.",
      "A second turn shows the thread compounding, which today’s card replaces.",
      "ChatGPT pill composer: plus, field, send. Privacy line unchanged.",
    ],
  },
];

function sourceById(id: number): Source {
  const found = SOURCES.find((source) => source.id === id);
  if (!found) {
    throw new Error(`Unknown mock source ${id}`);
  }
  return found;
}

function StatusChip({ status }: { status: SourceStatus }) {
  const current = status === "current";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-3xs font-bold",
        current
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success-text)]"
          : "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]",
      )}
    >
      {current ? "Current" : "Review due"}
    </span>
  );
}

function CiteMark({
  n,
  variant,
  active,
  onActivate,
  onHover,
}: {
  n: number;
  variant: "pill" | "super" | "note";
  active: boolean;
  onActivate: (id: number) => void;
  onHover?: (id: number | null) => void;
}) {
  const source = sourceById(n);
  return (
    <button
      type="button"
      aria-label={`Source ${n}, ${source.title}`}
      aria-pressed={active}
      onClick={() => onActivate(n)}
      onMouseEnter={() => onHover?.(n)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(n)}
      onBlur={() => onHover?.(null)}
      className={cn(
        "mx-0.5 inline-flex items-center justify-center font-bold tabular-nums transition-colors motion-reduce:transition-none",
        focusRing,
        variant === "pill" && "min-h-11 min-w-11 rounded-full text-2xs sm:min-h-7 sm:min-w-7 sm:text-3xs",
        variant === "super" && "min-h-11 min-w-8 rounded-md px-1 text-2xs sm:min-h-5 sm:min-w-5 sm:text-3xs",
        variant === "note" && "min-h-11 min-w-8 rounded-md px-1 align-super text-2xs sm:min-h-6 sm:min-w-5 sm:text-3xs",
        active
          ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
          : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
      )}
    >
      {variant === "pill" ? n : `[${n}]`}
    </button>
  );
}

function Claim({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-sm box-decoration-clone px-0.5 py-0.5 transition-colors motion-reduce:transition-none",
        active && "bg-[color:var(--clinical-accent-soft)]",
      )}
    >
      {children}
    </span>
  );
}

function FrameTopBar({ device }: { device: Device }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        device === "phone" ? "h-11" : "h-12 px-4",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]">
        <span className="grid size-5 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <MessageSquareText aria-hidden="true" className="size-icon-xs" strokeWidth={2} />
        </span>
        Answer
        <ChevronDown aria-hidden="true" className="size-icon-sm text-[color:var(--text-soft)]" />
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] border border-[color:var(--border)] text-[color:var(--text-muted)]">
        <Menu aria-hidden="true" className="size-icon-md" />
      </span>
    </div>
  );
}

function FrameComposer({ device, placeholder }: { device: Device; placeholder: string }) {
  return (
    <div
      data-composer="1"
      className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-3 pt-2"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)]",
          device === "phone" ? "px-2 py-1.5" : "px-2.5 py-2",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
          <Plus aria-hidden="true" className="size-icon-lg" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-soft)]">{placeholder}</span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)]">
          <Send aria-hidden="true" className="size-icon-md" />
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-2xs leading-4 text-[color:var(--text-muted)]">
        <ShieldAlert aria-hidden="true" className="size-icon-sm text-[color:var(--warning)]" />
        {PRIVACY_LINE}{" "}
        <Link
          href="/privacy"
          className={cn("text-[color:var(--text-muted)] underline decoration-dotted underline-offset-2", focusRing)}
        >
          {PRIVACY_LINK}
        </Link>
      </p>
    </div>
  );
}

function UserBubble({ text, device }: { text: string; device: Device }) {
  return (
    <div className="flex justify-end">
      <p
        className={cn(
          "max-w-[min(28rem,86%)] rounded-2xl rounded-br-md bg-[color:var(--clinical-accent-soft)] px-3.5 py-2.5 text-right text-sm font-medium leading-6 text-[color:var(--text-heading)]",
          device === "desktop" && "px-4 py-3",
        )}
      >
        {text}
      </p>
    </div>
  );
}

function QuoteCard({ source, onClose }: { source: Source; onClose?: () => void }) {
  return (
    <aside className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <FileText aria-hidden="true" className="size-icon-md" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{source.title}</h3>
          <p className="mt-0.5 text-2xs text-[color:var(--text-muted)]">{source.locator}</p>
        </div>
        <StatusChip status={source.status} />
        {onClose ? (
          <button
            type="button"
            aria-label="Close source preview"
            onClick={onClose}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            <X aria-hidden="true" className="size-icon-md" />
          </button>
        ) : null}
      </div>
      <blockquote className="mt-3 border-l-2 border-[color:var(--clinical-accent)] pl-3 text-sm leading-6 text-[color:var(--text)]">
        {source.quote}
      </blockquote>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs text-[color:var(--text-muted)]">{source.reviewed}</p>
        <span className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[color:var(--clinical-accent)]">
          Open PDF
          <ExternalLink aria-hidden="true" className="size-icon-sm" />
        </span>
      </div>
    </aside>
  );
}

function SourceChip({
  source,
  active,
  onActivate,
  onHover,
}: {
  source: Source;
  active: boolean;
  onActivate: (id: number) => void;
  onHover?: (id: number | null) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onActivate(source.id)}
      onMouseEnter={() => onHover?.(source.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-2xs font-semibold",
        focusRing,
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
      )}
    >
      <span className="tabular-nums">{source.id}</span>
      <span className="truncate">{source.title}</span>
    </button>
  );
}

function RailItem({
  source,
  active,
  onActivate,
  onHover,
}: {
  source: Source;
  active: boolean;
  onActivate: (id: number) => void;
  onHover?: (id: number | null) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Source ${source.id} in rail, ${source.title}`}
      aria-pressed={active}
      onClick={() => onActivate(source.id)}
      onMouseEnter={() => onHover?.(source.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "flex min-h-11 w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors motion-reduce:transition-none",
        focusRing,
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-3xs font-black tabular-nums",
          active
            ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
            : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
        )}
      >
        {source.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold leading-4 text-[color:var(--text-heading)]">{source.title}</span>
        <span className="mt-0.5 block text-3xs text-[color:var(--text-muted)]">{source.locator}</span>
        <span className="mt-1 inline-flex">
          <StatusChip status={source.status} />
        </span>
      </span>
    </button>
  );
}

function InFrameSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</h3>
        <button
          type="button"
          aria-label="Close sheet"
          onClick={onClose}
          className={cn("grid size-11 place-items-center rounded-lg text-[color:var(--text-muted)]", focusRing)}
        >
          <X aria-hidden="true" className="size-icon-md" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SimpleAnswer({ activeId, onActivate }: { activeId: number | null; onActivate: (id: number | null) => void }) {
  const toggle = (id: number) => onActivate(activeId === id ? null : id);
  return (
    <div className="space-y-3">
      <p className="text-base leading-7 text-[color:var(--text)]">
        After 18 weeks of weekly full blood counts, monitoring may move to monthly{" "}
        <CiteMark n={1} variant="pill" active={activeId === 1} onActivate={toggle} /> if the absolute neutrophil count
        has stayed at or above 1.5 × 10⁹/L <CiteMark n={1} variant="pill" active={activeId === 1} onActivate={toggle} />
        <CiteMark n={2} variant="pill" active={activeId === 2} onActivate={toggle} />. An ANC of 1.0–1.49 stays in the
        amber band — increase frequency; do not extend the interval{" "}
        <CiteMark n={2} variant="pill" active={activeId === 2} onActivate={toggle} />. Before supply, the shared-care
        checklist still requires the latest valid result to be sighted{" "}
        <CiteMark n={3} variant="pill" active={activeId === 3} onActivate={toggle} />.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SOURCES.map((source) => (
          <SourceChip key={source.id} source={source} active={activeId === source.id} onActivate={toggle} />
        ))}
      </div>
      {activeId ? <QuoteCard source={sourceById(activeId)} onClose={() => onActivate(null)} /> : null}
      <p className="text-2xs leading-4 text-[color:var(--text-muted)]">
        3 sources · 2 current · 1 review due. Verify doses and thresholds against the cited page.
      </p>
    </div>
  );
}

function SophisticatedAnswer({
  activeId,
  hoverId,
  onActivate,
  onHover,
}: {
  activeId: number | null;
  hoverId: number | null;
  onActivate: (id: number | null) => void;
  onHover: (id: number | null) => void;
}) {
  const lit = hoverId ?? activeId;
  const toggle = (id: number) => onActivate(activeId === id ? null : id);
  return (
    <div className="space-y-3">
      <p className="text-base leading-7 text-[color:var(--text)]">
        <Claim active={lit === 1}>
          Weekly FBC continues for the first 18 weeks of treatment, after which monthly monitoring is permitted when
          counts have been stable
          <CiteMark n={1} variant="super" active={lit === 1} onActivate={toggle} onHover={onHover} />
        </Claim>{" "}
        <Claim active={lit === 2}>
          The neutrophil threshold for that extension is ANC ≥ 1.5 × 10⁹/L. Below that, in the 1.0–1.49 band, the
          interval must not be lengthened
          <CiteMark n={2} variant="super" active={lit === 2} onActivate={toggle} onHover={onHover} />
        </Claim>{" "}
        <Claim active={lit === 3}>
          Shared-care still gates dispensing on a sighted, in-date result — this checklist is marked review due
          <CiteMark n={3} variant="super" active={lit === 3} onActivate={toggle} onHover={onHover} />
        </Claim>
      </p>
    </div>
  );
}

function PerfectedAnswer({
  device,
  activeId,
  hoverId,
  stripOpen,
  onActivate,
  onHover,
  onToggleStrip,
}: {
  device: Device;
  activeId: number | null;
  hoverId: number | null;
  stripOpen: boolean;
  onActivate: (id: number | null) => void;
  onHover: (id: number | null) => void;
  onToggleStrip: () => void;
}) {
  const lit = hoverId ?? activeId;
  const toggle = (id: number) => onActivate(activeId === id ? null : id);
  const showInline = device === "desktop" && activeId !== null;

  return (
    <div className="space-y-3">
      <p className="text-base leading-7 text-[color:var(--text)]">
        After 18 weeks of weekly FBCs, monthly monitoring is allowed when ANC has remained ≥ 1.5 × 10⁹/L
        <CiteMark n={1} variant="note" active={lit === 1} onActivate={toggle} onHover={onHover} />
        <CiteMark n={2} variant="note" active={lit === 2} onActivate={toggle} onHover={onHover} />.
      </p>
      {showInline && (activeId === 1 || activeId === 2) ? (
        <QuoteCard source={sourceById(activeId)} onClose={() => onActivate(null)} />
      ) : null}
      <p className="text-base leading-7 text-[color:var(--text)]">
        An ANC of 1.4 sits in the amber band: increase monitoring frequency and do not extend to monthly
        <CiteMark n={2} variant="note" active={lit === 2} onActivate={toggle} onHover={onHover} />. Supply still
        requires a sighted in-date result
        <CiteMark n={3} variant="note" active={lit === 3} onActivate={toggle} onHover={onHover} />.
      </p>
      {showInline && activeId === 3 ? <QuoteCard source={sourceById(3)} onClose={() => onActivate(null)} /> : null}

      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <button
          type="button"
          aria-expanded={stripOpen}
          onClick={onToggleStrip}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-xs font-semibold text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          Sources · 3
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-icon-sm text-[color:var(--text-muted)] transition-transform",
              stripOpen && "rotate-180",
            )}
          />
        </button>
        {stripOpen ? (
          <ul className="space-y-1 border-t border-[color:var(--border)] p-2">
            {SOURCES.map((source) => (
              <li key={source.id}>
                <RailItem source={source} active={lit === source.id} onActivate={toggle} onHover={onHover} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-1 border-t border-[color:var(--border)] px-2 pb-2">
            {SOURCES.map((source) => (
              <SourceChip
                key={source.id}
                source={source}
                active={lit === source.id}
                onActivate={toggle}
                onHover={onHover}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GhostActions() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-2xs font-semibold text-[color:var(--text-muted)]",
          focusRing,
        )}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-icon-sm" />
        ) : (
          <Copy aria-hidden="true" className="size-icon-sm" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-2xs font-semibold text-[color:var(--text-muted)]",
          focusRing,
        )}
      >
        <RefreshCw aria-hidden="true" className="size-icon-sm" />
        Retry
      </button>
    </div>
  );
}

function FollowUpChips() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["ANC 1.4 next step", "What to tell the GP", "Missed FBC"].map((label) => (
        <span
          key={label}
          className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-2xs font-semibold text-[color:var(--text)]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function DirectionFrame({ direction, device }: { direction: DirectionId; device: Device }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [stripOpen, setStripOpen] = useState(direction === "perfected");
  const lit = hoverId ?? activeId;
  const isPhone = device === "phone";
  const showSheet = isPhone && activeId !== null && (direction === "sophisticated" || direction === "perfected");
  const threadPad = device === "phone" ? "px-3 py-3" : "px-5 py-4";
  const column = direction === "sophisticated" && device === "desktop";
  const toggleActive = (id: number) => setActiveId((current) => (current === id ? null : id));

  return (
    <figure
      data-direction={direction}
      data-device={device}
      className={cn("m-0 shrink-0", device === "phone" ? "w-[390px]" : "w-[1280px]")}
    >
      <div className="relative overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
        <FrameTopBar device={device} />
        <div
          className={cn(
            "relative flex flex-col bg-[color:var(--surface)]",
            device === "phone" ? "h-[680px]" : "h-[720px]",
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              threadPad,
              column && "grid grid-cols-[minmax(0,1fr)_17.5rem] gap-4",
            )}
          >
            <div className={cn(!column && device === "desktop" && "mx-auto w-full max-w-[42rem]")}>
              <div className="space-y-4">
                <UserBubble text={QUESTION} device={device} />
                {direction === "simple" ? <SimpleAnswer activeId={activeId} onActivate={setActiveId} /> : null}
                {direction === "sophisticated" ? (
                  <SophisticatedAnswer
                    activeId={activeId}
                    hoverId={hoverId}
                    onActivate={setActiveId}
                    onHover={setHoverId}
                  />
                ) : null}
                {direction === "perfected" ? (
                  <>
                    <PerfectedAnswer
                      device={device}
                      activeId={activeId}
                      hoverId={hoverId}
                      stripOpen={stripOpen}
                      onActivate={setActiveId}
                      onHover={setHoverId}
                      onToggleStrip={() => setStripOpen((open) => !open)}
                    />
                    <GhostActions />
                    <UserBubble text={FOLLOW_UP} device={device} />
                    <p className="text-base leading-7 text-[color:var(--text)]">
                      1.4 × 10⁹/L is amber, not green. Keep or increase FBC frequency; monthly is not permitted until
                      ANC is back at or above 1.5
                      <CiteMark
                        n={2}
                        variant="note"
                        active={lit === 2}
                        onActivate={toggleActive}
                        onHover={setHoverId}
                      />
                      . Do not authorise supply on an overdue result
                      <CiteMark
                        n={3}
                        variant="note"
                        active={lit === 3}
                        onActivate={toggleActive}
                        onHover={setHoverId}
                      />
                      .
                    </p>
                  </>
                ) : null}
              </div>
            </div>
            {column ? (
              <aside className="sticky top-0 space-y-2">
                <h3 className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                  Sources
                </h3>
                {SOURCES.map((source) => (
                  <RailItem
                    key={source.id}
                    source={source}
                    active={lit === source.id}
                    onActivate={toggleActive}
                    onHover={setHoverId}
                  />
                ))}
                {activeId ? (
                  <blockquote className="border-l-2 border-[color:var(--clinical-accent)] pl-3 text-xs leading-5 text-[color:var(--text)]">
                    {sourceById(activeId).quote}
                  </blockquote>
                ) : (
                  <p className="text-2xs leading-4 text-[color:var(--text-muted)]">
                    Hover a sentence or a source. The match lights on both sides.
                  </p>
                )}
              </aside>
            ) : null}
          </div>
          {direction === "sophisticated" ? (
            <div className="shrink-0 px-3 pb-1 pt-2 sm:px-5">
              <FollowUpChips />
            </div>
          ) : null}
          <FrameComposer
            device={device}
            placeholder={direction === "perfected" ? "Ask a follow-up…" : "Ask a clinical question…"}
          />
          {showSheet && activeId ? (
            <InFrameSheet title={sourceById(activeId).title} onClose={() => setActiveId(null)}>
              <QuoteCard source={sourceById(activeId)} />
            </InFrameSheet>
          ) : null}
        </div>
      </div>
      <figcaption className="mt-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {device === "phone" ? "Phone 390" : "Desktop 1280"}
        <span className="mt-1 block font-medium normal-case tracking-normal text-[color:var(--text-muted)]">
          {device === "phone"
            ? "Same thread, phone composer, in-frame sheet when a source is open."
            : "Same thread at reading width. Rail only on direction 02."}
        </span>
      </figcaption>
    </figure>
  );
}

function DirectionShowcase({ direction, number }: { direction: (typeof directions)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${direction.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Direction {String(number).padStart(2, "0")} · {direction.verdict}
          </p>
          <h2
            id={`${direction.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {direction.title}
          </h2>
          <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">{direction.kicker}</p>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {direction.description}
        </p>
      </div>
      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {direction.changes.map((change) => (
          <li
            key={change}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
          >
            {change}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-start gap-5">
        <DirectionFrame direction={direction.id} device="phone" />
        <DirectionFrame direction={direction.id} device="desktop" />
      </div>
    </section>
  );
}

export function AnswerChatRedesignMockups() {
  const composerCount = useMemo(() => directions.length * 2, []);

  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Answer · Result state
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Three chat directions for the Answer page
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Today’s Answer page is the centrepiece and still a verified document: <code>AnswerResultSurface</code>{" "}
            stages an <code>AnswerCard</code> with query echo, verification notice, support strength, prose, a sources
            capsule, and evidence sheets. Pieces of chat already exist (<code>UserQuestionBubble</code>, prior-turn
            collapse) but the current result keeps card chrome, so the page does not read as a conversation. These three
            frames keep the same clozapine-monitoring question and the same three sources. They change only how the
            thread and the references are presented. Retrieval is untouched. {composerCount} composers, one per frame.
          </p>
        </header>

        <section
          className="mt-8 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/30 p-4"
          aria-labelledby="current-defects-title"
        >
          <h2
            id="current-defects-title"
            className="text-sm font-bold tracking-[-0.01em] text-[color:var(--text-heading)]"
          >
            What the live page is doing
          </h2>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {currentDefects.map((defect, index) => (
              <li key={defect} className="flex gap-2 text-xs leading-5 text-[color:var(--text-muted)]">
                <span className="shrink-0 font-black text-[color:var(--warning-text)]">{index + 1}</span>
                {defect}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 space-y-12">
          {directions.map((direction, index) => (
            <DirectionShowcase key={direction.id} direction={direction} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
