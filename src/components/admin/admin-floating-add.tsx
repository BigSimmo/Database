"use client";

import { Plus } from "lucide-react";

import { cn, primaryControl } from "@/components/ui-primitives";

/**
 * Josh, 16:31Z: "+ Add" is a floating dark button on Renewals (and Pay in update 2).
 * The same button as CPD's `CmeQuickLog`: the neutral command fill at 600, never
 * the mode brown. Admin has no results surface and so no bottom search dock, so it
 * never sits on a composer (Task 10's phone journey checks this).
 */
export function AdminFloatingAdd({ label, onClick, testId }: { label: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      className={cn(
        primaryControl,
        "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[var(--z-chrome)] rounded-full shadow-[var(--e4)] print:hidden",
      )}
    >
      <Plus aria-hidden="true" className="size-icon-sm" />
      Add
    </button>
  );
}
