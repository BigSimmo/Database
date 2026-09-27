import type { LucideIcon } from "lucide-react";

import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";

/**
 * A labelled action for First Nations sheets and panels ("Add to letter",
 * "Copy steps", "Call liaison"). Outlined by default; `filled` is the neutral
 * command fill and is used for the one filled button on a screen or sheet
 * (`data-fn-filled` marks it so tests can count them). Never the mode colour.
 *
 * Like the kit's `ModeActionButton`, the props require a destination or an
 * action, so a button that does nothing cannot be written. Links are plain
 * anchors because they are `tel:` and `mailto:` hrefs, not app routes.
 * Candidate to move into the mode kit as a labelled sibling of `ModeActionButton`.
 */
export type FnButtonProps = {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly filled?: boolean;
  readonly className?: string;
} & ({ readonly href: string; readonly onClick?: never } | { readonly onClick: () => void; readonly href?: never });

const shape = {
  outlined:
    "border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] active:bg-[color:var(--surface-wash)]",
  filled: "border border-transparent bg-[color:var(--command)] text-[color:var(--command-contrast)]",
} as const;

export function FnButton({ label, icon: Icon, filled = false, className, href, onClick }: FnButtonProps) {
  const classes = cn(
    focusRing,
    "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-md px-4 text-sm-minus font-medium",
    filled ? shape.filled : shape.outlined,
    className,
  );
  const body = (
    <>
      {Icon ? <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-md shrink-0" /> : null}
      {label}
    </>
  );
  if (href) {
    return (
      <a href={href} className={classes} data-fn-filled={filled ? "" : undefined}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} data-fn-filled={filled ? "" : undefined}>
      {body}
    </button>
  );
}
