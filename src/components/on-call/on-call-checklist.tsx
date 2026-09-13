"use client";

import { Check } from "lucide-react";

import { focusRing } from "@/components/card-recipes";
import { cn, textMuted } from "@/components/ui-primitives";
import {
  onCallChecklistItemKey,
  toggleOnCallChecklistItem,
  useOnCallChecklists,
} from "@/lib/on-call/checklist-storage";

export interface OnCallChecklistItem {
  text: string;
  note?: string;
}

/**
 * The drawing's orientation checklist: what to do in your first fifteen
 * minutes, and what to hand back before a term ends.
 *
 * Done items grey and strike through, so what remains is what stands out —
 * board 10's own note, and the reason a checklist beats prose here at all.
 *
 * The ticks live in this browser only (`checklist-storage.ts`) and are cleared
 * on sign-out. A tick is a statement about a person, not about the hub, and
 * on a shared ward computer the next registrar must start unticked rather than
 * inherit someone's progress and skip a step.
 */
export function OnCallChecklist({
  entryId,
  slug,
  items,
  label,
}: {
  entryId: string;
  /** For the testid, so a checklist is addressable by the entry it belongs to. */
  slug: string;
  items: readonly OnCallChecklistItem[];
  /** What the list is, for assistive technology. */
  label: string;
}) {
  const done = useOnCallChecklists();
  if (items.length === 0) return null;

  return (
    <ul aria-label={label} className="grid gap-1" data-testid={`on-call-orientation-checklist-${slug}`}>
      {items.map((item, index) => {
        const key = onCallChecklistItemKey(entryId, item.text);
        const isDone = done.has(key);
        return (
          <li key={`${key}-${index}`}>
            <button
              type="button"
              onClick={() => toggleOnCallChecklistItem(key, !isDone)}
              aria-pressed={isDone}
              className={cn(
                "flex min-h-tap w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left",
                "transition-colors motion-reduce:transition-none hover:bg-[color:var(--surface-subtle)]",
                focusRing,
              )}
            >
              {/* A box and a tick, never colour alone: the struck-through text
                  says the same thing a second way. */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border",
                  isDone
                    ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success)]"
                    : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                )}
              >
                {isDone ? <Check className="size-icon-xs" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 flex-1 grid gap-0.5">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isDone ? "text-[color:var(--text-muted)] line-through" : "text-[color:var(--text-heading)]",
                  )}
                >
                  {item.text}
                </span>
                {item.note ? <span className={cn(textMuted, "text-xs leading-5")}>{item.note}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
