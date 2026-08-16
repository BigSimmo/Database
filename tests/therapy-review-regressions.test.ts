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
    expect(workspace.indexOf("if (b.error)"))
      .toBeLessThan(workspace.indexOf("if (b.loading && b.therapies.length === 0)"));
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
    expect(validateConstraint.toLowerCase()).toContain(
      "validate constraint user_favourites_content_type_check",
    );
    expect(validateConstraint.toLowerCase()).not.toContain("drop constraint");
    expect(validateConstraint.toLowerCase()).not.toContain("add constraint");
  });
});
