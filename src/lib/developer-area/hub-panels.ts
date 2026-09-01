export type HubPanelGroup = "work" | "clinical" | "system" | "reference";

export type HubPanel = {
  id: string;
  name: string;
  summary: string;
  group: HubPanelGroup;
  /** 1 = built now. 2–4 = declared placeholder; flipping the phase and adding an href is the whole change. */
  phase: 1 | 2 | 3 | 4;
  href?: string;
  /** The href is a static file under `public/`, not an app route. Rendered as a
   *  plain anchor rather than a <Link>, and excluded from the route-existence
   *  check — which reads the route manifest and would not find it. */
  external?: boolean;
};

export const HUB_PANELS: readonly HubPanel[] = [
  {
    id: "task-ledger",
    name: "Task ledger",
    summary: "Outstanding work, in recommended order",
    group: "work",
    phase: 1,
    href: "/mockups/development/ledger",
  },
  // The id stays `work-in-flight` on purpose (plan ruling R9): it is Phase 1's
  // extension mechanism, and renaming it would be churn with a test to update
  // and nothing gained. Only the name and summary changed, because the old
  // ones promised live pull-request state (open changes, CI status) that this
  // repository does not have on disk — only its own committed review records.
  {
    id: "work-in-flight",
    name: "Review state",
    summary: "Which branches were reviewed, at which head, with what outcome",
    group: "work",
    phase: 1,
    href: "/mockups/development/review-state",
  },
  // `decision-log` (phase 4) was removed 2026-08-25, along with `errors`,
  // `budgets` and `commands` below, and `database-drift` (phase 3) for the
  // same reason: `.github/workflows/live-drift.yml` already creates and
  // updates a GitHub issue on drift. Each restated a fact the repository
  // already surfaces elsewhere — exactly what Ruling R1 forbids ("render only
  // facts no green gate already guarantees"), and every placeholder card is a
  // promise on screen: a card that never arrives quietly tells a reader work
  // is coming which is not. `decision-log`'s specific case: `docs/decisions/`
  // holds exactly one file, so the gap is that decisions are not being
  // written down, not that they are not being rendered — a page over one
  // document would make the gap look addressed. Do not re-add these five
  // believing they were forgotten.

  {
    id: "clinical-trust",
    name: "Clinical trust cockpit",
    summary: "Quality feedback, source-change impact, and content maturity",
    group: "clinical",
    phase: 1,
    href: "/mockups/development/clinical-trust",
  },
  // Named for its evidence, not for its subject. It reports open ledger items
  // that name one of the repository's own clinical eval cases -- not "every
  // clinical answer problem", which it has no way to know. A panel on a clinical
  // system that implies coverage it does not have is worse than no panel, so the
  // narrower name is deliberate and should not be "improved" into a broader one.
  {
    id: "clinical-answer-failures",
    name: "Answer failures",
    summary: "Open problems recorded against a named clinical question",
    group: "clinical",
    phase: 1,
    href: "/mockups/development/clinical-answer-failures",
  },
  // Kept, unlike the five removed above, and settled: the owner ruled on
  // 2026-08-26 that the hazard register belongs in the developer hub rather
  // than as a separate clinical-safety surface. It was never a removal
  // candidate on the Ruling R1 ground the five removed entries failed on --
  // it restates no fact an existing green gate already guarantees. Do not
  // drop it in a later placeholder sweep; it is unbuilt, not unwanted.
  {
    id: "hazard-register",
    name: "Hazard register",
    summary: "Known clinical risks and their mitigations",
    group: "clinical",
    phase: 4,
  },

  // No `environment` card: the environment strip renders as its own section on
  // the hub, so a card pointing at `#developer-hub-environment` would be a
  // self-link, not a destination. No `database-drift` card either — see the
  // removal comment above; a phase-3 "coming soon" would promise a panel the
  // plan records as never to be built.
  {
    id: "ingestion",
    name: "Ingestion",
    summary: "Stuck, failed, and queued document jobs",
    group: "system",
    phase: 1,
    href: "/mockups/development/ingestion",
  },
  {
    id: "test-health",
    name: "Test health",
    summary: "Unstable and quarantined tests",
    group: "system",
    phase: 1,
    href: "/mockups/development/test-health",
  },

  {
    id: "documentation",
    name: "Documentation",
    summary: "Every document, its area, and whether the index lists it",
    group: "reference",
    phase: 1,
    href: "/mockups/development/documentation",
  },
  {
    id: "routes",
    name: "Routes and modes",
    summary: "Every page and all 15 modes",
    group: "reference",
    phase: 1,
    href: "/mockups/development/routes",
  },
  // A static sheet, not a route: it is the generated brand preview, mirrored
  // from docs/brand/preview.html into public/ so the hub can link to it.
  // `tests/developer-hub-panels.test.ts` holds the two copies byte-identical,
  // so the link can never show a stale mark.
  {
    id: "brand",
    name: "Brand and design",
    summary: "The mark's construction, every size and lockup, clear space and misuse",
    group: "reference",
    phase: 1,
    href: "/brand/preview.html",
    external: true,
  },
  // Three real prototype cards, not one generic self-linking "Prototypes" card.
  // This is also what preserves the Care Plan, Caring Contact, and Ward Flow entries the
  // spec requires to survive the hub rewrite.
  //
  // This module is production space (`src/lib/**`), not `src/app/mockups/**`,
  // so `eslint.config.mjs`'s `no-restricted-imports` boundary forbids importing
  // `CARING_CONTACT_MOCKUP_ROUTES` from `@/components/caring-contacts/mockups/routes`
  // here — that import path matches the `**/*mockup*` pattern the rule fences
  // production code off from. The href below is therefore a pinned literal,
  // not an import. Do not "helpfully" restore the import: the anti-drift
  // guarantee that constant exists for is preserved instead by
  // `tests/developer-hub-panels.test.ts`, which asserts this literal equals
  // `CARING_CONTACT_MOCKUP_ROUTES.today` — if that route is ever renamed, the
  // test goes red rather than this link silently rotting.
  {
    id: "care-plan",
    name: "Care Plan",
    summary:
      "Stage B prototype: Management Plan authoring, ED Presentation continuity, and Personal Safety Plan; later routes remain specimens",
    group: "reference",
    phase: 1,
    href: "/mockups/care-plan",
  },
  {
    id: "caring-contact",
    name: "Caring contact",
    summary: "Coordination prototype: 13 routes and its system states",
    group: "reference",
    phase: 1,
    href: "/mockups/caring-contacts",
  },
  {
    id: "ward-flow",
    name: "Ward flow",
    summary: "Synthetic prototype, not clinical decision support: queue, capacity, transport, movements",
    group: "reference",
    phase: 1,
    href: "/mockups/ward-flow",
  },
];

export function panelsInGroup(group: HubPanelGroup): HubPanel[] {
  return HUB_PANELS.filter((panel) => panel.group === group);
}
