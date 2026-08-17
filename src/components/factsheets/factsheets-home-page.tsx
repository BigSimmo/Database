import Link from "next/link";
import { ArrowRight, BookOpenText, Clock } from "lucide-react";

import { categoryCount, factsheetCategories, featuredFactsheets } from "@/components/factsheets/factsheets-data";
import { cardAccentEdge, cardInteractive, focusRing } from "@/components/card-recipes";
import { factsheetCategoryGlyph, factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";
import { ModeHomeHero, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { FACTSHEET_CATEGORY_IDENTITY } from "@/lib/category-identity";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

export function FactsheetsHomePage() {
  const featured = featuredFactsheets();

  return (
    <main
      data-testid="factsheets-home-main"
      className="flex w-full flex-1 flex-col items-center bg-[color:var(--background)] px-0 pb-10 pt-[clamp(1.25rem,4vh,2.25rem)] text-[color:var(--text)] sm:px-6 sm:pt-[clamp(1.75rem,5vh,3.25rem)] lg:px-8"
    >
      <div className="mode-home-template mx-auto flex w-full max-w-none flex-col items-center gap-5 px-0 text-center sm:max-w-[62rem] sm:gap-6">
        <ModeHomeHero
          testId="factsheets-home"
          title="Factsheets"
          subtitle="Plain-language patient handouts."
          icon={BookOpenText}
        />

        {/* The universal composer portals itself into this slot on the mode home (hero placement). */}
        <DesktopComposerPortalSlot
          id={modeHomeDesktopComposerSlotId}
          className="mode-home-composer-slot hidden w-full px-4 sm:px-0 [&:not(:empty)]:block"
        />

        <section aria-label="Browse by topic" className="grid w-full gap-2.5 px-4 sm:px-0">
          <p className={cn(eyebrowText, "text-center sm:text-left")}>Browse by topic</p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {factsheetCategories.map((category) => {
              return (
                <Link
                  key={category}
                  href={`/factsheets/search?category=${encodeURIComponent(category)}`}
                  data-category-accent={FACTSHEET_CATEGORY_IDENTITY[category].accent}
                  className={cn(
                    "inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--e1)] transition hover:border-[color:var(--cat-border)] hover:bg-[color:var(--surface-subtle)] motion-reduce:transition-none forced-colors:border",
                    focusRing,
                  )}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--cat-soft)] text-[color:var(--cat-accent)]">
                    {factsheetCategoryGlyph(category, "size-icon-sm")}
                  </span>
                  {category}
                  <span className="text-2xs font-bold tabular-nums text-[color:var(--text-muted)]">
                    {categoryCount(category)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="factsheets-featured-title"
          className="grid w-full gap-3.5 border-t border-[color:var(--border)] px-4 pt-6 text-left sm:px-0"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="factsheets-featured-title"
                className="text-lg font-extrabold tracking-tight text-[color:var(--text-heading)]"
              >
                Start with a factsheet
              </h2>
              <p className="mt-1 text-sm-minus font-medium text-[color:var(--text-muted)]">
                Dated demonstration content, written in plain language.
              </p>
            </div>
            <Link
              href="/factsheets/search"
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg text-sm font-bold text-[color:var(--clinical-accent)] transition hover:text-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              View all sheets
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((sheet) => {
              return (
                <Link
                  key={sheet.slug}
                  href={`/factsheets/${sheet.slug}`}
                  data-testid="factsheets-featured-card"
                  // Accent arrives through the shared attribute rather than three
                  // inline `style` objects. An inline value cannot be remapped by
                  // the dark or forced-colors blocks, so the old card carried its
                  // light-mode tint into high contrast.
                  data-category-accent={FACTSHEET_CATEGORY_IDENTITY[sheet.category].accent}
                  className={cn(cardInteractive, cardAccentEdge, "flex flex-col p-4")}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] text-[color:var(--cat-accent)] forced-colors:border">
                      {factsheetGlyph(sheet.icon, "size-icon-lg")}
                    </span>
                    <span className="rounded-md border border-[color:var(--cat-border)] bg-[color:var(--cat-soft)] px-2 py-1 text-2xs font-bold text-[color:var(--cat-accent)] forced-colors:border">
                      {sheet.category}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-6 text-[color:var(--text-heading)] transition group-hover:text-[color:var(--cat-accent)] motion-reduce:transition-none">
                    {sheet.title}
                    {sheet.brand ? (
                      <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span>
                    ) : null}
                  </h3>
                  <p className="mt-2 flex-1 text-pretty text-sm-minus leading-5 text-[color:var(--text-muted)]">
                    {sheet.summary}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-2xs font-bold text-[color:var(--text-muted)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Updated {sheet.reviewedOn}
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)]">{sheet.readTime}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="w-full px-4 pt-1 sm:px-0">
          <ModeHomeVerificationFooter
            label="Demonstration patient information"
            body="Connect only governance-approved content before publication"
          />
        </div>
      </div>
    </main>
  );
}
