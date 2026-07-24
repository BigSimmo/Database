import type { Metadata } from "next";

import { ClinicalBadge } from "@/components/clinical-dashboard/clinical-badge";
import { NavigationBackButton } from "@/components/navigation-back-button";
import {
  cn,
  eyebrowText,
  raisedCard,
  searchPageCanvas,
  searchPageContainer,
  searchPageShell,
} from "@/components/ui-primitives";
import { CONTENT_DOMAIN_META, CONTENT_DOMAIN_ORDER, flagsForDomain } from "@/lib/semantic-flags";
import { SEMANTIC_TONE_META, SEMANTIC_TONES } from "@/lib/semantic-tone";

export const metadata: Metadata = {
  title: "Colour coding reference — Clinical KB",
  description:
    "The site-wide badge colour system: what each tone means and which signals are flagged in each content area.",
};

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

export default function ColourCodingReferencePage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        searchPageCanvas,
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
      )}
    >
      <div className={cn(searchPageShell)}>
        <div className={cn(searchPageContainer, "space-y-6")}>
          <header className="space-y-3">
            <NavigationBackButton fallbackHref="/" />
            <div className="space-y-2">
              <p className={eyebrowText}>Reference</p>
              <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
                Colour coding reference
              </h1>
              <p className="max-w-[68ch] text-sm leading-6 text-[color:var(--text-muted)]">
                Badges flag important content so clinical screens are faster to scan. The system uses six tones only —
                meaning drives the colour, never the other way round. Danger and warning also carry an icon so they stay
                distinguishable without colour. Governance lives in{" "}
                <span className="font-mono text-xs">docs/clinical-badge-system-guide.md</span>; this page is generated
                from <span className="font-mono text-xs">src/lib/semantic-flags.ts</span>.
              </p>
            </div>
          </header>

          <section className={cn(raisedCard, "p-4 sm:p-5")}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
              Tone key
            </h2>
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

          {CONTENT_DOMAIN_ORDER.map((domain) => {
            const flags = flagsForDomain(domain);
            if (!flags.length) return null;
            const meta = CONTENT_DOMAIN_META[domain];
            return (
              <section key={domain} className={cn(raisedCard, "p-4 sm:p-5")}>
                <h2 className="text-base font-semibold text-[color:var(--text-heading)]">{meta.label}</h2>
                <p className="mt-1 max-w-[68ch] text-xs leading-5 text-[color:var(--text-muted)]">{meta.description}</p>
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
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
