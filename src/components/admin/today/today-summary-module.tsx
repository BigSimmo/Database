import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { modeModuleSurface } from "@/components/mode-kit/recipes";
import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * The module header mode-kit does not offer yet: an eyebrow with an icon, AND
 * a trailing "Open" link. `ModeGroupedList`'s eyebrow has a header icon in the
 * mode colour but no trailing link, so "Requirements" and "New job" build
 * their header with this instead of a second copy of the eyebrow row.
 *
 * The icon tile here is plain grey, not the mode-brown 16px tile
 * `ModeGroupedList` draws: only the pill and `AdminNavHeader`'s rail may carry
 * the mode identity marker outside mode-kit itself, and a design-contract
 * guard enforces that for every file under `src/components/admin`, this one
 * included. Kept local rather than added to the kit — see the lane report's
 * Integration ask, which asks for a kit header that carries both the mode
 * icon tile and a trailing link.
 */
export function TodaySummaryModule({
  eyebrow,
  icon: Icon,
  /** Omitted for a module with nowhere further to send the reader (e.g. "Needs you"). */
  openHref,
  openLabel = "Open",
  testId,
  children,
}: {
  readonly eyebrow: string;
  readonly icon: LucideIcon;
  readonly openHref?: string;
  readonly openLabel?: string;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-2" data-testid={testId}>
      <div className="flex min-w-0 items-center gap-2 px-3">
        <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
        <h2 className={cn(eyebrowText, "min-w-0 flex-1")}>{eyebrow}</h2>
        {openHref ? (
          <Link
            href={openHref}
            className={cn(focusRing, "shrink-0 rounded-sm text-sm font-medium text-[color:var(--clinical-accent)]")}
            data-testid={testId ? `${testId}-open` : undefined}
          >
            {openLabel}
          </Link>
        ) : null}
      </div>
      <div className={modeModuleSurface}>{children}</div>
    </section>
  );
}
