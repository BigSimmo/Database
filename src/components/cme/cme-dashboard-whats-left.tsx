"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cardSurface } from "@/components/card-recipes";
import { CmeRequirementMeter } from "@/components/cme/cme-progress-visuals";
import { cn, textMuted } from "@/components/ui-primitives";
import { isHoursRequirementShape, rankRequirementsByGap } from "@/lib/cme/requirement-gaps";
import type { CmeRequirement, CmeRequirementSet, CmeRequirementStatus } from "@/lib/cme/types";

/**
 * TODAY'S "WHAT'S LEFT": every requirement once, as one list.
 *
 * Unmet requirements read first, biggest gap first (`rankRequirementsByGap`:
 * hours by hours to go, then empty practice domains, then tasks not started),
 * each with its own status wording ("15 h to go", "Not started") and a slim
 * bar. Met requirements fold under "N done", so the list is the work left and
 * not a scoreboard. Shortfall reads through position and wording — never red,
 * amber or green.
 *
 * A row opens what is behind it: an hours figure opens Today's detail sheet
 * (which activities make it up, and Log filtered to them); a task opens its
 * place on the setup screen; a practice-domain count opens the Log form.
 *
 * When the next step is the furthest-from-met requirement (`nextStepInList`),
 * the first row IS that step, so it carries the `cme-next-action` test id and
 * Today does not repeat it as a separate row.
 */
export function CmeWhatsLeft({
  set,
  statuses,
  nextStepInList,
  onOpenRequirement,
}: {
  set: CmeRequirementSet;
  statuses: readonly CmeRequirementStatus[];
  nextStepInList: boolean;
  onOpenRequirement: (requirementId: string) => void;
}) {
  if (statuses.length === 0) return null;
  const ranked = rankRequirementsByGap(set, statuses);
  const left = ranked.filter((status) => !status.met);
  const done = ranked.filter((status) => status.met);

  function row(status: CmeRequirementStatus, isNext: boolean) {
    const requirement = set.requirements.find((item) => item.id === status.requirementId);
    return (
      <li
        key={status.requirementId}
        data-met={status.met ? "true" : "false"}
        data-testid={isNext ? "cme-next-action" : undefined}
      >
        <RowControl set={set} requirement={requirement} onOpenRequirement={onOpenRequirement}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-[color:var(--text)]">
              {requirement?.label ?? status.requirementId}
            </span>
            <span className={cn(textMuted, "nums block text-sm font-normal")}>{status.summary}</span>
          </span>
          <CmeRequirementMeter progress={status.progress} met={status.met} />
          <ChevronRight aria-hidden="true" className={cn("size-icon-sm shrink-0", textMuted)} />
        </RowControl>
      </li>
    );
  }

  return (
    <div className={cn(cardSurface, "overflow-hidden")}>
      {left.length > 0 ? (
        <ul className="divide-y divide-[color:var(--border)]">
          {left.map((status, index) => row(status, nextStepInList && index === 0))}
        </ul>
      ) : null}
      {done.length > 0 ? (
        <details
          data-testid="cme-requirements-done"
          className={cn("group", left.length > 0 && "border-t border-[color:var(--border)]")}
        >
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-[color:var(--text-muted)] [&::-webkit-details-marker]:hidden">
            <span className="nums">{`${done.length} done`}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-icon-sm shrink-0 motion-safe:transition-transform motion-safe:duration-[var(--duration-fast)] group-open:rotate-180"
            />
          </summary>
          <ul className="divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
            {done.map((status) => row(status, false))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

const ROW = "flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left";

function RowControl({
  set,
  requirement,
  onOpenRequirement,
  children,
}: {
  set: CmeRequirementSet;
  requirement: CmeRequirement | undefined;
  onOpenRequirement: (requirementId: string) => void;
  children: ReactNode;
}) {
  if (requirement && isHoursRequirementShape(requirement.spec.shape)) {
    return (
      <button type="button" className={ROW} onClick={() => onOpenRequirement(requirement.id)}>
        {children}
      </button>
    );
  }
  const href =
    requirement?.spec.shape === "task"
      ? `/cme/setup?year=${set.year}#cme-requirement-${encodeURIComponent(requirement.id)}`
      : `/cme/new?year=${set.year}`;
  return (
    <Link href={href} className={ROW}>
      {children}
    </Link>
  );
}
