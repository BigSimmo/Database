import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";

/**
 * Soft-fill well chip used under a mode-home hero (Tools, Calculators).
 *
 * Visual capsule is 36px; the hit target stays `min-h-tap` (48px) on phones
 * and may tighten to `lg:min-h-9` on desktop, matching the Tools home.
 */
export function ShowAllChip({
  href,
  icon: Icon,
  label = "Show all",
  ariaLabel,
  testId,
}: {
  href: string;
  icon: LucideIcon;
  label?: string;
  ariaLabel: string;
  testId: string;
}) {
  return (
    <div className="flex justify-center">
      <Link
        href={href}
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          "group inline-flex min-h-tap items-center justify-center text-[color:var(--clinical-accent)] lg:min-h-9",
          focusRing,
        )}
      >
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:color-mix(in_srgb,var(--clinical-accent)_14%,var(--surface))] pl-1 pr-3 text-xs font-semibold tracking-[-0.01em] transition group-hover:bg-[color:color-mix(in_srgb,var(--clinical-accent)_20%,var(--surface))] sm:text-sm">
          <span
            data-testid={`${testId}-well`}
            className="grid size-7 shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <Icon className="size-icon-sm" strokeWidth={1.75} aria-hidden="true" />
          </span>
          {label}
        </span>
      </Link>
    </div>
  );
}
