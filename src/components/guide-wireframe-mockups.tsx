"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FileSearch,
  Filter,
  Layers,
  Menu,
  Quote,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn, textMuted } from "@/components/ui-primitives";

/* -------------------------------------------------------------------------- */
/*  Content — grounded in live GuideDialog copy, expanded for wireframes      */
/* -------------------------------------------------------------------------- */

export const guideDirections = [
  {
    slug: "tip-atlas",
    letter: "A",
    name: "Tip Atlas",
    tagline: "Tappable tip cards that open annotated deep-dives.",
    href: "/mockups/guide-wireframes/tip-atlas",
  },
  {
    slug: "help-hub",
    letter: "B",
    name: "Help Hub",
    tagline: "Fullscreen TOC help with feature demos beside each topic.",
    href: "/mockups/guide-wireframes/help-hub",
  },
  {
    slug: "walkthrough",
    letter: "C",
    name: "Walkthrough",
    tagline: "First-run step sheet with progress and a sticky footer.",
    href: "/mockups/guide-wireframes/walkthrough",
  },
] as const;

export type GuideDirectionSlug = (typeof guideDirections)[number]["slug"];

type TopicId = "ask" | "citations" | "scope" | "evidence" | "upload" | "copy";

const topics: Array<{
  id: TopicId;
  title: string;
  body: string;
  detail: string;
  icon: LucideIcon;
  productCue: string;
}> = [
  {
    id: "ask",
    title: "Ask and verify",
    body: "Ask a focused guideline question, then verify linked citations and source passages before use.",
    detail:
      "Keep questions specific (drug + indication + setting). Treat the generated answer as a pointer into sources — not a final clinical note.",
    icon: Search,
    productCue: "Answer composer → cited response → open Top source",
  },
  {
    id: "citations",
    title: "Top source and citations",
    body: "Use Top source, citation chips, and source cards to open the relevant document page and check the retrieved evidence.",
    detail:
      "Citation chips jump to the retrieved passage. Source cards expose publisher, page, and governance status so you can judge currency before acting.",
    icon: BookOpen,
    productCue: "Top source chip · citation chips · source cards",
  },
  {
    id: "scope",
    title: "Document scope",
    body: "Use document scope controls when a question should search only selected guidelines rather than every indexed source.",
    detail:
      "Scope is for bounded questions (one protocol set, one service). Leave scope open for exploratory guideline search across the library.",
    icon: Filter,
    productCue: "Scope control → selected guidelines → ask again",
  },
  {
    id: "evidence",
    title: "Quotes, images, sources",
    body: "Bottom nav jumps to quotes, diagrams, and source passages. Empty sections had no citations.",
    detail:
      "Empty evidence tabs mean nothing was retrieved for that modality — not a failed load. Prefer the populated tab before widening the question.",
    icon: Quote,
    productCue: "Phone bottom nav: Quotes · Images · Sources",
  },
  {
    id: "upload",
    title: "Upload and indexing",
    body: "Real uploads require Supabase, OpenAI setup, the database schema, and the worker. Demo mode is synthetic only.",
    detail:
      "Demo mode never writes to your live corpus. Live indexing runs through the worker (OCR + captions + embeddings) before a document becomes searchable.",
    icon: UploadCloud,
    productCue: "Documents drawer → upload → indexing job status",
  },
  {
    id: "copy",
    title: "Copying text",
    body: "Copied drafts are not final clinical notes. Keep the provenance footer and verify source material before using copied text.",
    detail:
      "The provenance footer preserves what was cited. Strip it only after you have verified the primary PDF passage yourself.",
    icon: Copy,
    productCue: "Copy answer → provenance footer retained",
  },
];

const walkthroughSteps = [
  {
    id: "ask",
    title: "Ask a focused question",
    body: "Name the drug, indication, and care setting. Vague prompts return broader, harder-to-verify answers.",
    cue: "Type in the Answer composer",
  },
  {
    id: "verify",
    title: "Verify before you trust",
    body: "Open Top source and at least one citation chip. Confirm the passage matches the claim.",
    cue: "Tap Top source · open a citation",
  },
  {
    id: "scope",
    title: "Narrow with scope when needed",
    body: "If the question belongs to one protocol set, limit document scope first, then re-ask.",
    cue: "Open document scope controls",
  },
  {
    id: "evidence",
    title: "Use evidence tabs",
    body: "Quotes, images, and sources jump to retrieved modalities. Empty means none cited.",
    cue: "Phone bottom nav evidence jumps",
  },
  {
    id: "copy",
    title: "Copy with provenance",
    body: "Copied text stays a draft. Keep the provenance footer until the PDF is checked.",
    cue: "Copy control + footer",
  },
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/* -------------------------------------------------------------------------- */
/*  Shared chrome                                                             */
/* -------------------------------------------------------------------------- */

function DirectionSwitcher({ current }: { current?: GuideDirectionSlug | "index" }) {
  return (
    <nav aria-label="Guide wireframe options" className="mt-6 grid gap-2 sm:grid-cols-3">
      {guideDirections.map((direction) => {
        const active = direction.slug === current;
        return (
          <Link
            key={direction.slug}
            href={direction.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-xl border p-3 transition",
              focusRing,
              active
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]",
            )}
          >
            <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              Option {direction.letter}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{direction.name}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{direction.tagline}</p>
          </Link>
        );
      })}
    </nav>
  );
}

function MockupShell({
  current,
  letter,
  name,
  headline,
  intro,
  children,
}: {
  current: GuideDirectionSlug | "index";
  letter: string;
  name: string;
  headline: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 font-sans text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Clinical KB guide · Option {letter} · {name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">{intro}</p>
          <p className="mt-3 text-xs leading-5 text-[color:var(--text-soft)]">
            Design scratch only — grounded in live{" "}
            <code className="rounded bg-[color:var(--surface-inset)] px-1 py-0.5">GuideDialog</code> +{" "}
            <code className="rounded bg-[color:var(--surface-inset)] px-1 py-0.5">Sheet</code> patterns. Not production.
          </p>
        </header>
        <DirectionSwitcher current={current} />
        {children}
      </div>
    </main>
  );
}

function DevicePair({
  title,
  body,
  desktop,
  phone,
}: {
  title: string;
  body: string;
  desktop: ReactNode;
  phone: ReactNode;
}) {
  return (
    <section className="mt-10 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">{title}</h2>
          <p className={cn("mt-1 text-sm leading-6", textMuted)}>{body}</p>
        </div>
        <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-soft)]">
          Desktop + phone
        </span>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <DesktopFrame>{desktop}</DesktopFrame>
        <PhoneFrame>{phone}</PhoneFrame>
      </div>
    </section>
  );
}

function DesktopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-chrome)] p-4 shadow-[var(--shadow-elevated)]">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full bg-[color:var(--border-strong)]" />
        <span className="size-2.5 rounded-full bg-[color:var(--border-strong)]" />
        <span className="size-2.5 rounded-full bg-[color:var(--border-strong)]" />
        <span className="ml-2 text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-soft)]">
          Desktop · centered Sheet
        </span>
      </div>
      <div className="relative mx-auto flex min-h-[32rem] w-full max-w-[42rem] flex-col overflow-hidden rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-elevated)]">
        {children}
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[19rem] max-w-full rounded-[1.75rem] border border-[color:var(--border-strong)] bg-[color:var(--text-heading)] p-2 shadow-[var(--shadow-elevated)]">
      <div className="relative flex h-[38rem] flex-col overflow-hidden rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--background)] text-[color:var(--text)]">
        <div className="flex h-7 items-center justify-between px-4 text-2xs font-semibold text-[color:var(--text-soft)]">
          <span>19:16</span>
          <span className="mx-auto h-1.5 w-16 rounded-full bg-[color:var(--border-strong)]" />
          <span aria-hidden="true">●●</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppChrome({ device, dimmed = false }: { device: "desktop" | "phone"; dimmed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-chrome)] px-3",
        device === "phone" ? "min-h-12" : "min-h-12 px-4",
        dimmed && "opacity-40",
      )}
    >
      <span className="grid size-9 place-items-center rounded-lg text-[color:var(--text-muted)]">
        <Menu className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">Answer</span>
      </div>
      <span className="ml-auto grid size-9 place-items-center rounded-lg text-[color:var(--text-muted)]">
        <Settings className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}

function Scrim({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Dismiss overlay"
      onClick={onClick}
      className="absolute inset-0 z-10 bg-[color:var(--overlay-backdrop)]"
    />
  );
}

function SheetHeader({
  title,
  description,
  onClose,
  closeLabel = "Close",
  leading,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  closeLabel?: string;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[color:var(--border)] px-4 py-3 sm:px-5">
      {leading}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg-minus font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-lg">
          {title}
        </h3>
        {description ? <p className={cn("mt-0.5 text-sm leading-5", textMuted)}>{description}</p> : null}
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]",
          focusRing,
        )}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function TopicIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function NoteGrid({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]"
        >
          <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">{item.title}</h3>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Index                                                                     */
/* -------------------------------------------------------------------------- */

export function GuideWireframesIndex() {
  return (
    <MockupShell
      current="index"
      letter="—"
      name="Wireframes"
      headline="Three ways to teach the Clinical KB guide"
      intro="The live guide is a six-card Sheet opened from Settings → Guide & help. These wireframes explore richer teaching patterns — tip deep-dives, a TOC help hub, and a first-run walkthrough — each with phone bottom-sheet and desktop dialog states, plus linked popups."
    >
      <section className="mt-10 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">Current product baseline</h2>
        <p className={cn("mt-1 max-w-3xl text-sm leading-6", textMuted)}>
          Responsive <strong className="font-semibold text-[color:var(--text)]">Sheet</strong>: bottom sheet on phone
          (drag grip, safe-area), centered dialog from <code>sm:</code>. Six static tip cards, no links. Entry: Settings
          Help & About, plus a dashboard Guide trigger when drawers are open.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-[color:var(--text)] sm:grid-cols-2">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2"
            >
              <TopicIcon icon={topic.icon} />
              <span>
                <span className="font-semibold text-[color:var(--text-heading)]">{topic.title}</span>
                <span className={cn("mt-0.5 block text-xs leading-5", textMuted)}>{topic.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <NoteGrid
        items={[
          {
            title: "Reuse Sheet, not a new overlay altitude",
            body: "Phone bottom / desktop center, z-modal via Sheet language, 48px close targets, Geist sans, Clinical Sky accent.",
          },
          {
            title: "One composer rule still holds",
            body: "Guide overlays pin chrome; they never introduce a second search bar or dock reserve.",
          },
          {
            title: "Trust copy stays conservative",
            body: "Verify sources, keep provenance, demo ≠ live. No confident clinical claims without a citation path.",
          },
        ]}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[color:var(--text-heading)]">Open a variation</h2>
        <p className={cn("mt-1 text-sm leading-6", textMuted)}>
          Each option is interactive inside the device frames — tap cards, TOC rows, and walkthrough controls.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {guideDirections.map((direction) => (
            <Link
              key={direction.slug}
              href={direction.href}
              className={cn(
                "group flex flex-col rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)]",
                focusRing,
              )}
            >
              <span className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                Option {direction.letter}
              </span>
              <span className="mt-1 text-base font-semibold text-[color:var(--text-heading)]">{direction.name}</span>
              <span className={cn("mt-2 flex-1 text-sm leading-6", textMuted)}>{direction.tagline}</span>
              <span className="mt-4 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[color:var(--clinical-accent)]">
                Open wireframe
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </MockupShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Option A — Tip Atlas                                                      */
/* -------------------------------------------------------------------------- */

type AtlasLayer = "closed" | "guide" | "topic" | "entry";

export function GuideTipAtlasMockup() {
  const [desktopLayer, setDesktopLayer] = useState<AtlasLayer>("guide");
  const [phoneLayer, setPhoneLayer] = useState<AtlasLayer>("guide");
  const [desktopTopic, setDesktopTopic] = useState<TopicId>("ask");
  const [phoneTopic, setPhoneTopic] = useState<TopicId>("ask");

  return (
    <MockupShell
      current="tip-atlas"
      letter="A"
      name="Tip Atlas"
      headline="Tip cards that open annotated deep-dives"
      intro="Keeps the live six-card atlas, but every tip is interactive. Opening a card reveals product cues (Top source, scope, evidence nav) without leaving the Sheet stack. Settings → Guide restore flow is shown as a linked entry state."
    >
      <div className="mt-6 flex flex-wrap gap-2">
        <FrameControl
          label="Desktop"
          value={desktopLayer}
          onChange={setDesktopLayer}
          options={[
            { id: "entry", label: "Settings entry" },
            { id: "guide", label: "Guide open" },
            { id: "topic", label: "Tip detail" },
          ]}
        />
        <FrameControl
          label="Phone"
          value={phoneLayer}
          onChange={setPhoneLayer}
          options={[
            { id: "entry", label: "Settings entry" },
            { id: "guide", label: "Guide open" },
            { id: "topic", label: "Tip detail" },
          ]}
        />
      </div>

      <DevicePair
        title="Tip Atlas — entry, guide, and tip detail"
        body="Click a tip card inside either frame to open its detail sheet. Use the state chips above to jump between Settings entry, the guide, and a tip deep-dive."
        desktop={
          <AtlasDevice
            device="desktop"
            layer={desktopLayer}
            topicId={desktopTopic}
            onOpenGuide={() => setDesktopLayer("guide")}
            onCloseGuide={() => setDesktopLayer("entry")}
            onOpenTopic={(id) => {
              setDesktopTopic(id);
              setDesktopLayer("topic");
            }}
            onCloseTopic={() => setDesktopLayer("guide")}
          />
        }
        phone={
          <AtlasDevice
            device="phone"
            layer={phoneLayer}
            topicId={phoneTopic}
            onOpenGuide={() => setPhoneLayer("guide")}
            onCloseGuide={() => setPhoneLayer("entry")}
            onOpenTopic={(id) => {
              setPhoneTopic(id);
              setPhoneLayer("topic");
            }}
            onCloseTopic={() => setPhoneLayer("guide")}
          />
        }
      />

      <NoteGrid
        items={[
          {
            title: "Why this option",
            body: "Smallest delta from today's GuideDialog. Adds progressive disclosure without inventing a new IA.",
          },
          {
            title: "Linked surfaces",
            body: "Settings Help & About row → guide Sheet → tip detail Sheet → back restores Settings focus.",
          },
          {
            title: "Risk",
            body: "Detail sheets must stay short; long essays belong in Help Hub (Option B).",
          },
        ]}
      />
    </MockupShell>
  );
}

function FrameControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2">
      <span className="px-2 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-soft)]">
        {label}
      </span>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "min-h-12 rounded-lg px-3 text-xs font-semibold transition",
              focusRing,
              active
                ? "bg-[color:var(--command)] text-[color:var(--clinical-accent-contrast)]"
                : "bg-[color:var(--surface-subtle)] text-[color:var(--text)] hover:bg-[color:var(--surface-inset)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AtlasDevice({
  device,
  layer,
  topicId,
  onOpenGuide,
  onCloseGuide,
  onOpenTopic,
  onCloseTopic,
}: {
  device: "desktop" | "phone";
  layer: AtlasLayer;
  topicId: TopicId;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onOpenTopic: (id: TopicId) => void;
  onCloseTopic: () => void;
}) {
  const topic = topics.find((item) => item.id === topicId) ?? topics[0];
  const showOverlay = layer === "guide" || layer === "topic" || layer === "entry";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <AppChrome device={device} dimmed={layer !== "closed"} />
      <div className="flex-1 bg-[color:var(--surface-subtle)] p-3">
        <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] p-3">
          <p className="text-xs font-semibold text-[color:var(--text-heading)]">Answer canvas (dimmed)</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Guide overlays sit above the composer — no second search bar.
          </p>
        </div>
      </div>

      {showOverlay ? <Scrim onClick={layer === "topic" ? onCloseTopic : onCloseGuide} /> : null}

      {layer === "entry" ? (
        <div
          className={cn(
            "absolute inset-x-0 z-20 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
            device === "phone" ? "bottom-0 top-8 rounded-t-2xl" : "inset-4 rounded-2xl",
          )}
        >
          {device === "phone" ? (
            <div className="flex justify-center pt-2 sm:hidden">
              <span className="h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
            </div>
          ) : null}
          <SheetHeader
            title="Account & app"
            description="Settings"
            onClose={onCloseGuide}
            closeLabel="Close settings"
          />
          <div className="flex-1 overflow-auto p-4">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-soft)]">
              Help & About
            </p>
            <div className="mt-2 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical Knowledge Base</p>
              <p className={cn("mt-1 text-sm leading-5", textMuted)}>
                Source-linked clinical reference. Verify primary guidance before acting.
              </p>
              <button
                type="button"
                onClick={onOpenGuide}
                className={cn(
                  "mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-sm font-semibold shadow-[var(--shadow-inset)]",
                  focusRing,
                )}
              >
                <BookOpen className="size-4" aria-hidden="true" />
                Guide & help
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {layer === "guide" || layer === "topic" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Clinical KB guide"
          className={cn(
            "absolute z-20 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
            device === "phone" ? "inset-x-0 bottom-0 top-[4.5rem] rounded-t-2xl" : "inset-4 rounded-2xl",
          )}
        >
          {device === "phone" ? (
            <div className="flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
            </div>
          ) : null}
          <SheetHeader
            title="Clinical KB guide"
            description="Practical use notes for source-backed guideline search."
            onClose={onCloseGuide}
            closeLabel="Close guide"
          />
          <div className="flex-1 overflow-auto p-4">
            <div className={cn("grid gap-3", device === "desktop" && "sm:grid-cols-2")}>
              {topics.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenTopic(item.id)}
                  className={cn(
                    "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]",
                    focusRing,
                    topicId === item.id && layer === "topic" ? "border-[color:var(--clinical-accent-border)]" : null,
                  )}
                >
                  <div className="flex items-start gap-2">
                    <TopicIcon icon={item.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <h4 className="text-sm font-semibold text-[color:var(--text-heading)]">{item.title}</h4>
                        <ChevronRight className="size-3.5 text-[color:var(--text-soft)]" aria-hidden="true" />
                      </div>
                      <p className={cn("mt-1 text-sm-minus leading-5", textMuted)}>{item.body}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {layer === "topic" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={topic.title}
          className={cn(
            "absolute z-30 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
            device === "phone" ? "inset-x-0 bottom-0 top-[7rem] rounded-t-2xl" : "inset-y-8 inset-x-8 rounded-2xl",
          )}
        >
          {device === "phone" ? (
            <div className="flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
            </div>
          ) : null}
          <SheetHeader
            title={topic.title}
            description="Annotated tip"
            onClose={onCloseTopic}
            closeLabel="Back to guide"
            leading={
              <button
                type="button"
                onClick={onCloseTopic}
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                  focusRing,
                )}
                aria-label="Back to guide"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
            }
          />
          <div className="flex-1 space-y-3 overflow-auto p-4">
            <div className="flex items-start gap-3">
              <TopicIcon icon={topic.icon} />
              <p className="text-sm leading-6 text-[color:var(--text)]">{topic.detail}</p>
            </div>
            <div className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3">
              <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                In the product
              </p>
              <p className="mt-1 text-sm font-medium text-[color:var(--text-heading)]">{topic.productCue}</p>
            </div>
            <ProductCuePreview topicId={topic.id} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductCuePreview({ topicId }: { topicId: TopicId }) {
  if (topicId === "citations") {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <p className="text-xs font-semibold text-[color:var(--text-heading)]">Top source</p>
        <button
          type="button"
          className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-semibold text-[color:var(--clinical-accent)]"
        >
          <FileSearch className="size-3.5" aria-hidden="true" />
          Clozapine monitoring protocol · p.12
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1 text-2xs font-semibold">
            [1]
          </span>
          <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1 text-2xs font-semibold">
            [2]
          </span>
        </div>
      </div>
    );
  }
  if (topicId === "scope") {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <p className="text-xs font-semibold text-[color:var(--text-heading)]">Document scope</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--clinical-accent)]">
            3 selected
          </span>
          <span className="rounded-md border border-[color:var(--border)] px-2.5 py-1.5 text-xs font-semibold">
            All documents
          </span>
        </div>
      </div>
    );
  }
  if (topicId === "evidence") {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <div className="grid grid-cols-3 gap-2">
          {["Quotes", "Images", "Sources"].map((label) => (
            <span
              key={label}
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-xs font-semibold"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (topicId === "copy") {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <p className="text-xs leading-5 text-[color:var(--text)]">Draft answer text…</p>
        <p className="mt-2 border-t border-[color:var(--border)] pt-2 text-2xs leading-4 text-[color:var(--text-soft)]">
          Provenance: sources [1][2] · verify primary PDF before clinical use
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <div className="flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs text-[color:var(--text-muted)]">
        <Search className="size-3.5" aria-hidden="true" />
        Ask about lithium monitoring in shared care…
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Option B — Help Hub                                                       */
/* -------------------------------------------------------------------------- */

type HubSection = TopicId | "safety" | "demo";

const hubNav: Array<{ id: HubSection; label: string; icon: LucideIcon }> = [
  { id: "ask", label: "Asking well", icon: Search },
  { id: "citations", label: "Sources", icon: BookOpen },
  { id: "scope", label: "Scope", icon: Filter },
  { id: "evidence", label: "Evidence", icon: Layers },
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "copy", label: "Copy safety", icon: Copy },
  { id: "safety", label: "Safety", icon: ShieldCheck },
  { id: "demo", label: "Demo vs live", icon: Sparkles },
];

export function GuideHelpHubMockup() {
  const [desktopSection, setDesktopSection] = useState<HubSection>("ask");
  const [phoneSection, setPhoneSection] = useState<HubSection>("ask");
  const [desktopDemoOpen, setDesktopDemoOpen] = useState(false);
  const [phoneDemoOpen, setPhoneDemoOpen] = useState(false);

  return (
    <MockupShell
      current="help-hub"
      letter="B"
      name="Help Hub"
      headline="A TOC help surface with feature demos"
      intro="Mirrors SettingsDialog scale: phone fullscreen Sheet, desktop wide dialog with a left rail. Sections expand the live tip set with safety and demo-vs-live chapters, plus a linked ‘Try this’ demo popup for citation verification."
    >
      <DevicePair
        title="Help Hub — rail on desktop, chip TOC on phone"
        body="Select a chapter in the rail/chips. Use Try this on Sources to open the nested verification demo sheet."
        desktop={
          <HelpHubDevice
            device="desktop"
            section={desktopSection}
            onSection={setDesktopSection}
            demoOpen={desktopDemoOpen}
            onDemoOpen={() => setDesktopDemoOpen(true)}
            onDemoClose={() => setDesktopDemoOpen(false)}
          />
        }
        phone={
          <HelpHubDevice
            device="phone"
            section={phoneSection}
            onSection={setPhoneSection}
            demoOpen={phoneDemoOpen}
            onDemoOpen={() => setPhoneDemoOpen(true)}
            onDemoClose={() => setPhoneDemoOpen(false)}
          />
        }
      />

      <NoteGrid
        items={[
          {
            title: "Why this option",
            body: "Best when guide copy grows past six short cards. TOC keeps long help scannable on ward PCs and phones.",
          },
          {
            title: "Linked surfaces",
            body: "Chapter content + Try this demo Sheet stacked above the hub (sheet-focus stack).",
          },
          {
            title: "Risk",
            body: "Must not become a second docs site — keep chapters short and product-anchored.",
          },
        ]}
      />
    </MockupShell>
  );
}

function HelpHubDevice({
  device,
  section,
  onSection,
  demoOpen,
  onDemoOpen,
  onDemoClose,
}: {
  device: "desktop" | "phone";
  section: HubSection;
  onSection: (id: HubSection) => void;
  demoOpen: boolean;
  onDemoOpen: () => void;
  onDemoClose: () => void;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <AppChrome device={device} dimmed />
      <Scrim />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Clinical KB help"
        className={cn(
          "absolute z-20 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
          device === "phone" ? "inset-0" : "inset-3 rounded-2xl",
        )}
      >
        <SheetHeader
          title="Clinical KB help"
          description="Guide chapters and product demos."
          onClose={() => undefined}
          closeLabel="Close help"
          leading={
            device === "phone" ? (
              <span className="grid size-12 place-items-center text-[color:var(--text-muted)]">
                <ArrowLeft className="size-4" aria-hidden="true" />
              </span>
            ) : null
          }
        />
        <div className={cn("flex min-h-0 flex-1", device === "desktop" ? "flex-row" : "flex-col")}>
          {device === "desktop" ? (
            <nav
              aria-label="Help chapters"
              className="w-44 shrink-0 overflow-auto border-r border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2"
            >
              {hubNav.map((item) => {
                const active = item.id === section;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSection(item.id)}
                    className={cn(
                      "mb-1 flex min-h-12 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold",
                      focusRing,
                      active
                        ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "text-[color:var(--text)] hover:bg-[color:var(--surface)]",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="shrink-0 overflow-x-auto border-b border-[color:var(--border)] px-2 py-2">
              <div className="flex min-w-max gap-1.5">
                {hubNav.map((item) => {
                  const active = item.id === section;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSection(item.id)}
                      className={cn(
                        "min-h-12 rounded-lg px-3 text-xs font-semibold",
                        focusRing,
                        active
                          ? "bg-[color:var(--command)] text-[color:var(--clinical-accent-contrast)]"
                          : "bg-[color:var(--surface-subtle)] text-[color:var(--text)]",
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <HubChapter section={section} onDemoOpen={onDemoOpen} />
          </div>
        </div>
      </div>

      {demoOpen ? (
        <>
          <button
            type="button"
            aria-label="Dismiss demo"
            onClick={onDemoClose}
            className="absolute inset-0 z-30 bg-[color:var(--overlay-backdrop)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Verify a citation"
            className={cn(
              "absolute z-40 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
              device === "phone" ? "inset-x-0 bottom-0 top-[8rem] rounded-t-2xl" : "inset-y-10 inset-x-16 rounded-2xl",
            )}
          >
            {device === "phone" ? (
              <div className="flex justify-center pt-2">
                <span className="h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
              </div>
            ) : null}
            <SheetHeader title="Try this: verify a citation" onClose={onDemoClose} closeLabel="Close demo" />
            <div className="flex-1 space-y-3 overflow-auto p-4">
              <p className="text-sm leading-6 text-[color:var(--text)]">
                Open the Top source chip, skim the passage, then confirm the claim before using the answer.
              </p>
              <ProductCuePreview topicId="citations" />
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[color:var(--text)]">
                <li>Tap Top source to open the PDF page.</li>
                <li>Match the cited sentence to the passage.</li>
                <li>Only then copy or act on the answer.</li>
              </ol>
              <button
                type="button"
                onClick={onDemoClose}
                className={cn(
                  "inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[color:var(--command)] text-sm font-semibold text-[color:var(--clinical-accent-contrast)]",
                  focusRing,
                )}
              >
                Got it
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function HubChapter({ section, onDemoOpen }: { section: HubSection; onDemoOpen: () => void }) {
  if (section === "safety") {
    return (
      <article>
        <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Safety posture</h4>
        <p className={cn("mt-2 text-sm leading-6", textMuted)}>
          This is a clinical reference prototype, not validated decision support. Answers must remain verifiable against
          linked sources. When generation fails quality gates, the product degrades to source-only citations — that is
          expected, not an error.
        </p>
        <div className="mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-3 text-sm text-[color:var(--warning)]">
          Never treat a fluent answer as a substitute for the primary guideline PDF.
        </div>
      </article>
    );
  }
  if (section === "demo") {
    return (
      <article>
        <h4 className="text-base font-semibold text-[color:var(--text-heading)]">Demo vs live</h4>
        <p className={cn("mt-2 text-sm leading-6", textMuted)}>
          Demo mode uses a synthetic corpus. Live mode needs Supabase, OpenAI, the schema, and the ingestion worker.
          Uploads in demo never reach your private library.
        </p>
      </article>
    );
  }
  const topic = topics.find((item) => item.id === section);
  if (!topic) return null;
  return (
    <article>
      <div className="flex items-start gap-3">
        <TopicIcon icon={topic.icon} />
        <div>
          <h4 className="text-base font-semibold text-[color:var(--text-heading)]">{topic.title}</h4>
          <p className={cn("mt-1 text-sm leading-6", textMuted)}>{topic.detail}</p>
        </div>
      </div>
      <div className="mt-4">
        <ProductCuePreview topicId={topic.id} />
      </div>
      {topic.id === "citations" ? (
        <button
          type="button"
          onClick={onDemoOpen}
          className={cn(
            "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-sm font-semibold text-[color:var(--clinical-accent)]",
            focusRing,
          )}
        >
          Try this: verify a citation
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Option C — Walkthrough                                                    */
/* -------------------------------------------------------------------------- */

type WalkLayer = "tour" | "skip" | "done";

export function GuideWalkthroughMockup() {
  const [desktopStep, setDesktopStep] = useState(0);
  const [phoneStep, setPhoneStep] = useState(0);
  const [desktopLayer, setDesktopLayer] = useState<WalkLayer>("tour");
  const [phoneLayer, setPhoneLayer] = useState<WalkLayer>("tour");
  const labelId = useId();

  return (
    <MockupShell
      current="walkthrough"
      letter="C"
      name="Walkthrough"
      headline="A first-run step sheet with sticky actions"
      intro="Five practical steps teach the critical path: ask → verify → scope → evidence → copy safely. Sticky footer mirrors TherapyFilterSheet / ConfirmDialog. Skip confirms before discarding; Done offers Tip Atlas or Settings."
    >
      <DevicePair
        title="Walkthrough — progress, skip confirm, completion"
        body="Advance with Next, or open Skip to see the confirm dialog. Finish the last step to reach the done state with links to the other wireframes."
        desktop={
          <WalkDevice
            device="desktop"
            step={desktopStep}
            layer={desktopLayer}
            labelId={`${labelId}-desktop`}
            onStep={setDesktopStep}
            onLayer={setDesktopLayer}
          />
        }
        phone={
          <WalkDevice
            device="phone"
            step={phoneStep}
            layer={phoneLayer}
            labelId={`${labelId}-phone`}
            onStep={setPhoneStep}
            onLayer={setPhoneLayer}
          />
        }
      />

      <NoteGrid
        items={[
          {
            title: "Why this option",
            body: "Best for first session / empty library moments. Teaches the verify habit before power-user tips.",
          },
          {
            title: "Linked surfaces",
            body: "Skip confirm Sheet · Done panel → Tip Atlas / Help Hub / Settings restore.",
          },
          {
            title: "Motion",
            body: "Step progress fill, sheet rise, footer affordance — keep reduced-motion friendly in production.",
          },
        ]}
      />
    </MockupShell>
  );
}

function WalkDevice({
  device,
  step,
  layer,
  labelId,
  onStep,
  onLayer,
}: {
  device: "desktop" | "phone";
  step: number;
  layer: WalkLayer;
  labelId: string;
  onStep: (step: number) => void;
  onLayer: (layer: WalkLayer) => void;
}) {
  const current = walkthroughSteps[Math.min(step, walkthroughSteps.length - 1)];
  const progress = ((step + 1) / walkthroughSteps.length) * 100;
  const isLast = step >= walkthroughSteps.length - 1;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <AppChrome device={device} dimmed />
      <div className="flex-1 bg-[color:var(--surface-subtle)] p-3 opacity-40">
        <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] p-3 text-xs text-[color:var(--text-muted)]">
          First-run Answer home behind the tour
        </div>
      </div>
      <Scrim />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={cn(
          "absolute z-20 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
          device === "phone" ? "inset-x-0 bottom-0 top-[5.5rem] rounded-t-2xl" : "inset-4 rounded-2xl",
        )}
      >
        {device === "phone" ? (
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-[color:var(--border-strong)]" />
          </div>
        ) : null}

        {layer === "done" ? (
          <>
            <SheetHeader
              title="You’re ready to verify"
              description="Guide walkthrough complete"
              onClose={() => onLayer("tour")}
            />
            <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
              <div className="grid size-12 place-items-center rounded-full bg-[color:var(--success-soft)] text-[color:var(--success)]">
                <Check className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-6 text-[color:var(--text)]">
                Ask focused questions, open Top source, and keep provenance on copies. Re-open the guide anytime from
                Settings → Guide & help.
              </p>
              <Link
                href="/mockups/guide-wireframes/tip-atlas"
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] text-sm font-semibold text-[color:var(--clinical-accent-contrast)]",
                  focusRing,
                )}
              >
                Browse Tip Atlas
              </Link>
              <Link
                href="/mockups/guide-wireframes/help-hub"
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-sm font-semibold",
                  focusRing,
                )}
              >
                Open Help Hub
              </Link>
              <button
                type="button"
                onClick={() => {
                  onStep(0);
                  onLayer("tour");
                }}
                className={cn(
                  "inline-flex min-h-12 items-center justify-center text-sm font-semibold text-[color:var(--clinical-accent)]",
                  focusRing,
                )}
              >
                Restart walkthrough
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-[color:var(--border)] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                    Step {step + 1} of {walkthroughSteps.length}
                  </p>
                  <h3 id={labelId} className="mt-1 text-lg-minus font-semibold text-[color:var(--text-heading)]">
                    {current.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onLayer("skip")}
                  className={cn(
                    "min-h-12 shrink-0 rounded-lg px-3 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    focusRing,
                  )}
                >
                  Skip
                </button>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-inset)]"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={walkthroughSteps.length}
                aria-valuenow={step + 1}
                aria-label="Walkthrough progress"
              >
                <div
                  className="h-full rounded-full bg-[color:var(--clinical-accent)] transition-[width] duration-300 ease-[var(--ease-out-soft)] motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto p-4">
              <p className="text-sm leading-6 text-[color:var(--text)]">{current.body}</p>
              <div className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3">
                <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                  Look for
                </p>
                <p className="mt-1 text-sm font-medium text-[color:var(--text-heading)]">{current.cue}</p>
              </div>
              <ProductCuePreview
                topicId={current.id === "verify" ? "citations" : current.id === "ask" ? "ask" : (current.id as TopicId)}
              />
            </div>

            <div className="flex gap-2 border-t border-[color:var(--border)] p-3">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => onStep(Math.max(0, step - 1))}
                className={cn(
                  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-sm font-semibold disabled:opacity-40",
                  focusRing,
                )}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLast) onLayer("done");
                  else onStep(step + 1);
                }}
                className={cn(
                  "inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] text-sm font-semibold text-[color:var(--clinical-accent-contrast)]",
                  focusRing,
                )}
              >
                {isLast ? "Finish" : "Next"}
                {!isLast ? (
                  <ArrowRight className="size-4" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {layer === "skip" ? (
        <>
          <button
            type="button"
            aria-label="Dismiss skip confirm"
            onClick={() => onLayer("tour")}
            className="absolute inset-0 z-30 bg-[color:var(--overlay-backdrop)]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Skip walkthrough?"
            className={cn(
              "absolute z-40 flex flex-col bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]",
              device === "phone"
                ? "inset-x-3 bottom-6 rounded-2xl"
                : "left-1/2 top-1/2 w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl",
            )}
          >
            <SheetHeader title="Skip the walkthrough?" onClose={() => onLayer("tour")} />
            <div className="space-y-3 p-4">
              <p className={cn("text-sm leading-6", textMuted)}>
                You can reopen Guide & help from Settings anytime. Skipping hides these first-run steps.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onLayer("tour")}
                  className={cn(
                    "inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-[color:var(--border-lux)] text-sm font-semibold",
                    focusRing,
                  )}
                >
                  Keep going
                </button>
                <button
                  type="button"
                  onClick={() => onLayer("done")}
                  className={cn(
                    "inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-[color:var(--command)] text-sm font-semibold text-[color:var(--clinical-accent-contrast)]",
                    focusRing,
                  )}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
