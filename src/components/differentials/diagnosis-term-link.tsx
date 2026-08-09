import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/components/ui-primitives";

/** Client-safe href builder — keep snapshot/catalog imports out of this module. */
function differentialDiagnosisHref(slug: string): string {
  return `/differentials/diagnoses/${slug}`;
}

export type DiagnosisTermTone = "danger" | "warning" | "accent" | "neutral";

const chipToneClass: Record<DiagnosisTermTone, { linked: string; unlinked: string }> = {
  danger: {
    linked:
      "border-[color:var(--danger-border)] bg-[color:var(--surface)] text-[color:var(--danger)] hover:border-[color:var(--danger)] hover:underline",
    unlinked: "border-[color:var(--danger-border)] bg-[color:var(--surface)] text-[color:var(--danger)]",
  },
  warning: {
    linked:
      "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)] hover:border-[color:var(--warning)] hover:underline",
    unlinked: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  },
  accent: {
    linked:
      "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)] hover:underline",
    unlinked: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  },
  neutral: {
    linked:
      "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)] hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] hover:underline",
    unlinked: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  },
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type DiagnosisTermChipProps = {
  label: string;
  slug?: string | null;
  tone?: DiagnosisTermTone;
  className?: string;
};

/**
 * Discrete diagnosis/risk chip. Links when a catalog slug is provided; otherwise
 * renders a non-interactive chip so unlinked clinical risks stay readable.
 */
export function DiagnosisTermChip({ label, slug = null, tone = "neutral", className }: DiagnosisTermChipProps) {
  const tones = chipToneClass[tone];
  if (slug) {
    return (
      <Link
        href={differentialDiagnosisHref(slug)}
        aria-label={`Open diagnosis: ${label}`}
        className={cn(
          "inline-flex min-h-tap items-center gap-1 rounded-md border px-2.5 text-xs font-bold",
          focusRing,
          tones.linked,
          className,
        )}
      >
        {label}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-h-tap items-center rounded-md border px-2.5 text-xs font-semibold",
        tones.unlinked,
        className,
      )}
    >
      {label}
    </span>
  );
}

type DiagnosisTermInlineProps = {
  label: string;
  slug?: string | null;
  className?: string;
};

/** Dense inline diagnosis link for comparison-table prose. */
export function DiagnosisTermInline({ label, slug = null, className }: DiagnosisTermInlineProps) {
  if (!slug) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      href={differentialDiagnosisHref(slug)}
      aria-label={`Open diagnosis: ${label}`}
      className={cn(
        "font-semibold text-[color:var(--clinical-accent)] underline-offset-2 hover:underline",
        focusRing,
        className,
      )}
    >
      {label}
    </Link>
  );
}

type DiagnosisTermInlineListProps = {
  segments: ReadonlyArray<{ text: string; slug: string | null }>;
  className?: string;
};

/** Render comma-separated inline segments, linking only resolved diagnoses. */
export function DiagnosisTermInlineList({ segments, className }: DiagnosisTermInlineListProps) {
  if (segments.length === 0) return null;
  return (
    <span className={className}>
      {segments.map((segment, index) => (
        <span key={`${segment.text}-${index}`}>
          {index > 0 ? <span className="text-[color:var(--text-muted)]">, </span> : null}
          <DiagnosisTermInline label={segment.text} slug={segment.slug} />
        </span>
      ))}
    </span>
  );
}
