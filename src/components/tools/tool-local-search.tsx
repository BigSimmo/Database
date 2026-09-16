"use client";

import { Plus, Search } from "lucide-react";
import type { FormEvent } from "react";

import { focusRing } from "@/components/card-recipes";
import { cn, searchShellInput } from "@/components/ui-primitives";

/**
 * The tools directory's own filter box, ported from the retired `/?mode=tools` hub.
 *
 * `/tools` deliberately renders no shared composer — it owns its own filtering — but
 * until the hub was consolidated away this was the only place a clinician could type
 * a tools search, and the directory had no input at all. So the box came here with the
 * shortcut row rather than being lost with the hub.
 *
 * In-flow, never fixed: the search-chrome contract allows a page to own its filtering,
 * but not to stack a second dock-sized bar over the shared chrome.
 */
export function ToolLocalSearch({
  value,
  onChange,
  onSubmit,
  className,
}: {
  value: string;
  onChange: (query: string) => void;
  onSubmit: () => void;
  className?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        // Both end tracks hold tap-sized children and the row has no gap, so they read
        // the tap knob rather than a copy of its value: a literal here overlaps the
        // input the moment `--spacing-tap` moves.
        "search-shell grid min-h-13 grid-cols-[var(--spacing-tap)_minmax(0,1fr)_var(--spacing-tap)] items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] text-left shadow-[var(--e2)]",
        className,
      )}
    >
      <span className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--clinical-accent)]">
        <Plus className="size-icon-lg" aria-hidden />
      </span>
      <label className="min-w-0">
        <span className="sr-only">Search tools</span>
        <input
          data-testid="tools-local-search-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search tools..."
          className={cn(
            searchShellInput,
            "w-full text-sm font-medium text-[color:var(--text)] placeholder:text-[color:var(--text-placeholder)]",
          )}
        />
      </label>
      <button
        type="submit"
        aria-label="Open selected tool"
        data-testid="tools-local-search-submit"
        className={cn(
          "grid h-tap w-tap place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--clinical-accent-hover)]",
          focusRing,
        )}
      >
        <Search className="size-icon-lg" aria-hidden />
      </button>
    </form>
  );
}
