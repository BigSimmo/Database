"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn, textMuted } from "@/components/ui-primitives";
import type { CmeTodoRow } from "@/lib/cme/todo";

/** Short chip names for the "to finish" rows `buildCmeTodo` already computes. */
const CHIP_LABELS: Record<string, string> = {
  copy: "Not copied",
  drafts: "Drafts to finish",
  reflection: "Reflections to add",
  evidence: "Certificates to add",
};

const CHIP =
  "inline-flex min-h-tap items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] py-1 pl-3.5 pr-2.5 text-sm text-[color:var(--text)] shadow-[var(--e0)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function Chip({ href, label, count, testId }: { href: string; label: string; count: string; testId?: string }) {
  return (
    <li>
      <Link href={href} data-testid={testId} className={CHIP}>
        <span>{label}</span>
        <span className={cn(textMuted, "nums font-normal")}>{count}</span>
        <ChevronRight aria-hidden="true" className={cn("size-icon-xs shrink-0", textMuted)} />
      </Link>
    </li>
  );
}

/**
 * Today's row of small things to finish, one chip each, so none of them takes
 * a card of its own: activities not yet copied to the CPD home (opening Log's
 * one-at-a-time copy view), the year check's progress, drafts, and missing
 * reflections or certificates. Only rows with something in them appear, and
 * the counts come from the same `buildCmeTodo` the Log page's "To finish"
 * reads, so the two never disagree.
 */
export function CmeTodayShortcuts({
  toFinish,
  yearCheck,
}: {
  toFinish: readonly CmeTodoRow[];
  yearCheck: { readonly href: string; readonly readyCount: number; readonly rowCount: number };
}) {
  return (
    <ul aria-label="To finish" data-testid="cme-today-shortcuts" className="flex flex-wrap gap-2">
      {toFinish
        .filter((item) => item.id === "copy")
        .map((item) => (
          <Chip key={item.id} href={item.href} label={CHIP_LABELS.copy} count={String(item.count ?? 0)} />
        ))}
      <Chip
        href={yearCheck.href}
        label="Year check"
        count={`${yearCheck.readyCount} of ${yearCheck.rowCount}`}
        testId="cme-year-check-link"
      />
      {toFinish
        .filter((item) => item.id !== "copy")
        .map((item) => (
          <Chip
            key={item.id}
            href={item.href}
            label={CHIP_LABELS[item.id] ?? item.label}
            count={String(item.count ?? 0)}
          />
        ))}
    </ul>
  );
}
