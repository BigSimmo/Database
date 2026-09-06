/**
 * Derived counts, in a module that imports NO JSON.
 *
 * `repo-awareness-snapshot.ts` imports the committed snapshot at module scope,
 * which is right for a Server Component reader and wrong for
 * `check-repo-awareness-snapshot.ts`: that gate exists to compare the committed
 * file against a freshly generated one, so pulling the reader in would load the
 * very file under suspicion. Keeping the derivations here lets both callers
 * share one implementation without the gate importing its own subject.
 *
 * `reviewStateCounts()` stays in the reader beside its only callers; it was
 * already there before v3 and moving it would be churn without a second
 * consumer to justify the seam.
 */
import type { DocumentationSection, RoutesSection, TestHealthSection } from "./repo-awareness-types";

/**
 * The three sections that stopped storing their totals in v3. Each computes
 * from the very list its page renders, so a count cannot disagree with what is
 * shown beside it, and no aggregate line remains for two branches to fight
 * over. See the rule on `ReviewStateSection` in `repo-awareness-types.ts`.
 */
export function routesCounts(routes: RoutesSection): {
  modes: number;
  pages: number;
  product_pages: number;
  mockup_pages: number;
  redirects: number;
  api: number;
} {
  let productPages = 0;
  for (const page of routes.pages) if (page.area === "product") productPages += 1;
  return {
    modes: routes.modes.length,
    pages: routes.pages.length,
    product_pages: productPages,
    // Derived by subtraction rather than a second pass, so the two can never
    // sum to something other than `pages` — the disagreement a stored pair
    // could express and this one cannot.
    mockup_pages: routes.pages.length - productPages,
    redirects: routes.redirects.length,
    api: routes.api.length,
  };
}

export function documentationCounts(documentation: DocumentationSection): {
  documents: number;
  catalogued: number;
  uncatalogued: number;
  sections: number;
} {
  let catalogued = 0;
  for (const document of documentation.documents) if (document.catalogued) catalogued += 1;
  return {
    documents: documentation.documents.length,
    catalogued,
    uncatalogued: documentation.documents.length - catalogued,
    sections: documentation.sections.length,
  };
}

export function testHealthCounts(testHealth: TestHealthSection): { quarantined: number } {
  return { quarantined: testHealth.quarantined.length };
}
