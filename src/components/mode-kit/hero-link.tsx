import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { modeFeaturedSurface, modePressable, modeRaisedCard } from "@/components/mode-kit/recipes";
import { modeHeadingText, modeSecondaryText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";

/**
 * A raised link card ("Who do I call now?"). Anything taller than 48px is a
 * raised card with a hairline border and heading-colour text in both themes —
 * never the command fill, which inverts to a bright block in dark mode
 * (standard §10).
 *
 * `featured` makes it the screen's one featured module (standard §3): the soft
 * mode tint with a mode-border edge, resolved from `data-mode-identity={mode}`
 * on the element itself. Use it once per screen.
 */
export function ModeHeroLink({
  href,
  title,
  subtitle,
  icon: Icon,
  featured = false,
  mode,
  testId,
}: {
  readonly href: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: LucideIcon;
  readonly featured?: boolean;
  /** The mode identity a featured card is tinted with, e.g. `on-call`. */
  readonly mode?: string;
  readonly testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      data-mode-identity={featured ? mode : undefined}
      className={cn(
        modeRaisedCard,
        featured && modeFeaturedSurface,
        modePressable,
        focusRing,
        "flex min-h-14 min-w-0 items-center gap-3 px-3 py-2 no-underline",
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-lg shrink-0 text-[color:var(--text-heading)]" />
      ) : null}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn(modeHeadingText, "break-words text-base-minus text-[color:var(--text-heading)]")}>
          {title}
        </span>
        {subtitle ? <span className={cn(modeSecondaryText, "break-words")}>{subtitle}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
    </Link>
  );
}
