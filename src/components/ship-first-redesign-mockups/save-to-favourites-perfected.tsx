"use client";

import { useState } from "react";
import { BookmarkPlus, Check, FileText, Heart, MessageSquareText, Quote } from "lucide-react";

import { cn } from "@/components/ui-primitives";

import { AppShell, DeviceFrame, Pair, SectionIntro, focusRing } from "./shared";

const SETS = ["Ward round", "Prescribing safety", "Clozapine clinic", "+ New set"] as const;

function SaveSheet({
  phone,
  open,
  onClose,
  saved,
  onSave,
}: {
  phone?: boolean;
  open: boolean;
  onClose: () => void;
  saved: boolean;
  onSave: (setName: string) => void;
}) {
  const [setName, setSetName] = useState<string>("Ward round");
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 grid bg-[color:color-mix(in_srgb,var(--text-heading)_28%,transparent)]",
        phone ? "items-end" : "place-items-center p-6",
      )}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add to favourites"
        className={cn(
          "w-full border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-elevated)]",
          phone ? "rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" : "max-w-md rounded-2xl p-5",
        )}
      >
        {phone ? (
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color:var(--border-strong)]" aria-hidden />
        ) : null}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              Save to Favourites
            </p>
            <h4 className="mt-1 text-base font-extrabold text-[color:var(--text-heading)]">Add citation to a set</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn("text-2xs font-bold text-[color:var(--text-muted)]", focusRing)}
          >
            Close
          </button>
        </div>

        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
          <div className="flex items-start gap-2">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">
                Clozapine protocol — WA Adult Mental Health
              </p>
              <p className="mt-0.5 text-2xs text-[color:var(--text-muted)]">
                p. 14 · Table 3 · ANC monitoring thresholds
              </p>
              <p className="mt-2 text-2xs leading-5 text-[color:var(--text)]">
                “Interrupt therapy if ANC &lt; 1.0 × 10⁹/L; urgent medical review for fever or myocarditis symptoms.”
              </p>
            </div>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            Save into set
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {SETS.map((name) => {
              const selected = setName === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSetName(name)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3 text-2xs font-bold",
                    focusRing,
                    selected
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)]",
                  )}
                  aria-pressed={selected}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => onSave(setName)}
          className={cn(
            "mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold",
            focusRing,
            saved
              ? "bg-[color:var(--success-soft)] text-[color:var(--success)]"
              : "bg-[color:var(--clinical-accent)] text-[color:var(--surface)]",
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Saved to {setName}
            </>
          ) : (
            <>
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Add to favourites
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function AnswerWithSaveFrame({ device }: { device: "desktop" | "phone" }) {
  const phone = device === "phone";
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <DeviceFrame device={device} label={phone ? "Phone save sheet" : "Desktop save dialog"}>
      <AppShell device={device} active="answer" modeLabel="Answer" ModeIcon={MessageSquareText}>
        <div className={cn("relative min-h-full", phone ? "px-3 pb-4 pt-3" : "px-6 py-5")}>
          <p className="text-2xs font-bold text-[color:var(--text-muted)]">Answer · clozapine ANC thresholds</p>
          <article className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <p className="text-sm leading-6 text-[color:var(--text)]">
              Interrupt therapy if ANC falls below 1.0 × 10⁹/L, and arrange urgent review for fever or suspected
              myocarditis.
            </p>
            <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[color:var(--text-heading)]">
                    [1] Clozapine protocol — WA Adult Mental Health
                  </p>
                  <p className="text-2xs text-[color:var(--text-muted)]">p. 14 · cited evidence</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setOpen(true);
                  }}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-3 text-2xs font-bold text-[color:var(--clinical-accent)]",
                    focusRing,
                  )}
                >
                  <Heart className="h-3.5 w-3.5" aria-hidden />
                  Add to favourites
                </button>
                <span className="inline-flex h-10 items-center rounded-lg border border-[color:var(--border)] px-3 text-2xs font-bold text-[color:var(--text-muted)]">
                  Open source
                </span>
              </div>
            </div>
          </article>

          <p className="mt-3 text-2xs leading-4 text-[color:var(--text-soft)]">
            Also available from clinical notes / evidence panels — same save sheet, same set chips.
          </p>

          <SaveSheet
            phone={phone}
            open={open}
            saved={saved}
            onClose={() => setOpen(false)}
            onSave={() => setSaved(true)}
          />
        </div>
      </AppShell>
    </DeviceFrame>
  );
}

export function SaveToFavouritesPerfectedSection() {
  return (
    <section id="save-to-favourites" aria-labelledby="save-to-favourites-title" className="scroll-mt-8">
      <SectionIntro
        issue="Evidence → Favourites loop"
        title="Save to Favourites from answers"
        body="Turn on Add to favourites from evidence and clinical notes. Saves citation + page + short snippet into a set — closing the loop from find something useful to keep it."
        pick="One save sheet: citation preview, set chips, confirm. Phone bottom sheet / desktop dialog."
      />
      <Pair desktop={<AnswerWithSaveFrame device="desktop" />} phone={<AnswerWithSaveFrame device="phone" />} />
    </section>
  );
}
