import { Clock, Gauge, MapPin, Users, type LucideIcon } from "lucide-react";

import { cn, toneInfo, toneSuccess, toneWarning } from "@/components/ui-primitives";

import type { Therapy } from "../data/types";

type FactTone = "success" | "info" | "warning" | "neutral";

const TONE_CARD: Record<FactTone, string> = {
  success: toneSuccess,
  info: toneInfo,
  warning: toneWarning,
  neutral: "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
};

const TONE_CHIP: Record<FactTone, string> = {
  success: "border-[color:var(--success-border)] bg-[color:var(--surface)] text-[color:var(--success)]",
  info: "border-[color:var(--info-border)] bg-[color:var(--surface)] text-[color:var(--info)]",
  warning: "border-[color:var(--warning-border)] bg-[color:var(--surface)] text-[color:var(--warning)]",
  neutral: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

/**
 * How appraised the evidence is, as a tone.
 *
 * This is the one field on the record with real variation across the catalogue
 * (High 22, Moderate 101, Low 10, unappraised 72 of 205), which is why it earns
 * the first tile. Everything unappraised stays neutral rather than warning: "we
 * have not appraised this" is a statement about the record, not a safety
 * signal, and dressing it in amber would put a caution colour on two records in
 * five.
 */
function evidenceTone(level: string | null): FactTone {
  const value = (level ?? "").toLowerCase();
  if (value.startsWith("high")) return "success";
  if (value.startsWith("moderate")) return "info";
  if (value.startsWith("low")) return "warning";
  return "neutral";
}

function FactTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: FactTone;
}) {
  return (
    <div className={cn("rounded-lg border p-3 shadow-[var(--shadow-inset)]", TONE_CARD[tone])}>
      <div className="flex items-center gap-2">
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border", TONE_CHIP[tone])}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="text-2xs font-semibold uppercase leading-tight tracking-eyebrow">{label}</p>
      </div>
      {/* Two lines is the contract for this row, not a nicety: a tile that runs
          to a paragraph stretches all four (they share a row height) and turns
          a glance strip back into a section. The long-form field it summarises
          is always rendered in full in the body below. */}
      <p className="mt-1.5 line-clamp-2 text-sm-minus font-semibold leading-5 text-[color:var(--text-heading)]">
        {value}
      </p>
    </div>
  );
}

/**
 * The four facts worth reading before anything else, at the top of the record.
 *
 * This replaces two things that used to sit far apart: the old quick-tile row,
 * whose "Evidence / source" tile named a source it did not show, and the "At a
 * glance" rail card, which repeated content already in the body and sat below
 * the fold on a phone. The evidence *level* belongs here, at the top; the
 * *source* belongs at the bottom, and now that is the only place it appears.
 */
export function TherapyKeyFacts({ therapy }: { therapy: Therapy }) {
  const evidence = therapy.evidenceLevel?.trim() || "Not recorded";
  // `sessionLength` ("Micro skill", "Single session", "Multi-session") rather
  // than `timeRequired`, which is three sentences about session counts and
  // trial protocols — a body field, and now rendered as one.
  const format = therapy.sessionLength?.trim() || "Format not recorded";
  const setting = therapy.setting?.trim() || "Setting not recorded";
  const suits = therapy.patientPopulation?.trim() || "Audience not recorded";

  return (
    <section aria-label="Key facts" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <FactTile icon={Gauge} label="Evidence" value={evidence} tone={evidenceTone(therapy.evidenceLevel)} />
      <FactTile icon={Clock} label="Format" value={format} tone="neutral" />
      <FactTile icon={MapPin} label="Setting" value={setting} tone="neutral" />
      <FactTile icon={Users} label="Suits" value={suits} tone="neutral" />
    </section>
  );
}
