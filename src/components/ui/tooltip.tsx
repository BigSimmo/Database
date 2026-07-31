"use client";

import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "@/components/ui-primitives";

export type TooltipProps = {
  /** The trigger. Must accept a ref-free set of DOM props (a button, link, or span). */
  children: ReactElement<Record<string, unknown>>;
  /** Tooltip content. Supplementary only — never the sole carrier of meaning. */
  content: ReactNode;
  placement?: "top" | "bottom";
  className?: string;
};

/**
 * A tooltip that opens on hover AND keyboard focus, and closes on Escape. Hover-only
 * tooltips are invisible to keyboard and switch users, which is why focus is wired
 * here rather than left to call sites.
 *
 * The content is attached with `aria-describedby`, not `aria-label`: a tooltip
 * supplements a control's name, it does not replace it. A control whose only name
 * would be its tooltip needs a real accessible name instead.
 */
export function Tooltip({ children, content, placement = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  if (!isValidElement(children)) return <>{children}</>;

  const trigger = cloneElement(children, {
    "aria-describedby": open ? id : undefined,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      {open ? (
        <span
          role="tooltip"
          id={id}
          data-testid="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-[95] w-max max-w-xs -translate-x-1/2 rounded-md bg-[color:var(--surface-raised)] px-2 py-1 text-xs text-[color:var(--text)] shadow-[var(--shadow-hover)] ring-1 ring-[color:var(--border-lux)]",
            placement === "top" ? "bottom-[calc(100%+0.375rem)]" : "top-[calc(100%+0.375rem)]",
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
