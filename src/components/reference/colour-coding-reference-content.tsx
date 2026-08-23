import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ClinicalBadge } from "@/components/clinical-dashboard/clinical-badge";
import { cn, eyebrowText, raisedCard } from "@/components/ui-primitives";
import { CONTENT_DOMAIN_META, CONTENT_DOMAIN_ORDER, flagsForDomain } from "@/lib/semantic-flags";
import { SEMANTIC_TONE_META, SEMANTIC_TONES } from "@/lib/semantic-tone";

// A representative label per tone so the key shows the badge as it renders in
// production (including the default danger/warning icons).
const TONE_SAMPLE_LABEL: Record<(typeof SEMANTIC_TONES)[number], string> = {
  danger: "Contraindicated",
  warning: "Review due",
  clinical: "Monitor renal",
  success: "Source-backed",
  neutral: "333 mg tablet",
  info: "Processing",
};

const QUICK_TONE_MAPPING = [
  { meaning: "Passive fact or reference metadata", tone: "neutral" as const },
  { meaning: "Clinical instruction or action", tone: "clinical" as const },
  { meaning: "Current, reviewed, source-backed, or available", tone: "success" as const },
  { meaning: "Pause, check, adjust, review, or partial support", tone: "warning" as const },
  { meaning: "Avoid, contraindicated, failed, outdated, or unsafe", tone: "danger" as const },
  { meaning: "Processing, pending, or system state", tone: "info" as const },
] as const;

export type ColourCodingReferenceContentProps = {
  variant: "page" | "guide";
  onOpenFullReference?: () => void;
};

function DomainCatalogue({ variant }: { variant: "page" | "guide" }) {
  return (
    <>
      {CONTENT_DOMAIN_ORDER.map((domain, index) => {
        const flags = flagsForDomain(domain);
        if (!flags.length) return null;
        const meta = CONTENT_DOMAIN_META[domain];
        const body = (
          <ul className="mt-3 divide-y divide-[color:var(--border)]">
            {flags.map((flag) => (
              <li key={flag.id} className="flex items-start gap-3 py-2.5">
                <div className="w-40 shrink-0 pt-0.5">
                  <ClinicalBadge tone={flag.tone} label={flag.label} iconKey={flag.iconKey} />
                </div>
                <p className="min-w-0 text-xs leading-5 text-[color:var(--text-muted)]">{flag.meaning}</p>
              </li>
            ))}
          </ul>
        );

        if (variant === "guide") {
          return (
            <details key={domain} className={cn(raisedCard, "group p-4 sm:p-5")} open={index === 0}>
              <summary className="cursor-pointer list-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] [&::-webkit-details-marker]:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{meta.label}</h2>
                    <p className="mt-1 max-w-[68ch] text-xs leading-5 text-[color:var(--text-muted)]">
                      {meta.description}
                    </p>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-0.5 size-icon-md shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-90"
                  />
                </div>
              </summary>
              {body}
            </details>
          );
        }

        return (
          <section key={domain} className={cn(raisedCard, "p-4 sm:p-5")}>
            <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{meta.label}</h2>
            <p className="mt-1 max-w-[68ch] text-xs leading-5 text-[color:var(--text-muted)]">{meta.description}</p>
            {body}
          </section>
        );
      })}
    </>
  );
}

export function ColourCodingReferenceContent({ variant, onOpenFullReference }: ColourCodingReferenceContentProps) {
  const isGuide = variant === "guide";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        {!isGuide ? <p className={eyebrowText}>Reference</p> : null}
        <h1
          data-guide-page-heading={isGuide ? true : undefined}
          tabIndex={isGuide ? -1 : undefined}
          className={cn(
            "font-semibold tracking-tight text-[color:var(--text-heading)] outline-none",
            isGuide ? "text-2xl sm:text-3xl" : "text-2xl sm:text-3xl",
          )}
        >
          Colour coding & badges
        </h1>
        <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">
          Badges flag important content so clinical screens are faster to scan. The system uses six tones only — meaning
          drives the colour, never the other way round. Danger and warning also carry an icon so they stay
          distinguishable without colour.
        </p>
        {isGuide ? (
          <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">
            Green means current or source-backed, not clinically safe. Clinical blue means an action to carry out, not
            verified or trustworthy. Badges highlight information — they do not replace the readable text around them.
          </p>
        ) : null}
      </header>

      <section className={cn(raisedCard, "p-4 sm:p-5")}>
        <h2 className="text-sm font-semibold uppercase tracking-label text-[color:var(--text-muted)]">Tone key</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {SEMANTIC_TONES.map((tone) => (
            <div
              key={tone}
              className="flex items-start gap-3 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
            >
              <div className="shrink-0 pt-0.5">
                <ClinicalBadge tone={tone} label={TONE_SAMPLE_LABEL[tone]} />
              </div>
              <div className="min-w-0">
                <dt className="text-sm font-semibold text-[color:var(--text-heading)]">
                  {SEMANTIC_TONE_META[tone].label}
                </dt>
                <dd className="mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]">
                  {SEMANTIC_TONE_META[tone].meaning}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className={cn(raisedCard, "p-4 sm:p-5")}>
        <h2 className="text-sm font-semibold uppercase tracking-label text-[color:var(--text-muted)]">Quick mapping</h2>
        <p className="mt-2 max-w-[68ch] text-xs leading-5 text-[color:var(--text-muted)]">
          When several badges appear together, read danger first, then warning, then clinical, success, neutral, and
          info.
        </p>
        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {QUICK_TONE_MAPPING.map((row) => (
            <li key={row.tone} className="flex items-center gap-3 py-2.5">
              <div className="w-36 shrink-0 sm:w-40">
                <ClinicalBadge tone={row.tone} label={SEMANTIC_TONE_META[row.tone].label} />
              </div>
              <p className="min-w-0 text-xs leading-5 text-[color:var(--text-muted)]">{row.meaning}</p>
            </li>
          ))}
        </ul>
      </section>

      <DomainCatalogue variant={variant} />

      {isGuide ? (
        <div className="flex justify-center pt-1">
          {onOpenFullReference ? (
            <button
              type="button"
              onClick={onOpenFullReference}
              className="inline-flex min-h-tap items-center gap-1 rounded-md text-sm font-semibold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              Open full reference
              <ChevronRight aria-hidden="true" className="size-icon-sm" />
            </button>
          ) : (
            <Link
              href="/reference/colour-coding"
              className="inline-flex min-h-tap items-center gap-1 rounded-md text-sm font-semibold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              Open full reference
              <ChevronRight aria-hidden="true" className="size-icon-sm" />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
