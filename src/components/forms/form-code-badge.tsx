import { cn, codeText } from "@/components/ui-primitives";

export type FormCodeBadgeVariant = "sm" | "md" | "hero";

// Form codes are mostly short ("1A", "10D") but some carry a trailing qualifier
// ("6B Attachment"). Splitting on the first whitespace run matches pathwayItems
// (which uses /\s+/) so tabs/newlines keep the same head/qualifier split as spaces.
export function splitFormCode(code: string): { head: string; qualifier: string | null } {
  const trimmed = code.trim();
  const match = /\s+/.exec(trimmed);
  if (!match || match.index === undefined) return { head: trimmed, qualifier: null };
  return {
    head: trimmed.slice(0, match.index),
    qualifier: trimmed.slice(match.index + match[0].length).trim() || null,
  };
}

// Scale the code down as it gets longer so a four-character head ("3A/4B") still
// fits the chip without clipping. The hero variant is responsive to match the
// large detail-page badge.
function headSizeClass(head: string, variant: FormCodeBadgeVariant) {
  const length = head.length;
  if (variant === "sm") {
    if (length <= 2) return "text-lg";
    if (length === 3) return "text-base";
    return "text-sm";
  }
  if (variant === "hero") {
    if (length <= 2) return "text-xl sm:text-4xl";
    if (length === 3) return "text-lg sm:text-3xl";
    return "text-base sm:text-2xl";
  }
  if (length <= 2) return "text-2xl";
  if (length === 3) return "text-xl";
  return "text-base";
}

const containerByVariant: Record<FormCodeBadgeVariant, string> = {
  sm: "h-12 w-12 gap-0 px-0.5",
  md: "h-14 w-16 gap-0.5 px-0.5",
  hero: "h-14 w-14 gap-0 px-1 sm:h-24 sm:w-24 sm:gap-1",
};

const qualifierSizeByVariant: Record<FormCodeBadgeVariant, string> = {
  sm: "text-4xs",
  md: "text-4xs",
  hero: "text-3xs sm:text-2xs",
};

/**
 * Renders a form code as a self-contained chip. The code is split into a
 * prominent head ("6B") and an optional qualifier sub-label ("Attachment") so
 * long codes never overflow. The full code is exposed once to assistive tech
 * while the visual fragments are hidden from the accessibility tree.
 */
export function FormCodeBadge({
  code,
  variant = "md",
  className,
}: {
  code: string;
  variant?: FormCodeBadgeVariant;
  className?: string;
}) {
  const { head, qualifier } = splitFormCode(code);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-[color:var(--clinical-accent-border)] bg-gradient-to-b from-[color:var(--clinical-accent-soft)] to-[color-mix(in_srgb,var(--clinical-accent-soft)_55%,var(--surface))] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]",
        containerByVariant[variant],
        className,
      )}
    >
      {/* Expose the whole code as one string for assistive tech and text queries;
          the split visual fragments below are decorative and hidden from the a11y tree. */}
      <span className="sr-only">{qualifier ? `${head} ${qualifier}` : head}</span>
      <span aria-hidden className={cn("font-extrabold leading-none", headSizeClass(head, variant), codeText)}>
        {head}
      </span>
      {qualifier ? (
        <span
          aria-hidden
          title={qualifier}
          className={cn(
            "w-full truncate text-center font-bold uppercase leading-none tracking-tight opacity-75",
            qualifierSizeByVariant[variant],
          )}
        >
          {qualifier}
        </span>
      ) : null}
    </div>
  );
}
