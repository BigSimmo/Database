import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { InformationPageShell } from "@/components/information-page-shell";
import { EmptyState } from "@/components/primitive-recipes/feedback";

export const metadata: Metadata = {
  title: "Search On Call | PsychSift",
  description: "Search across your on-call contacts, playbook, referrals, orientation, teaching and logistics.",
};

const ON_CALL_SEARCH_SECTION_LINKS = [
  { href: "/on-call/contacts", label: "Contacts" },
  { href: "/on-call/playbook", label: "Playbook" },
  { href: "/on-call/referrals", label: "Referrals" },
  { href: "/on-call/orientation", label: "Orientation" },
  { href: "/on-call/education", label: "Teaching" },
  { href: "/on-call/logistics", label: "Logistics" },
] as const;

/**
 * A real, minimal landing for `/on-call/search` — deliberately not a redirect.
 *
 * `consolidatedModeHomePaths` maps `/on-call` onto the shared home, and a
 * submitted deep link forwards here through `appModeHomeHref`; without a real
 * page at this path that forward loops
 * (tests/consolidated-mode-home-redirect.test.ts). A later task fills this in
 * with the local search composer and the shared results band
 * (`resultsSurface: "results-band"` — see `tests/search-results-band-adoption.test.ts`,
 * knowingly red until then). Until it lands, this route offers a real heading
 * and a real next step — opening a section directly — rather than a stub with
 * nothing to do.
 */
export default function OnCallSearchRoute() {
  return (
    <InformationPageShell testId="on-call-search-main">
      <h1 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
        Search On Call
      </h1>
      <EmptyState
        icon={Search}
        title="Search is not built yet"
        body="Local search across every section arrives in a later change. For now, open a section directly."
        actions={
          <nav aria-label="On Call sections" className="grid gap-2 sm:grid-cols-2">
            {ON_CALL_SEARCH_SECTION_LINKS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] hover:border-[color:var(--border-strong)]"
              >
                {section.label}
              </Link>
            ))}
          </nav>
        }
        testId="on-call-search-empty"
      />
    </InformationPageShell>
  );
}
