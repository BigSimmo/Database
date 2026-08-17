import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("design-system target adoption evidence", () => {
  it("keeps local empty, loading, and chip APIs delegated to DS primitives", () => {
    const therapy = source("src/components/therapy-compass/ui.tsx");
    const modeHome = source("src/components/mode-home-template.tsx");
    const differentials = source("src/components/clinical-dashboard/differentials-home.tsx");
    const favourites = source("src/components/clinical-dashboard/favourites-command-library-page.tsx");

    expect(therapy).toContain('return <LoadingPanel label={label} layout="centered" />');
    expect(therapy).toContain("<SharedEmptyState");
    expect(modeHome).toContain("<EmptyState");
    expect(differentials).toContain("<DesignChip");
    expect(favourites).toContain('<Chip size="compact" appearance={appearance}>');
  });

  it("keeps settings, sidebar, and answer sheets on the OverlayRoot portal default", () => {
    const sheet = source("src/components/ui/sheet.tsx");
    const owners = [
      source("src/components/clinical-dashboard/settings-dialog.tsx"),
      source("src/components/clinical-dashboard/ClinicalSidebar.tsx"),
      source("src/components/clinical-dashboard/answer-result-surface.tsx"),
    ];

    expect(sheet).toContain("portal = true");
    for (const owner of owners) expect(owner).not.toContain("portal={false}");
  });

  it("keeps responsive CrossModeLinks declarations distinct and the generic rail phone-only", () => {
    const links = source("src/components/clinical-dashboard/cross-mode-links.tsx");

    expect(links).toContain('data-testid="cross-mode-links-rail"');
    expect(links).toContain('data-testid="cross-mode-links-card-rail"');
    expect(links).toMatch(/cross-mode-links-rail[^"\n]*md:hidden/);
    expect(links).toMatch(/cross-mode-links-rail hidden[^"\n]*md:flex/);
    expect(links).not.toContain('data-testid="cross-mode-links-rail-desktop"');
  });

  it("keeps catalogue toolbars delegated to the shared CatalogueToolbar component pattern", () => {
    const builder = source("src/components/formulation/formulation-builder-page.tsx");
    expect(builder).toContain("<CatalogueToolbar");
  });
});
