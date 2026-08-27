"use client";

import { cn, searchFocusRing } from "@/components/ui-primitives";
import { PRIVACY_SECTIONS, type PrivacySectionId } from "@/lib/privacy-page-content";

/**
 * The numbered section rail. One implementation, two mounts: the sticky desktop
 * aside and the phone "Jump to a section" disclosure. Before this, the index was
 * `lg:`-only, so a phone reader wanting "Retention" had to scroll past six
 * sections to reach it.
 */
export function PrivacySectionIndex({
  activeId,
  onSelect,
  idPrefix,
}: {
  activeId: PrivacySectionId | null;
  onSelect: (id: PrivacySectionId) => void;
  idPrefix: string;
}) {
  return (
    <nav aria-label="Privacy sections" className="grid gap-0.5">
      {PRIVACY_SECTIONS.map((section, index) => {
        const active = activeId === section.id;
        return (
          <button
            key={section.id}
            type="button"
            id={`${idPrefix}-index-${section.id}`}
            onClick={() => onSelect(section.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "relative flex min-h-tap w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-left transition",
              searchFocusRing,
              active
                ? "bg-[color:var(--clinical-accent-soft)]/55 text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "nums grid h-6 w-7 shrink-0 place-items-center rounded text-3xs font-extrabold",
                active
                  ? "bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                  : "text-[color:var(--text-muted)]",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{section.short}</span>
              <span className="mt-0.5 block truncate text-3xs leading-3 text-[color:var(--text-muted)]">
                {section.gist}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
