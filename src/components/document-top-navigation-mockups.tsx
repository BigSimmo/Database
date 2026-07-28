"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileImage,
  FileText,
  MoreHorizontal,
  Plus,
  Quote,
  Search,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";

import { appModeHomeHref } from "@/lib/app-modes";
import { cn } from "@/components/ui-primitives";

type SectionId = "summary" | "pdf" | "evidence" | "images";
type Direction = "continuous" | "folder" | "index";
type Device = "desktop" | "phone";

const documentTitle = "Clinical practice guideline: schizophrenia care";
const documentHomeHref = appModeHomeHref("documents");

const sections: Array<{
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "summary",
    label: "Summary",
    description: "Scan the document overview, clinical points, and source-grounded notes.",
    icon: Sparkles,
  },
  {
    id: "pdf",
    label: "PDF",
    description: "Read the original source and move through its pages without leaving the viewer.",
    icon: FileText,
  },
  {
    id: "evidence",
    label: "Evidence",
    description: "Review the selected source passage alongside the page it came from.",
    icon: Quote,
  },
  {
    id: "images",
    label: "Images",
    description: "Browse extracted tables and figures with their page references intact.",
    icon: FileImage,
  },
];

const directionCopy: Record<Direction, { title: string; summary: string }> = {
  continuous: {
    title: "Continuous rail (recommended)",
    summary: "The safest evolution: one calm header surface, one seam, and a familiar active underline.",
  },
  folder: {
    title: "Document folder",
    summary: "The active section lifts out of the navigation strip and joins directly to the page below.",
  },
  index: {
    title: "Section index",
    summary: "A more editorial direction that makes position and document structure visible at a glance.",
  },
};

function HeaderActions({
  compact,
  searchInputId,
  onSearch,
}: {
  compact: boolean;
  searchInputId: string;
  onSearch: () => void;
}) {
  const [scoped, setScoped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="relative ml-auto flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onSearch}
        aria-label="Go to document search"
        aria-controls={searchInputId}
        className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <Search aria-hidden="true" className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setScoped((current) => !current)}
        aria-label={scoped ? "Remove this document from scope" : "Add this document to scope"}
        aria-pressed={scoped}
        title={scoped ? "Added to scope" : "Add this document to scope"}
        className={cn(
          "grid h-11 w-11 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          scoped
            ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
          compact && "hidden min-[350px]:grid",
        )}
      >
        <Target aria-hidden="true" className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        aria-label="Open document actions"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        {compact ? (
          <Plus aria-hidden="true" className="h-5 w-5" />
        ) : (
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {menuOpen ? (
        <div
          id={menuId}
          className="absolute right-0 top-[calc(100%+0.35rem)] z-30 w-48 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-lux)]"
        >
          Search in document · Download · Answer from this
        </div>
      ) : null}
    </div>
  );
}

function TitleRow({
  compact,
  searchInputId,
  onSearch,
}: {
  compact: boolean;
  searchInputId: string;
  onSearch: () => void;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", compact ? "h-14 px-2" : "h-16 px-4 sm:px-5")}>
      <Link
        href={documentHomeHref}
        aria-label="Back to documents"
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          compact ? "w-11 justify-center" : "pl-2 pr-3",
        )}
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
        {compact ? null : <span>Documents</span>}
      </Link>

      <h3
        className={cn(
          "min-w-0 flex-1 truncate font-semibold text-[color:var(--text-heading)]",
          compact ? "text-sm" : "text-base",
        )}
        title={documentTitle}
      >
        {documentTitle}
      </h3>

      <HeaderActions compact={compact} searchInputId={searchInputId} onSearch={onSearch} />
    </div>
  );
}

function SectionNavigation({
  direction,
  compact,
  active,
  onChange,
}: {
  direction: Direction;
  compact: boolean;
  active: SectionId;
  onChange: (section: SectionId) => void;
}) {
  if (direction === "folder") {
    return (
      <nav
        aria-label="Document page sections"
        className="flex min-w-0 gap-1 overflow-x-auto border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 pt-2 polished-scroll sm:px-4"
      >
        {sections.map((section) => {
          const selected = active === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-lg border px-3 text-xs font-semibold transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "relative -mb-px border-[color:var(--border)] border-b-[color:var(--surface)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)] shadow-[0_-3px_10px_rgb(15_23_42/0.04)]"
                  : "border-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--surface)]/70 hover:text-[color:var(--text)]",
              )}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {section.label}
            </button>
          );
        })}
      </nav>
    );
  }

  if (direction === "index") {
    return (
      <nav
        aria-label="Document page sections"
        className="flex min-w-0 overflow-x-auto border-y border-[color:var(--border)] bg-[color:var(--surface)] polished-scroll"
      >
        {sections.map((section, index) => {
          const selected = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[3.25rem] min-w-[7.25rem] flex-1 shrink-0 items-center gap-2 border-r border-[color:var(--border)] px-3 text-left transition last:border-r-0 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                compact && "min-w-[6.75rem]",
              )}
            >
              <span className="nums text-[10px] font-bold tracking-[0.08em] opacity-60">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-xs font-semibold">{section.label}</span>
              {selected ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 bottom-0 h-0.5 bg-[color:var(--clinical-accent)]"
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Document page sections"
      className="flex min-w-0 gap-1 overflow-x-auto border-t border-[color:var(--border)] bg-[color:var(--surface)] px-2 polished-scroll sm:px-4"
    >
      {sections.map((section) => {
        const selected = active === section.id;
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-[3.25rem] shrink-0 items-center gap-1.5 px-3 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[color:var(--focus)]",
              selected
                ? "text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {section.label}
            {selected ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-[color:var(--clinical-accent)]"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function SectionPreview({
  direction,
  compact,
  sectionId,
}: {
  direction: Direction;
  compact: boolean;
  sectionId: SectionId;
}) {
  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0];
  const Icon = section.icon;

  return (
    <div
      className={cn(
        "flex-1 bg-[color:var(--background)]",
        compact ? "p-3" : "grid min-h-56 grid-cols-[minmax(0,1fr)_15rem] gap-4 p-5",
        direction === "folder" && "border-t border-[color:var(--border)]",
      )}
    >
      <section className={cn("min-w-0", compact && "pb-2")} aria-live="polite">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid shrink-0 place-items-center text-[color:var(--clinical-accent)]",
              direction === "index"
                ? "h-10 w-10 border-l-2 border-[color:var(--clinical-accent)] bg-[color:var(--surface)]"
                : "h-10 w-10 rounded-lg bg-[color:var(--clinical-accent-soft)]",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h4 className={cn("font-semibold text-[color:var(--text-heading)]", compact ? "text-base" : "text-lg")}>
              {section.label}
            </h4>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{section.description}</p>
          </div>
        </div>

        <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
          <div className="border-t border-[color:var(--border)] pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Document</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--text)]">84-page clinical guideline</p>
          </div>
          <div className="border-t border-[color:var(--border)] pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Current view
            </p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--text)]">{section.label} section</p>
          </div>
        </div>
      </section>

      {compact ? null : (
        <aside className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
          <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--text-muted)]">
            <span>Source position</span>
            <span className="nums">12 / 84</span>
          </div>
          <div className="mt-3 aspect-[4/3] rounded-md border border-[color:var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-subtle)_100%)] p-3">
            <div className="h-2 w-2/3 rounded-full bg-[color:var(--text-heading)]/20" />
            <div className="mt-3 space-y-2">
              <div className="h-1.5 rounded-full bg-[color:var(--border-strong)]/55" />
              <div className="h-1.5 w-11/12 rounded-full bg-[color:var(--border-strong)]/45" />
              <div className="h-1.5 w-4/5 rounded-full bg-[color:var(--border-strong)]/35" />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function PreviewSearchBar({
  compact,
  inputId,
  inputRef,
}: {
  compact: boolean;
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const canSearch = query.trim().length >= 2;

  return (
    <div
      className={cn(
        "rounded-b-xl border-t border-[color:var(--border)] bg-[color:var(--surface)]",
        compact ? "p-2" : "p-3",
      )}
    >
      <form
        role="search"
        aria-label="Search within this document"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSearch) setSubmittedQuery(query.trim());
        }}
        className="flex min-h-12 items-center gap-1.5 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-1.5 shadow-[var(--shadow-soft),var(--shadow-inset)]"
      >
        <Search aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search within this document</span>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSubmittedQuery("");
            }}
            placeholder="Search within this document..."
            className="min-h-11 w-full bg-transparent px-1 text-sm font-medium text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
          />
        </label>
        <button
          type="submit"
          disabled={!canSearch}
          aria-label="Search document text"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] transition hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>
      <p aria-live="polite" className="min-h-4 px-3 pt-1 text-[10px] font-semibold text-[color:var(--text-muted)]">
        {submittedQuery ? `Showing document text matches for “${submittedQuery}”.` : "Type two or more characters."}
      </p>
    </div>
  );
}

function NavigationPreview({ direction, device }: { direction: Direction; device: Device }) {
  const [active, setActive] = useState<SectionId>("summary");
  const compact = device === "phone";
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const focusSearch = () => {
    searchInputRef.current?.focus({ preventScroll: true });
    searchInputRef.current?.select();
  };

  return (
    <div className={cn("min-w-0", compact ? "mx-auto w-full max-w-[390px]" : "hidden w-full md:block")}>
      <p className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">
        {compact ? "Phone · 390 px" : "Desktop"}
      </p>
      <article
        data-direction={direction}
        data-device={device}
        className={cn(
          "relative flex overflow-visible rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
          "flex-col",
          compact && "min-h-[25rem]",
        )}
      >
        <header className="relative rounded-t-xl bg-[color:var(--surface)] shadow-[var(--shadow-tight)]">
          <TitleRow compact={compact} searchInputId={searchInputId} onSearch={focusSearch} />
          <SectionNavigation direction={direction} compact={compact} active={active} onChange={setActive} />
        </header>
        <SectionPreview direction={direction} compact={compact} sectionId={active} />
        <PreviewSearchBar compact={compact} inputId={searchInputId} inputRef={searchInputRef} />
      </article>
    </div>
  );
}

function ConceptSection({ direction, number }: { direction: Direction; number: number }) {
  const copy = directionCopy[direction];

  return (
    <section className="border-t border-[color:var(--border)] pt-7 sm:pt-9">
      <div className="mb-5 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-2xl">
          {number}. {copy.title}
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-muted)] lg:text-right">{copy.summary}</p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <NavigationPreview direction={direction} device="desktop" />
        <NavigationPreview direction={direction} device="phone" />
      </div>
    </section>
  );
}

export function DocumentTopNavigationMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 py-6 text-[color:var(--text)] sm:px-6 sm:py-9 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-10 sm:space-y-14">
        <header className="max-w-4xl">
          <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Document title bar + attached page navigation
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[color:var(--text-muted)]">
            Three directions built from the current document viewer. In every option the back control, current title,
            actions, and live section navigation read as one connected top bar.
          </p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--clinical-accent)]">
            Try the section labels in any preview; the content below updates immediately.
          </p>
        </header>

        <ConceptSection direction="continuous" number={1} />
        <ConceptSection direction="folder" number={2} />
        <ConceptSection direction="index" number={3} />
      </div>
    </main>
  );
}
