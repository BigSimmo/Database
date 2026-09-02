"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  Check,
  Download,
  FileImage,
  FileText,
  Link2,
  MoreHorizontal,
  Quote,
  Search,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";

type SectionId = "summary" | "pdf" | "evidence" | "images";
type ConceptId = "rail" | "folder" | "index";
type PreviewDevice = "desktop" | "tablet" | "phone";

const documentHomeHref = appModeHomeHref("documents");
const documentTitle = "Clinical practice guideline for schizophrenia";

const sections: Array<{
  id: SectionId;
  label: string;
  eyebrow: string;
  description: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    id: "summary",
    label: "Summary",
    eyebrow: "Start here",
    description: "Clinical priorities, key recommendations, and a concise document overview.",
    detail: "8 key recommendations",
    icon: Sparkles,
  },
  {
    id: "pdf",
    label: "PDF",
    eyebrow: "Original source",
    description: "Read the complete source with page position and document search kept in view.",
    detail: "84 pages",
    icon: FileText,
  },
  {
    id: "evidence",
    label: "Evidence",
    eyebrow: "Source passages",
    description: "Inspect extracted passages and move directly back to their source pages.",
    detail: "27 passages",
    icon: Quote,
  },
  {
    id: "images",
    label: "Images",
    eyebrow: "Tables and figures",
    description: "Browse extracted visual evidence with captions and page references intact.",
    detail: "6 visuals",
    icon: FileImage,
  },
];

const concepts: Array<{
  id: ConceptId;
  title: string;
  verdict: string;
  description: string;
}> = [
  {
    id: "rail",
    title: "Continuous clinical rail",
    verdict: "Recommended",
    description: "The most seamless fit: title, document identity, and section navigation read as one quiet surface.",
  },
  {
    id: "folder",
    title: "Source folder",
    verdict: "Strongest separation",
    description: "The active section joins the document canvas like a physical divider without becoming ornamental.",
  },
  {
    id: "index",
    title: "Guided section index",
    verdict: "Best orientation",
    description: "A visible reading sequence makes the four document areas easy to understand and return to.",
  },
];

const deviceCopy: Record<PreviewDevice, { label: string; width: string }> = {
  desktop: { label: "Desktop · 1440 px", width: "hidden w-full lg:block" },
  tablet: { label: "Tablet · 768 px", width: "mx-auto hidden w-full max-w-[768px] sm:block" },
  phone: { label: "Phone · 390 px", width: "mx-auto w-full max-w-[390px]" },
};

function MiniGlobalHeader({ device }: { device: PreviewDevice }) {
  const phone = device === "phone";

  return (
    <div
      data-testid="mock-global-header"
      className={cn(
        "flex items-center border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        phone ? "h-12 gap-2" : "h-14 gap-3 sm:px-4",
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] font-semibold text-[color:var(--text)]",
          phone ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        <BookOpenText aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
        Documents
      </span>
      <span className="ml-auto hidden text-xs font-semibold text-[color:var(--text-soft)] sm:block">Global header</span>
      <span className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

function DocumentActions({ device }: { device: PreviewDevice }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState("");
  const menuId = useId();
  const compact = device !== "desktop";

  const act = (message: string) => {
    setStatus(message);
    setMenuOpen(false);
  };

  return (
    <div className="relative ml-auto flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setStatus("Document search opened")}
        aria-label="Search in this document"
        className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <Search aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
      </button>
      {!compact ? (
        <button
          type="button"
          onClick={() => setStatus("Answer workspace opened")}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Answer from this
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        aria-label="More document actions"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
      </button>

      {menuOpen ? (
        <div
          id={menuId}
          className="absolute right-0 top-[calc(100%+0.25rem)] z-40 w-52 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1.5 shadow-[var(--shadow-lux)]"
        >
          {[
            [Download, "Download PDF"],
            [Target, "Add to scope"],
            [Link2, "Copy document link"],
          ].map(([Icon, label]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => act(`${label as string} selected`)}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
            >
              <Icon aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
              {label as string}
            </button>
          ))}
        </div>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
}

function DocumentIdentity({ device }: { device: PreviewDevice }) {
  const phone = device === "phone";

  return (
    <div className={cn("flex min-w-0 items-center", phone ? "h-14 px-1.5" : "h-[4.25rem] px-3 sm:px-4")}>
      <Link
        href={documentHomeHref}
        aria-label="Back to documents"
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          phone ? "w-11" : "px-3 text-sm",
        )}
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        {phone ? null : <span>Documents</span>}
      </Link>

      <span aria-hidden="true" className={cn("mx-2 h-7 w-px bg-[color:var(--border)]", phone && "mx-1")} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-3xs font-bold uppercase tracking-[0.11em] text-[color:var(--clinical-accent)]">
          NICE · Clinical guideline
        </p>
        <h3
          title={documentTitle}
          className={cn(
            "truncate font-semibold tracking-[-0.01em] text-[color:var(--text-heading)]",
            phone ? "text-sm-minus" : "mt-0.5 text-sm sm:text-base-minus",
          )}
        >
          {documentTitle}
        </h3>
      </div>

      <DocumentActions device={device} />
    </div>
  );
}

function SectionNav({
  concept,
  device,
  active,
  onChange,
}: {
  concept: ConceptId;
  device: PreviewDevice;
  active: SectionId;
  onChange: (section: SectionId) => void;
}) {
  const phone = device === "phone";
  const tablet = device === "tablet";

  return (
    <nav
      aria-label="Document page sections"
      className={cn(
        "relative grid grid-cols-4",
        concept === "rail" && "border-t border-[color:var(--border)] bg-[color:var(--surface)]",
        concept === "folder" &&
          "gap-1 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 pt-1.5",
        concept === "index" && "border-y border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      {sections.map((section, index) => {
        const selected = active === section.id;
        const Icon = section.icon;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "group relative min-w-0 text-[color:var(--text-muted)] transition focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
              concept === "rail" &&
                cn(
                  "flex min-h-[3.5rem] items-center justify-center gap-2 px-2",
                  selected ? "text-[color:var(--clinical-accent)]" : "hover:bg-[color:var(--surface-subtle)]",
                ),
              concept === "folder" &&
                cn(
                  "flex min-h-[3.5rem] items-center justify-center gap-2 rounded-t-[0.7rem] border px-2",
                  selected
                    ? "-mb-px border-[color:var(--border)] border-b-[color:var(--surface)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[0_-4px_12px_rgb(15_23_42/0.04)]"
                    : "border-transparent hover:bg-[color:var(--surface)]/70 hover:text-[color:var(--text)]",
                ),
              concept === "index" &&
                cn(
                  "flex min-h-[3.75rem] items-center gap-2 border-r border-[color:var(--border)] px-3 text-left last:border-r-0",
                  selected
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                  phone && "min-h-[3.5rem] flex-col justify-center gap-0.5 px-1 text-center",
                ),
            )}
          >
            {concept === "index" ? (
              <span className="nums text-3xs font-black tracking-[0.1em] opacity-60">
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : (
              <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", tablet && "hidden min-[700px]:block")} />
            )}
            <span className={cn("truncate font-bold", phone ? "text-3xs" : "text-xs")}>{section.label}</span>
            {!phone && !tablet && concept !== "folder" ? (
              <span className="hidden truncate text-3xs font-medium text-[color:var(--text-soft)] xl:block">
                {section.detail}
              </span>
            ) : null}
            {selected && concept === "rail" ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-[18%] bottom-0 h-0.5 rounded-t-full bg-[color:var(--clinical-accent)]"
              />
            ) : null}
            {selected && concept === "index" ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function DocumentCanvas({ sectionId, device }: { sectionId: SectionId; device: PreviewDevice }) {
  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0];
  const Icon = section.icon;
  const phone = device === "phone";

  return (
    <div
      className={cn(
        "grid flex-1 bg-[color:var(--background)]",
        phone ? "min-h-[13rem] p-3" : "min-h-[14rem] grid-cols-[minmax(0,1fr)_11rem] gap-4 p-4 sm:p-5",
      )}
    >
      <section
        aria-live="polite"
        className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.65rem] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              {section.eyebrow}
            </p>
            <h4 className="mt-0.5 font-semibold text-[color:var(--text-heading)]">{section.label}</h4>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{section.description}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-[color:var(--border)] pt-3 text-3xs font-bold text-[color:var(--text-soft)]">
          <Check aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
          {section.detail} · source linked
        </div>
      </section>

      {phone ? null : (
        <aside className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="flex items-center justify-between text-3xs font-bold text-[color:var(--text-muted)]">
            <span>Position</span>
            <span className="nums">12 / 84</span>
          </div>
          <div className="mt-3 h-28 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <div className="h-1.5 w-2/3 rounded-full bg-[color:var(--text-heading)]/18" />
            <div className="mt-3 space-y-2">
              <div className="h-1 rounded-full bg-[color:var(--border-strong)]/65" />
              <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/50" />
              <div className="h-1 w-4/5 rounded-full bg-[color:var(--border-strong)]/40" />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function ResponsivePreview({ concept, device }: { concept: ConceptId; device: PreviewDevice }) {
  const [active, setActive] = useState<SectionId>("summary");
  const { label, width } = deviceCopy[device];

  return (
    <div className={cn("min-w-0", width)}>
      <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{label}</p>
      <article
        id={`${concept}-${device}-preview`}
        data-concept={concept}
        data-device={device}
        className="relative flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        <MiniGlobalHeader device={device} />
        <header className="relative z-10 bg-[color:var(--surface)] shadow-[var(--e1)]">
          <DocumentIdentity device={device} />
          <SectionNav concept={concept} device={device} active={active} onChange={setActive} />
        </header>
        <DocumentCanvas sectionId={active} device={device} />
      </article>
    </div>
  );
}

function ConceptShowcase({ concept, number }: { concept: (typeof concepts)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8 sm:pt-10" aria-labelledby={`${concept.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Direction {String(number).padStart(2, "0")} · {concept.verdict}
          </p>
          <h2
            id={`${concept.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {concept.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {concept.description}
        </p>
      </div>

      <div className="space-y-5">
        <ResponsivePreview concept={concept.id} device="desktop" />
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <ResponsivePreview concept={concept.id} device="tablet" />
          <ResponsivePreview concept={concept.id} device="phone" />
        </div>
      </div>
    </section>
  );
}

export function DocumentTopNavigationMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-4xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Navigation study
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            A document menu that feels attached to the source
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Three interactive directions for the menu immediately beneath the global header. Every direction keeps the
            same document structure, clear active state, 44-pixel targets, and a deliberate phone, tablet, and desktop
            treatment.
          </p>
        </header>

        <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-16">
          {concepts.map((concept, index) => (
            <ConceptShowcase key={concept.id} concept={concept} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
