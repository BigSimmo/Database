import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { onCallFeaturedSurface, onCallPressable, onCallRaisedCard } from "@/components/on-call/kit/recipes";
import { onCallHeadingText, onCallSecondaryText } from "@/components/on-call/kit/type";
import { cn } from "@/components/ui-primitives";

/**
 * The raised link card used for "Who do I call now?". Anything taller than
 * 48px is a raised card with a hairline border and heading-colour text in both
 * themes — never the command fill, which inverts to a bright block in dark mode
 * (standard §10, review F12).
 *
 * `featured` is the screen's one featured module (standard v12 §3): the soft
 * mode tint with a mode-border edge. The element carries
 * `data-mode-identity="on-call"` itself so the tokens resolve on it alone. Use it
 * once per screen, for Now's "Who do I call now?".
 */
export function OnCallHeroLink({
  href,
  title,
  subtitle,
  icon: Icon,
  featured = false,
  testId,
}: {
  readonly href: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: LucideIcon;
  readonly featured?: boolean;
  readonly testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      data-mode-identity={featured ? "on-call" : undefined}
      className={cn(
        onCallRaisedCard,
        featured && onCallFeaturedSurface,
        onCallPressable,
        focusRing,
        "flex min-h-14 min-w-0 items-center gap-3 px-3 py-2 no-underline",
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-lg shrink-0 text-[color:var(--text-heading)]" />
      ) : null}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn(onCallHeadingText, "break-words text-base-minus text-[color:var(--text-heading)]")}>
          {title}
        </span>
        {subtitle ? <span className={cn(onCallSecondaryText, "break-words")}>{subtitle}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
    </Link>
  );
}
