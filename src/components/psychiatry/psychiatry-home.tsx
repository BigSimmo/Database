import Link from "next/link";

import { cardPadding, cardSurface, focusRing } from "@/components/card-recipes";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { InformationPageShell } from "@/components/information-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { cn, textMuted } from "@/components/ui-primitives";
import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { APP_MODE_ACCENT, APP_MODE_ICON } from "@/lib/category-identity";
import { sharedHomePresentation } from "@/lib/ui-copy";

/**
 * The sections Psychiatry gathers, in the order the dashboard shows them.
 * Each keeps its own address, so every existing link and bookmark still works.
 * The menu's Psychiatry group (`phone-mode-groups.ts`) lists the same modes.
 */
export const psychiatrySectionModeIds = [
  "dsm",
  "differentials",
  "specifiers",
  "formulation",
  "therapy-compass",
  "forms",
] as const satisfies readonly AppModeId[];

/** A basic dashboard: one card per section, linking to that section's home. */
export function PsychiatryHome() {
  const presentation = sharedHomePresentation.psychiatry;
  return (
    <InformationPageShell testId="psychiatry-home">
      <PageHeader title={presentation.title} description={presentation.subtitle} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Psychiatry sections">
        {psychiatrySectionModeIds.map((modeId) => {
          const mode = appModeDefinition(modeId);
          return (
            <li key={modeId}>
              <Link
                href={appModeHomeHref(modeId)}
                className={cn(
                  cardSurface,
                  cardPadding.standard,
                  focusRing,
                  "flex min-h-12 items-start gap-3 text-[color:var(--text)] no-underline",
                )}
              >
                <CategoryIconTile icon={APP_MODE_ICON[modeId]} accent={APP_MODE_ACCENT[modeId]} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-base font-semibold text-[color:var(--text-heading)]">{mode.label}</span>
                  <span className={cn("text-sm", textMuted)}>{mode.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </InformationPageShell>
  );
}
