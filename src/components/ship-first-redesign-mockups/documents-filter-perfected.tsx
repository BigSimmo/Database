"use client";

import { useState } from "react";
import { FileText, ListFilter, X } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { AppShell, ComposerPill, DeviceFrame, Pair, SectionIntro, focusRing } from "./shared";

const FACET_GROUPS = [
  {
    label: "Format",
    options: [
      { id: "pdf", label: "PDF", count: 18 },
      { id: "tables", label: "Tables", count: 6 },
      { id: "images", label: "Images", count: 4 },
    ],
  },
  {
    label: "Document type",
    options: [
      { id: "guideline", label: "Guideline", count: 11 },
      { id: "policy", label: "Policy", count: 5 },
      { id: "form", label: "Form", count: 3 },
    ],
  },
  {
    label: "Currency",
    options: [
      { id: "current", label: "Current only", count: 14 },
      { id: "review", label: "Review due", count: 4 },
    ],
  },
] as const;

function FilterPanelBody({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="grid gap-4">
      {FACET_GROUPS.map((group) => (
        <fieldset key={group.label} className="min-w-0">
          <legend className="mb-2 text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            {group.label}
          </legend>
          <div className="grid gap-1.5">
            {group.options.map((option) => {
              const on = selected.has(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onToggle(option.id)}
                  className={cn(
                    "flex h-10 items-center justify-between rounded-lg border px-3 text-left text-2xs font-semibold",
                    focusRing,
                    on
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-heading)]",
                  )}
                  aria-pressed={on}
                >
                  <span>{option.label}</span>
                  <span className="tabular-nums text-[color:var(--text-soft)]">{option.count}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3">
        <button
          type="button"
          onClick={onClear}
          className={cn("text-2xs font-bold text-[color:var(--text-muted)]", focusRing)}
        >
          Clear all
        </button>
        <span className="inline-flex h-10 items-center rounded-lg bg-[color:var(--clinical-accent)] px-4 text-2xs font-bold text-[color:var(--surface)]">
          Show results
        </span>
      </div>
    </div>
  );
}

function DocumentsFilterFrame({ device }: { device: "desktop" | "phone" }) {
  const phone = device === "phone";
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(["pdf", "guideline"]));

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applied = [...selected];

  return (
    <DeviceFrame device={device} label={phone ? "Phone bottom sheet" : "Desktop filter dialog"}>
      <AppShell
        device={device}
        active="documents"
        modeLabel="Documents"
        ModeIcon={FileText}
        dock={
          phone ? (
            <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <ComposerPill value="clozapine monitoring" phone />
            </div>
          ) : undefined
        }
      >
        <div className={cn("relative", phone ? "px-3 pb-4 pt-3" : "px-6 py-5")}>
          <h3
            className={cn(
              "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
              phone ? "text-2xl" : "text-3xl",
            )}
          >
            clozapine monitoring
          </h3>
          <p className="mt-1 text-2xs font-medium text-[color:var(--text-muted)]">12 documents · filtered</p>

          {!phone ? (
            <div className="mt-4 max-w-2xl">
              <ComposerPill value="clozapine monitoring" />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-3 text-2xs font-bold text-[color:var(--clinical-accent)]",
                focusRing,
              )}
              aria-expanded={open}
              aria-controls={`docs-filter-${device}`}
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden />
              Filter{applied.length ? ` · ${applied.length}` : ""}
            </button>
            {applied.map((id) => (
              <span
                key={id}
                className="inline-flex h-9 items-center rounded-full border border-[color:var(--border)] px-2.5 text-2xs font-semibold text-[color:var(--text-muted)]"
              >
                {id}
              </span>
            ))}
          </div>

          <div className="mt-3 grid gap-2">
            {["Clozapine protocol — WA", "ANC monitoring table", "Myocarditis alert card"].map((title) => (
              <div
                key={title}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 text-sm font-semibold text-[color:var(--text-heading)]"
              >
                {title}
              </div>
            ))}
          </div>

          {open ? (
            phone ? (
              <div
                id={`docs-filter-${device}`}
                className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-elevated)]"
                role="dialog"
                aria-modal="true"
                aria-label="Filter documents"
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color:var(--border-strong)]" aria-hidden />
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-[color:var(--text-heading)]">Filter documents</h4>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)]",
                      focusRing,
                    )}
                    aria-label="Close filter"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <FilterPanelBody selected={selected} onToggle={toggle} onClear={() => setSelected(new Set())} />
              </div>
            ) : (
              <div
                id={`docs-filter-${device}`}
                className="absolute inset-0 z-20 grid place-items-center bg-[color:color-mix(in_srgb,var(--text-heading)_28%,transparent)] p-6"
                role="presentation"
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Filter documents"
                  className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-elevated)]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-base font-extrabold text-[color:var(--text-heading)]">Filter documents</h4>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)]",
                        focusRing,
                      )}
                      aria-label="Close filter"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <FilterPanelBody selected={selected} onToggle={toggle} onClear={() => setSelected(new Set())} />
                </div>
              </div>
            )
          ) : null}
        </div>
      </AppShell>
    </DeviceFrame>
  );
}

export function DocumentsFilterPerfectedSection() {
  return (
    <section id="documents-filter" aria-labelledby="documents-filter-title" className="scroll-mt-8">
      <SectionIntro
        issue="#170 · #171"
        title="Documents filter cleanup"
        body="One Filter control opens one panel. On phone it is a bottom sheet — not a cramped horizontal rail. Format, document type, and currency live together so filtering is learned once."
        pick="Single Filter trigger → Sheet (phone bottom / desktop dialog). Applied chips stay on the results band."
      />
      <Pair desktop={<DocumentsFilterFrame device="desktop" />} phone={<DocumentsFilterFrame device="phone" />} />
    </section>
  );
}
