"use client";

import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { cn, textMuted } from "@/components/ui-primitives";

export type DisclosureProps = {
  title: ReactNode;
  children: ReactNode;
  /** Right-aligned summary that stays visible while collapsed — a count, a status. */
  meta?: ReactNode;
  description?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode. Omit both to let the component own its state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

/**
 * Expand/collapse, built once instead of five times.
 *
 * The trigger is a real `<button>` carrying BOTH `aria-expanded` and
 * `aria-controls`. `aria-expanded` alone says something opened but never what —
 * that exact gap was the `AccessibleTable` expander defect.
 *
 * The panel is kept in the DOM and hidden with `hidden` rather than unmounted, so
 * the content is there to be revealed rather than re-fetched. On screen, `hidden`
 * is `display:none`, so a collapsed panel is genuinely out of the accessibility
 * tree and out of Ctrl-F — that is correct for a control the reader can open, and
 * the docstring here used to claim otherwise.
 *
 * Print is the case where it is NOT correct. A printed page has no disclosure to
 * open, so a collapsed section prints as if the guideline never mentioned it —
 * exactly the failure this component is supposed to prevent, made permanent on
 * paper and unnoticeable, because the reader holding the printout has no way to
 * tell a section was omitted. `print:block` on the panel (author styles beat the
 * UA `[hidden]` rule) expands every collapsed section for print; the chevron is
 * dropped, since a rotated arrow means nothing on paper.
 *
 * No height animation. Animating `height` or `grid-template-rows` forces layout
 * every frame and is a measurable CLS contributor; the chevron rotates on
 * `transform` instead, which is free.
 */
export function Disclosure({
  title,
  children,
  meta,
  description,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  headingLevel = 3,
}: DisclosureProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";

  function toggle() {
    const next = !open;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div
      data-testid="disclosure"
      className={cn(
        "overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]",
        // A print-expanded panel must not be clipped by the collapsed-height
        // container it was sized for.
        "print:overflow-visible",
        className,
      )}
    >
      <Heading className="m-0">
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-h-tap w-full items-center gap-2 px-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-icon-sm shrink-0 text-[color:var(--text-muted)] transition-transform duration-[var(--duration-fast)]",
              "motion-reduce:transition-none print:hidden",
              open && "rotate-90",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
            {description ? <span className={cn("block truncate text-xs", textMuted)}>{description}</span> : null}
          </span>
          {meta ? <span className="nums shrink-0 text-xs text-[color:var(--text-muted)]">{meta}</span> : null}
        </button>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${id}-trigger`}
        hidden={!open}
        data-open={open ? "true" : "false"}
        className="border-t border-[color:var(--border)] px-3 py-3 print:block"
      >
        {children}
      </div>
    </div>
  );
}

export type DisclosureGroupProps = {
  items: Array<{ id: string; title: ReactNode; description?: ReactNode; meta?: ReactNode; content: ReactNode }>;
  exclusive?: boolean;
  className?: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

/**
 * A stack of disclosures. `exclusive` makes it an accordion (one open at a time);
 * the default lets several stay open, which is usually right for reference
 * content where a reader compares two sections.
 */
export function DisclosureGroup({ items, exclusive = false, className, headingLevel = 3 }: DisclosureGroupProps) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => (
        <Disclosure
          key={item.id}
          title={item.title}
          description={item.description}
          meta={item.meta}
          headingLevel={headingLevel}
          open={openIds.includes(item.id)}
          onOpenChange={(next) =>
            setOpenIds((current) => {
              if (!next) return current.filter((id) => id !== item.id);
              return exclusive ? [item.id] : [...current, item.id];
            })
          }
        >
          {item.content}
        </Disclosure>
      ))}
    </div>
  );
}
