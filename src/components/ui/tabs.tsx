"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useCallback, useId, useRef } from "react";
import { cn } from "@/components/ui-primitives";

export type TabItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Trailing count, rendered with tabular figures so tabs stop twitching. */
  count?: number;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist — required, it is the only label it gets. */
  label: string;
  className?: string;
  /** Panel content, rendered inside the wired `tabpanel`. Omit to own panels yourself. */
  children?: ReactNode;
};

/**
 * Roving tabindex per the ARIA tabs pattern: exactly one tab is in the tab order
 * and Left/Right/Home/End move between them. A tab strip where every tab is
 * tabbable makes a keyboard user press Tab N times to leave the strip.
 * Activation is automatic (selection follows focus), which is correct here
 * because panels are local and cheap.
 */
export function Tabs({ items, value, onChange, label, className, children }: TabsProps) {
  const baseId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // A `value` that matches no enabled tab used to empty the tab order: every tab
  // got `tabIndex={-1}`, so Tab skipped the entire strip and a keyboard user had
  // no way to reach the arrow keys that would fix it. It is not a contrived
  // state — it is what a stale saved filter, a deep link to a removed tab, or a
  // tab that became `disabled` produces.
  //
  // The fallback restores REACHABILITY only. It does not call `onChange`, so the
  // component never silently repairs the caller's state behind its back or fires
  // a selection the user did not make; the strip is simply focusable again, and
  // the first arrow-key press selects.
  const selectedId = items.some((item) => item.id === value && !item.disabled) ? value : null;
  const fallbackTabId = selectedId ?? items.find((item) => !item.disabled)?.id ?? null;

  const focusTab = useCallback(
    (id: string) => {
      refs.current[id]?.focus();
      onChange(id);
    },
    [onChange],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const enabled = items.filter((item) => !item.disabled);
      if (!enabled.length) return;
      const current = Math.max(
        enabled.findIndex((item) => item.id === value),
        0,
      );
      let next: number | null = null;
      if (event.key === "ArrowRight") next = (current + 1) % enabled.length;
      else if (event.key === "ArrowLeft") next = (current - 1 + enabled.length) % enabled.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = enabled.length - 1;
      if (next === null) return;
      event.preventDefault();
      focusTab(enabled[next].id);
    },
    [items, value, focusTab],
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-[color:var(--border)]"
      >
        {items.map((item) => {
          const selected = item.id === value;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              // Only the tab that owns the rendered panel points at it. Other
              // tabs must not aria-controls missing IDs (APG / a11y tree).
              aria-controls={children && item.id === fallbackTabId ? `${baseId}-panel-${fallbackTabId}` : undefined}
              tabIndex={item.id === fallbackTabId ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--disabled)] disabled:shadow-none",
                "-mb-px rounded-t-md border-b-2",
                selected
                  ? "border-[color:var(--command)] text-[color:var(--text-heading)]"
                  : "border-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              )}
            >
              {Icon ? <Icon aria-hidden="true" className="size-icon-sm shrink-0" /> : null}
              {item.label}
              {typeof item.count === "number" ? (
                <span className="nums text-xs font-semibold text-[color:var(--text-muted)]">{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {children ? (
        <div
          role="tabpanel"
          // Wired to the tab that is actually in the DOM and tabbable. Keyed off
          // `value` these dangled whenever `value` matched no enabled tab.
          id={`${baseId}-panel-${fallbackTabId}`}
          aria-labelledby={fallbackTabId ? `${baseId}-tab-${fallbackTabId}` : undefined}
          tabIndex={0}
          className="pt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
