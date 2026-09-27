import type { ElementType, ReactNode } from "react";

import { modeFeaturedSurface, modeRaisedCard } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

/**
 * The screen's one featured module (standard §3), for a module whose body is
 * more than one link's worth of content.
 *
 * `ModeHeroLink` already draws the soft mode tint, but only around a single
 * link with a title, a subtitle and a chevron — it cannot host a card with a
 * status line, a progress bar and two buttons of its own. This wraps
 * arbitrary children in the same raised-card-plus-tint treatment, with a 2px
 * identity edge (rather than the hero link's hairline) so a taller, busier
 * card still reads as tinted rather than merely bordered.
 *
 * `data-mode-identity={mode}` is set on the element itself, per the recipes.ts
 * contract for the mode-identity tokens: nothing around this module is
 * repainted, and a caller (never a file under `src/components/admin/**`,
 * which may not set the attribute itself) supplies `mode` as a prop rather
 * than writing the attribute literally. Use it once per screen.
 */
export function ModeFeaturedModule({
  mode,
  children,
  className,
  as: Tag = "div",
  testId,
}: {
  /** The mode identity this module is tinted with, e.g. `my-work`. */
  readonly mode: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly as?: ElementType;
  readonly testId?: string;
}) {
  return (
    <Tag
      data-mode-identity={mode}
      data-testid={testId}
      className={cn(modeRaisedCard, modeFeaturedSurface, "border-2", className)}
    >
      {children}
    </Tag>
  );
}
