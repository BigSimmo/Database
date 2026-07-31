"use client";

import { Sheet } from "@/components/ui/sheet";

import { outlineControl, softControl } from "./controls";
import { CheckIcon, SlidersIcon, XIcon } from "./icons";

/**
 * The phone filtering surface for therapy search.
 *
 * It replaces two native `<select>`s that were faking multi-select: options
 * carried a literal `"✓ "` prefix to show selection, `value` was pinned to `""`
 * so nothing was ever actually selected, and the placeholder row did the
 * reporting ("3 topics selected"). Assistive technology was told "combobox, no
 * selection" while the visible text said otherwise, choosing an already-chosen
 * option silently deselected it, and the availability select carried a
 * "Clear filters" *action* among its options. None of that is expressible in a
 * listbox.
 *
 * The controls here are the same `aria-pressed` toggles the wide viewport has
 * always used, so both breakpoints now describe the same state the same way.
 */
export function TherapyFilterSheet({
  open,
  panelId,
  onClose,
  topics,
  activeTopics,
  onToggleTopic,
  reviewedOnly,
  onToggleReviewed,
  briefOnly,
  onToggleBrief,
  onClear,
  resultCount,
}: {
  open: boolean;
  panelId: string;
  onClose: () => void;
  topics: readonly string[];
  activeTopics: readonly string[];
  onToggleTopic: (topic: string) => void;
  reviewedOnly: boolean;
  onToggleReviewed: () => void;
  briefOnly: boolean;
  onToggleBrief: () => void;
  onClear: () => void;
  resultCount: number;
}) {
  const activeCount = activeTopics.length + Number(reviewedOnly) + Number(briefOnly);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filter therapies"
      portal
      id={panelId}
      testId="therapy-filter-panel"
      headerActions={
        activeCount > 0 ? (
          <button
            type="button"
            onClick={onClear}
            data-testid="therapy-filter-clear"
            className={`tc-btn ${outlineControl}`}
          >
            <XIcon size={15} strokeWidth={1.8} />
            Clear all
          </button>
        ) : null
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span aria-live="polite" className="nums mr-auto text-2xs font-semibold">
            {resultCount} therap{resultCount === 1 ? "y" : "ies"}
          </span>
          <button type="button" onClick={onClose} data-testid="therapy-filter-done" className={`tc-btn ${softControl}`}>
            Show {resultCount} therap{resultCount === 1 ? "y" : "ies"}
          </button>
        </div>
      }
    >
      <section className="min-w-0">
        <h3 className="text-2xs font-bold uppercase tracking-eyebrow">Topics</h3>
        <div role="group" aria-label="Therapy topics" className="mt-2 flex flex-wrap gap-1.5">
          {topics.map((topic) => {
            const on = activeTopics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() => onToggleTopic(topic)}
                aria-pressed={on}
                className={`tc-btn ${softControl}${on ? " tc-is-selected" : ""}`}
              >
                {on ? <CheckIcon size={14} strokeWidth={2} /> : null}
                {topic}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 min-w-0">
        <h3 className="text-2xs font-bold uppercase tracking-eyebrow">Availability</h3>
        <div role="group" aria-label="Therapy availability" className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onToggleReviewed}
            aria-pressed={reviewedOnly}
            className={`tc-btn ${softControl}${reviewedOnly ? " tc-is-success" : ""}`}
          >
            {reviewedOnly ? <CheckIcon size={14} strokeWidth={2} /> : null}
            Reviewed only
          </button>
          <button
            type="button"
            onClick={onToggleBrief}
            aria-pressed={briefOnly}
            className={`tc-btn ${softControl}${briefOnly ? " tc-is-selected" : ""}`}
          >
            {briefOnly ? <CheckIcon size={14} strokeWidth={2} /> : null}
            Brief available
          </button>
        </div>
      </section>
    </Sheet>
  );
}

/** Opens the therapy filter sheet and reports how many filters are active. */
export function TherapyFilterTrigger({
  panelId,
  open,
  activeCount,
  onToggle,
}: {
  panelId: string;
  open: boolean;
  activeCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open ? panelId : undefined}
      data-testid="therapy-filter-trigger"
      title="Filter therapies"
      className={`tc-btn ${softControl}${activeCount > 0 ? " tc-is-selected" : ""}`}
    >
      <SlidersIcon size={15} strokeWidth={1.8} />
      Filter
      {activeCount > 0 ? <span className="nums">{activeCount}</span> : null}
      <span className="sr-only">
        {activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "No filters active"}
      </span>
    </button>
  );
}
