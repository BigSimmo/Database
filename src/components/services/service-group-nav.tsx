"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import { serviceCoreGroups, type ServiceCoreGroupId } from "@/lib/service-core-groups";

type GroupValue = ServiceCoreGroupId | null;

export function ServiceGroupNav({
  activeGroup,
  hrefForGroup,
  counts,
  className,
}: {
  activeGroup: GroupValue;
  hrefForGroup: (group: GroupValue) => string;
  counts?: Partial<Record<ServiceCoreGroupId, number>> & { all?: number };
  className?: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const panelId = useId();
  const phonePrimary = serviceCoreGroups.slice(0, 2);
  const phoneMore = serviceCoreGroups.slice(2);
  const moreActive = phoneMore.some((group) => group.id === activeGroup);

  const groupLink = (group: (typeof serviceCoreGroups)[number], phone = false) => (
    <Link
      key={group.id}
      href={hrefForGroup(group.id)}
      aria-current={activeGroup === group.id ? "page" : undefined}
      onClick={() => setMoreOpen(false)}
      className={cn(
        "inline-flex min-h-tap min-w-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10",
        activeGroup === group.id
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
      )}
    >
      <span className={phone ? "truncate" : "text-center leading-4"}>{phone ? group.shortLabel : group.label}</span>
      {typeof counts?.[group.id] === "number" ? (
        <span className="nums text-2xs text-[color:var(--text-muted)]">{counts[group.id]}</span>
      ) : null}
    </Link>
  );

  return (
    <nav aria-label="Service groups" className={cn("min-w-0", className)}>
      <div className="hidden grid-cols-5 gap-2 sm:grid">
        <Link
          href={hrefForGroup(null)}
          aria-current={activeGroup === null ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            activeGroup === null
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
          )}
        >
          All
          {typeof counts?.all === "number" ? <span className="nums text-2xs">{counts.all}</span> : null}
        </Link>
        {serviceCoreGroups.map((group) => groupLink(group))}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:hidden">
        <Link
          href={hrefForGroup(null)}
          aria-current={activeGroup === null ? "page" : undefined}
          className={cn(
            "inline-flex min-h-tap items-center justify-center rounded-lg border px-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            activeGroup === null
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
          )}
        >
          All
        </Link>
        {phonePrimary.map((group) => groupLink(group, true))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-controls={moreOpen ? panelId : undefined}
          className={cn(
            "inline-flex min-h-tap items-center justify-center gap-1 rounded-lg border px-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
            moreActive
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
          )}
        >
          More
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More service groups"
        description="Browse the remaining high-yield service groups."
        id={panelId}
        testId="service-group-more-sheet"
      >
        <div className="grid gap-2">{phoneMore.map((group) => groupLink(group))}</div>
      </Sheet>
    </nav>
  );
}
