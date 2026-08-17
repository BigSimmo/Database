import { readFileSync } from "node:fs";
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
    const detail = source("src/components/therapy-compass/screens/detail-screen.tsx");
    const workspace = source("src/components/therapy-compass/workspace.tsx");

    expect(detail).toContain('role="status"');
    expect(detail).toContain(': "sr-only"');
    expect(workspace).toContain('<InformationPageShell testId="therapy-information-loading">');
    expect(workspace.indexOf("if (b.error)")).toBeLessThan(
      workspace.indexOf("if (b.loading && b.therapies.length === 0)"),
    );
  });

  it("keeps Therapy unavailable in production until clinical review is complete", () => {
    const layout = source("src/app/(search-app)/therapy-compass/layout.tsx");
    const modes = source("src/lib/app-modes.ts");
    const therapies = source("src/lib/therapies.ts");

    expect(layout).toContain('isAppModeVisible("therapy-compass", "production")');
    expect(layout).toContain("notFound()");
    expect(modes).toMatch(/id: "therapy-compass"[\s\S]*?devOnly: true/);
    expect(therapies).toContain('environment === "production"');
    expect(therapies).toContain("therapyNeedsReview(record)");
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
    const home = source("src/components/therapy-compass/screens/home-screen.tsx");
    const detail = source("src/components/therapy-compass/screens/detail-screen.tsx");
    const select = source("src/components/therapy-compass/data/select.ts");
    const globals = source("src/app/globals.css");
    const universalSearch = source("tests/ui-universal-search.spec.ts");

    expect(home).toContain('therapyScreenHref("recommend")');
    expect(home).toContain('therapyScreenHref("pathways")');
    expect(home).toContain('therapyScreenHref("compare")');
    expect(home).not.toContain('href: "/therapy-compass/');
    expect(home).not.toContain("`/therapy-compass/search?q=");

    const searchStart = select.indexOf("export function searchTherapies");
    const searchEnd = select.indexOf("// ---- related", searchStart);
    expect(searchStart).toBeGreaterThanOrEqual(0);
    expect(searchEnd).toBeGreaterThan(searchStart);
    const searchImplementation = select.slice(searchStart, searchEnd);
    expect(searchImplementation.match(/scoreTherapyCandidate\(/g)).toHaveLength(1);

    expect(detail).toContain("top-[calc(var(--shell-header-h)+1rem)]");

    const printStart = globals.indexOf("  [data-print-provenance] {", globals.indexOf("@media print"));
    const printEnd = globals.indexOf("\n  }", printStart);
    expect(printStart).toBeGreaterThanOrEqual(0);
    expect(printEnd).toBeGreaterThan(printStart);
    const printProvenance = globals.slice(printStart, printEnd);
    expect(printProvenance).toContain("border-top: 1px solid var(--border);");
    expect(printProvenance).toContain("color: var(--text-muted);");
    expect(printProvenance).not.toContain("#d6dce5");
    expect(printProvenance).not.toContain("#5b6472");

    const groupedStart = universalSearch.indexOf('test("selecting a grouped result navigates to the record"');
    const groupedEnd = universalSearch.indexOf('test("Enter with nothing highlighted', groupedStart);
    expect(groupedStart).toBeGreaterThanOrEqual(0);
    expect(groupedEnd).toBeGreaterThan(groupedStart);
    expect(universalSearch.slice(groupedStart, groupedEnd)).toContain("await expect(option).toBeInViewport();");
  });
});
