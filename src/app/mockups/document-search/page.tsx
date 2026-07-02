import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FileText, Search, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Document Search Mockups - Clinical KB",
  description: "Three runnable document-search UX concepts for Clinical KB document mode.",
};

const concepts = [
  {
    href: "/mockups/document-search-command?mode=documents",
    eyebrow: "Production candidate",
    title: "Command center",
    body: "Compact search, sort, result rows, and an active source preview for fast document lookup.",
    image: "/mockups/document-search/source-stack.png",
    alt: "Synthetic layered document stack with highlighted abstract source regions.",
    icon: Search,
    priorities: ["Fast scan", "Sort clarity", "Pinned preview"],
  },
  {
    href: "/mockups/document-search-evidence-lens?mode=documents",
    eyebrow: "Evidence lens",
    title: "Source proof in view",
    body: "A split workbench that keeps the selected page, table, image, and ranking explanation together.",
    image: "/mockups/document-search/evidence-preview.png",
    alt: "Synthetic source page connected to abstract table, image, and warning evidence panels.",
    icon: ShieldCheck,
    priorities: ["Preview first", "Why this result", "Exact evidence"],
  },
  {
    href: "/mockups/document-search-triage-board?mode=documents",
    eyebrow: "Discovery board",
    title: "Library triage",
    body: "A document-mode home for recent sources, source health, smart facets, and status lanes.",
    image: "/mockups/document-search/triage-map.png",
    alt: "Synthetic document triage board with abstract grouped source cards and status lanes.",
    icon: Sparkles,
    priorities: ["Recent work", "Source health", "Facet discovery"],
  },
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function Pill({ children, active = false }: { children: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-bold shadow-[var(--shadow-inset)]",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

export default function DocumentSearchMockupsIndexRoute() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] px-3 py-4 pb-28 text-[color:var(--text)] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                  <FileText className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                  Document mode UX
                </p>
              </div>
              <h1 className="mt-4 max-w-4xl text-balance text-2xl font-extrabold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-4xl">
                Three runnable document search directions
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
                This page is the review board. Each direction below opens as its own full runnable mockup inside the
                shared Clinical KB header and document-mode bottom composer.
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Open a direction
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Pill active>Command</Pill>
                <Pill>Evidence lens</Pill>
                <Pill>Triage board</Pill>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          {concepts.map((concept, index) => {
            const Icon = concept.icon;
            return (
              <Link
                key={concept.href}
                href={concept.href}
                className={cn(
                  "group grid min-h-[34rem] overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-elevated)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  focusRing,
                )}
              >
                <div className="relative min-h-[15rem] overflow-hidden border-b border-[color:var(--border)] bg-[color:var(--surface)]">
                  <Image
                    src={concept.image}
                    alt={concept.alt}
                    width={1536}
                    height={1024}
                    priority={index === 0}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    sizes="(min-width: 1024px) 31vw, 100vw"
                  />
                </div>
                <div className="grid content-between gap-5 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                        {concept.eyebrow}
                      </p>
                    </div>
                    <h2 className="mt-4 text-xl font-extrabold leading-tight text-[color:var(--text-heading)]">
                      {concept.title}
                    </h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{concept.body}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {concept.priorities.map((priority, priorityIndex) => (
                        <Pill key={priority} active={priorityIndex === 0}>
                          {priority}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)]">
                    Open full mockup
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
