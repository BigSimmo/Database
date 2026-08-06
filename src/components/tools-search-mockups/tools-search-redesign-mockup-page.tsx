"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/components/ui-primitives";

/**
 * Design scratch for `/tools?q=` results (#162).
 *
 * Shows the three mode-page redesign comps (A Compact / B Dense list / C Split)
 * with desktop + phone PNGs. Product pick is A. Mockup routes 404 in production
 * and sit outside wiring/reachability gates — controls below stay wired so the
 * study can be judged.
 */

type DirectionId = "a" | "b" | "c";
type ViewportId = "desktop" | "phone" | "combined";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const DIRECTIONS: Array<{
  id: DirectionId;
  letter: string;
  title: string;
  blurb: string;
  recommended?: boolean;
  desktopSrc: string;
  phoneSrc: string;
}> = [
  {
    id: "a",
    letter: "A",
    title: "Compact Results Instrument",
    blurb: "Query-as-H1, one composer, dense rows, cross-mode collapsed.",
    recommended: true,
    desktopSrc: "/mockups/mode-page-redesign-2026-07/tools-search/tools-search-redesign-a-compact-results.png",
    phoneSrc: "/mockups/mode-page-redesign-2026-07/tools-search/tools-search-redesign-a-compact-results-phone.png",
  },
  {
    id: "b",
    letter: "B",
    title: "Dense Launcher List",
    blurb: "Relevance-ranked list with a sticky tool brief panel.",
    desktopSrc: "/mockups/mode-page-redesign-2026-07/tools-search/tools-search-redesign-b-dense-launcher-list.png",
    phoneSrc: "/mockups/mode-page-redesign-2026-07/tools-search/tools-search-redesign-b-dense-launcher-list-phone.png",
  },
  {
    id: "c",
    letter: "C",
    title: "Split Command Workspace",
    blurb: "Master/detail workspace with selection spine and full brief.",
    desktopSrc: "/mockups/mode-page-redesign-2026-07/tools-search/tools-search-redesign-c-split-command.png",
    phoneSrc: "/mockups/mode-page-redesign-2026-07/tools-search/tools-search-redesign-c-split-command-phone.png",
  },
];

const COMBINED_A = "/mockups/mode-page-redesign-2026-07/perfected-combined/tools-a-compact-results-desktop-phone.png";

export function ToolsSearchRedesignMockupPage() {
  const [direction, setDirection] = useState<DirectionId>("a");
  const [viewport, setViewport] = useState<ViewportId>("desktop");
  const active = DIRECTIONS.find((item) => item.id === direction) ?? DIRECTIONS[0];
  const imageSrc = viewport === "combined" ? COMBINED_A : viewport === "phone" ? active.phoneSrc : active.desktopSrc;
  const imageAlt =
    viewport === "combined"
      ? "Tools search direction A — desktop and phone combined"
      : `Tools search redesign ${active.letter} — ${viewport}`;

  return (
    <main
      data-testid="tools-search-redesign-mockup"
      className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-4 py-6 text-[color:var(--text)] sm:px-6 lg:px-8"
    >
      <header className="flex flex-col gap-3 border-b border-[color:var(--border)] pb-5">
        <p className="text-xs font-bold tracking-[0.08em] text-[color:var(--text-muted)] uppercase">
          Design scratch · #162 · /tools?q=
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)] sm:text-3xl">
              Tools search page mockups
            </h1>
            <p className="mt-2 text-sm text-[color:var(--text-muted)] sm:text-base">
              Three redesign directions for the committed results state. Product pick is{" "}
              <span className="font-semibold text-[color:var(--text)]">A — Compact Results Instrument</span>. Tools home
              is out of scope.
            </p>
          </div>
          {active.recommended ? (
            <span className="inline-flex min-h-10 items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)]">
              Recommended · A
            </span>
          ) : null}
        </div>
      </header>

      <section aria-label="Direction picker" className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Redesign direction">
          {DIRECTIONS.map((item) => {
            const selected = item.id === direction;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setDirection(item.id);
                  if (viewport === "combined" && item.id !== "a") setViewport("desktop");
                }}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                  focusRing,
                  selected
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                )}
              >
                <span className="font-extrabold">{item.letter}</span>
                <span className="hidden sm:inline">{item.title}</span>
                <span className="sm:hidden">{item.title.split(" ")[0]}</span>
                {item.recommended ? (
                  <span className="rounded-md bg-[color:var(--surface)] px-1.5 text-2xs font-bold">Pick</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Viewport">
          {(
            [
              ["desktop", "Desktop"],
              ["phone", "Phone"],
              ...(direction === "a" ? ([["combined", "A · Desktop + phone"]] as const) : []),
            ] as Array<[ViewportId, string]>
          ).map(([id, label]) => {
            const selected = viewport === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setViewport(id)}
                className={cn(
                  "inline-flex min-h-12 items-center rounded-lg border px-3 text-xs font-bold transition",
                  focusRing,
                  selected
                    ? "border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-[color:var(--text-muted)]">{active.blurb}</p>
      </section>

      <section
        aria-label={`${active.letter} mockup preview`}
        className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
          <p className="text-sm font-bold text-[color:var(--text-heading)]">
            {viewport === "combined" ? "A — Compact Results Instrument" : `${active.letter} — ${active.title}`}
          </p>
          <p className="text-xs font-semibold text-[color:var(--text-muted)]">
            {viewport === "phone" ? "Phone 9:16" : viewport === "combined" ? "Desktop + phone" : "Desktop 16:9"}
          </p>
        </div>
        <div
          className={cn(
            "flex justify-center bg-[color:var(--surface-wash)] p-3 sm:p-5",
            viewport === "phone" && "sm:p-8",
          )}
        >
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]",
              viewport === "phone" ? "max-w-[24rem]" : "max-w-6xl",
            )}
          >
            <Image
              key={imageSrc}
              src={imageSrc}
              alt={imageAlt}
              width={viewport === "phone" ? 390 : 1440}
              height={viewport === "phone" ? 844 : 810}
              className="h-auto w-full"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <section aria-label="Direction comparison" className="grid gap-3 lg:grid-cols-3">
        {DIRECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setDirection(item.id);
              setViewport("desktop");
            }}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              focusRing,
              item.id === direction
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]",
            )}
          >
            <p className="text-sm font-extrabold text-[color:var(--text-heading)]">
              {item.letter}. {item.title}
            </p>
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">{item.blurb}</p>
            {item.recommended ? (
              <p className="mt-3 text-2xs font-bold text-[color:var(--clinical-accent)]">#162 product pick</p>
            ) : null}
          </button>
        ))}
      </section>

      <p className="text-xs text-[color:var(--text-muted)]">
        Static comps from `public/mockups/mode-page-redesign-2026-07/tools-search/`. Implement A on production
        `/tools?q=` only — do not redesign Tools home in the same change.
      </p>
    </main>
  );
}
