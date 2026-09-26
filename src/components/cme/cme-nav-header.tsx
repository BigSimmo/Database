"use client";

import { CalendarDays, ClipboardList, GraduationCap, ListChecks, Repeat, ShieldCheck } from "lucide-react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";

/**
 * CME's in-page navigation, shared by every page in the mode rather than one
 * per route.
 *
 * `docs/search-chrome-behaviour.md` ("Default in-page navigation template")
 * pins a page's `PageSection[]` to a colocated `"use client"` nav-header
 * sibling. CME departs from the usual one-file-per-route shape of that rule
 * only in how many routes share the one file — the table itself still lives
 * here, and nowhere else, exactly as the rule requires.
 *
 * The declaration below is a SUPERSET: Programme's four sections and Setup's
 * two sit in one array, and `useResolvedPageSections` (which
 * `useInPageSectionNav` composes) narrows it, per render, to whichever
 * anchors actually exist in the DOM — the same "declare unconditionally,
 * resolve to what's rendered" pattern the docs describe for a phone/desktop
 * breakpoint pair. A page that renders none of a given id simply never offers
 * it; there is nothing route-specific to branch on here.
 */
export const cmeSections: readonly PageSection[] = [
  { id: "cme-national-baseline", label: "Baseline", icon: ClipboardList },
  { id: "cme-college-extras", label: "College", icon: GraduationCap },
  { id: "cme-provenance", label: "Confirmed", icon: ShieldCheck },
  { id: "cme-year-shape", label: "Year", icon: CalendarDays },
  { id: "cme-setup-steps", label: "Requirements", icon: ListChecks },
  { id: "cme-setup-routines", label: "Routines", icon: Repeat },
];

/**
 * No `back`. `InPageNavHeader`'s own docs say to omit it "for a page that is a
 * destination rather than a child" — Programme and Setup are exactly that:
 * reached from CME's own mode navigation, not from a hierarchy this header
 * would have to invent an arrow for. On Call's section pages make the same
 * choice for the same reason.
 *
 * It is also load-bearing here in a way it is not for On Call: `back` renders
 * `ContextualBackLink`, which calls `next/navigation`'s `useRouter()`
 * unconditionally. That throws ("invariant expected app router to be
 * mounted") outside an `AppRouterContext` provider, which is exactly how
 * `tests/cme-programme.dom.test.tsx` renders this page — a bare
 * `render(<CmeProgrammePage .../>)` with no router mock. `usePathname()`,
 * which this header calls unconditionally for its own sheet state, returns
 * `null` outside a router instead of throwing, so it carries no such risk.
 */
export function CmeNavHeader({ title }: { title: string }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(cmeSections);

  return (
    <InPageNavHeader
      title={title}
      testIdPrefix="cme"
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      rail={{
        label: "CPD",
        // Four short labels at most on any one page ("Baseline", "College",
        // "Confirmed", "Year" — Setup's three are shorter still). Matched to
        // Therapy record's own four-slot calibration
        // (`therapy-record-nav-header.tsx`), which measured clean rendering
        // for labels of this length down to 430px; `compact-four` clips them.
        density: "balanced-four",
        // Reaches `data-mode-identity="cme"` on the rail, which remaps
        // `--clinical-accent` to CME's indigo inside it only (`globals.css`).
        modeIdentity: "cme",
      }}
    />
  );
}
