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
  /** `tabs` underlines the active item; `segmented` fills it inside a track. */
  variant?: "tabs" | "segmented";
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
export function Tabs({ items, value, onChange, label, variant = "tabs", className, children }: TabsProps) {
  const baseId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const segmented = variant === "segmented";

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className={cn(
          "flex min-w-0 items-center overflow-x-auto",
          segmented
            ? "gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1"
            : "gap-1 border-b border-[color:var(--border)]",
        )}
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
              // Only the selected tab points at the live panel. Unselected
              // tabs must not aria-controls missing IDs (APG / a11y tree).
              aria-controls={children && selected ? `${baseId}-panel-${item.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--disabled)] disabled:shadow-none",
                segmented ? "rounded-md" : "-mb-px rounded-t-md border-b-2",
                segmented
                  ? selected
                    ? "bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] shadow-[var(--shadow-tight)]"
                    : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                  : selected
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
          id={`${baseId}-panel-${value}`}
          aria-labelledby={`${baseId}-tab-${value}`}
          tabIndex={0}
          className="pt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
