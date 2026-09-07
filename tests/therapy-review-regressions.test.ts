import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Therapy review regression contracts", () => {
  it("keeps Therapy controls and overflow content keyboard accessible", () => {
    const brief = source("src/components/therapy-compass/screens/brief-screen.tsx");
    const compare = source("src/components/therapy-compass/screens/compare-screen.tsx");

    expect(brief).toContain('className="w-full min-h-tap');
    expect(compare).toContain('role="region"');
    expect(compare).toContain('aria-label="Therapy comparison table"');
    expect(compare).toContain("tabIndex={0}");
  });

  it("keeps status and main-landmark semantics present through state changes", () => {
    // The live region moved out of the record screen into a shared component
    // when Save moved into the record header: all three record pages announce
    // the same result, and none of them may put the announcement inside the
    // phone collapse portal, which scroll-hides.
    const saveNotice = source("src/components/therapy-compass/record/save-notice.tsx");
    const workspace = source("src/components/therapy-compass/workspace.tsx");

    for (const screen of ["detail", "brief", "sheets"]) {
      expect(source(`src/components/therapy-compass/screens/${screen}-screen.tsx`)).toContain(
        "<TherapySaveNotice notice={notice} />",
      );
    }
    expect(saveNotice).toContain('role="status"');
    expect(saveNotice).toContain('className="sr-only"');
    expect(workspace).toContain('<InformationPageShell testId="therapy-information-loading">');
    expect(workspace.indexOf("if (b.error)")).toBeLessThan(
      workspace.indexOf("if (b.loading && b.therapies.length === 0)"),
    );
  });

  // Replaces the former "keeps Therapy unavailable in production" contract. That
  // gate hid the mode and 404'd all 205 records for real users; the owner's
  // decision is to ship the library with its review state disclosed. These
  // assertions pin the disclosure so the caveat cannot be dropped once the mode
  // is reachable — the reachability half is pinned in tests/app-modes.test.ts.
  it("keeps Therapy reachable with its review state disclosed instead of hidden", () => {
    const layout = source("src/app/(search-app)/therapy-compass/layout.tsx");
    const modes = source("src/lib/app-modes.ts");
    const therapies = source("src/lib/therapies.ts");

    // No environment gate may reappear on the route or the catalogue.
    expect(layout).not.toContain("notFound()");
    expect(modes).not.toMatch(/id: "therapy-compass"[\s\S]*?devOnly: true/);
    expect(therapies).not.toContain('environment === "production"');
    // Review status must survive as a label, not be deleted along with the gate.
    expect(therapies).toContain("export function therapyNeedsReview");
  });

  // The catalogue-wide banner is gone. The owner's decision (2026-09-06) is
  // that a caveat repeated above every search is read past, while the state
  // that governs a decision is the state of the record in front of the reader.
  // So the disclosure is not weakened, it is carried entirely by the per-record
  // badge — which is what the next case pins across all six record surfaces.
  // This one pins the other half: the banner cannot drift back in, and the row
  // it used to sit above still states its own review status.
  it("states Therapy's review status per record, with no catalogue-wide banner above the search band", () => {
    const search = source("src/components/therapy-compass/screens/search-screen.tsx");
    const card = source("src/components/therapy-compass/therapy-card.tsx");

    expect(search).not.toContain("TherapyReviewNotice");
    expect(existsSync(resolve(process.cwd(), "src/components/therapy-compass/therapy-review-notice.tsx"))).toBe(false);
    expect(card).toContain("<StatusBadge status={therapy.reviewStatus} />");
  });

  it("keeps the per-record review badge on every Therapy surface that shows a record", () => {
    for (const path of [
      "src/components/therapy-compass/therapy-card.tsx",
      "src/components/therapy-compass/screens/detail-screen.tsx",
      "src/components/therapy-compass/screens/brief-screen.tsx",
      "src/components/therapy-compass/screens/sheets-screen.tsx",
      "src/components/therapy-compass/screens/compare-screen.tsx",
      "src/components/therapy-compass/screens/pathways-screen.tsx",
    ]) {
      expect(source(path), `${path} must still surface reviewStatus`).toContain("reviewStatus");
    }
    // Discovery outside the mode carries it too, so an unreviewed therapy is
    // flagged in universal search rather than only on its own page.
    expect(source("src/lib/universal-search.ts")).toContain("Needs source review");
  });

  it("adds the favourites check without validating existing rows in the same migration", () => {
    const addConstraint = source("supabase/migrations/20260814150000_add_therapy_favourites.sql");
    const validateConstraint = source(
      "supabase/migrations/20260814151000_validate_therapy_favourites_content_type.sql",
    );

    expect(addConstraint.toLowerCase()).toContain("not valid");
    expect(addConstraint.toLowerCase()).not.toContain("validate constraint");
    expect(validateConstraint.toLowerCase()).toContain("validate constraint user_favourites_content_type_check");
    expect(validateConstraint.toLowerCase()).not.toContain("drop constraint");
    expect(validateConstraint.toLowerCase()).not.toContain("add constraint");
  });

  it("keeps follow-up Therapy review fixes canonical, token-backed, and single-pass", () => {
    const nav = source("src/lib/mode-secondary-navigation.ts");
    const detail = source("src/components/therapy-compass/screens/detail-screen.tsx");
    const select = source("src/components/therapy-compass/data/select.ts");
    const globals = source("src/app/globals.css");
    const universalSearch = source("tests/ui-universal-search.spec.ts");
    const prose = source("src/components/therapy-compass/prose.tsx");

    expect(nav).toContain('href: "/therapy-compass/recommend"');
    expect(nav).toContain('href: "/therapy-compass/pathways"');
    expect(nav).toContain('href: "/therapy-compass/compare"');

    const searchStart = select.indexOf("export function searchTherapies");
    const searchEnd = select.indexOf("// ---- recommend", searchStart);
    expect(searchStart).toBeGreaterThanOrEqual(0);
    expect(searchEnd).toBeGreaterThan(searchStart);
    const searchImplementation = select.slice(searchStart, searchEnd);
    expect(searchImplementation.match(/scoreTherapyCandidate\(/g)).toHaveLength(1);

    // Was: the sticky right rail's offset below the shell header. That rail is
    // gone — its two cards were "At a glance" (now the key-facts strip above the
    // body) and the provenance card (now the collapsed strip at the foot) — so
    // what replaces the assertion is the reason it existed: exactly one sticky
    // header owns this page, and it is the shared one.
    expect(detail).not.toContain("sticky");
    expect(detail).toContain("<TherapyRecordNavHeader");

    const printStart = globals.indexOf("  [data-print-provenance] {", globals.indexOf("@media print"));
    const printEnd = globals.indexOf("\n  }", printStart);
    expect(printStart).toBeGreaterThanOrEqual(0);
    expect(printEnd).toBeGreaterThan(printStart);
    const printProvenance = globals.slice(printStart, printEnd);
    expect(printProvenance).toContain("border-top: 1px solid var(--border);");
    expect(printProvenance).toContain("color: var(--text-muted);");
    expect(printProvenance).not.toContain("#d6dce5");
    expect(printProvenance).not.toContain("#5b6472");
    expect(prose).toContain("max-h-[6.5rem]");
    expect(prose).toContain("print:overflow-visible");
    expect(prose).toContain("print:max-h-none");
    expect(prose).toContain("print:hidden");

    const groupedStart = universalSearch.indexOf('test("selecting a grouped result navigates to the record"');
    const groupedEnd = universalSearch.indexOf('test("Enter with nothing highlighted', groupedStart);
    expect(groupedStart).toBeGreaterThanOrEqual(0);
    expect(groupedEnd).toBeGreaterThan(groupedStart);
    expect(universalSearch.slice(groupedStart, groupedEnd)).toContain("await expect(option).toBeInViewport();");
  });
});
