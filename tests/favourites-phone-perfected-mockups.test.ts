import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { favouriteContentTypeSchema, favouriteSetNames } from "@/lib/favourites-contract";

import {
  favouriteRows,
  kindIdentity,
  landingLibrarySectionOrder,
  setLabels,
} from "@/components/favourites-phone-perfected-mockups/fixtures";

/**
 * The phone Favourites mockup is design scratch and deliberately untested for
 * layout — it will churn. Two things about it are not layout.
 *
 * The first is the decision this study exists to correct: the six favourites
 * mockups already on main draw saved medications, documents, quotes and
 * searches, none of which `favouriteContentTypeSchema` permits, so they design
 * against a data layer that does not exist. If this fixture ever drifts back
 * to fiction the study loses the only thing that distinguishes it.
 *
 * The second is the set vocabulary, which has a database CHECK behind it
 * (`20260823090000_user_favourite_sets.sql`). A mockup that invents a seventh
 * set name is proposing a migration without saying so.
 */

const root = join(__dirname, "..", "src", "components", "favourites-phone-perfected-mockups");

function source(file: string) {
  return readFileSync(join(root, file), "utf8");
}

describe("favourites phone-perfected mockup", () => {
  it("draws only the four content types the favourites contract can persist", () => {
    const allowed = favouriteContentTypeSchema.options;

    expect(Object.keys(kindIdentity).sort()).toEqual([...allowed].sort());
    for (const row of favouriteRows) {
      expect(allowed).toContain(row.kind);
    }
  });

  it("does not reintroduce the favourite kinds the data layer cannot save", () => {
    const files = [
      "fixtures.ts",
      "favourites-rows.tsx",
      "favourites-phone-shell.tsx",
      "favourites-phone-perfected-page.tsx",
    ];
    // Each of these appears as a drawn favourite kind in the existing
    // favourites mockups and has no `contentType`, so it can never be saved.
    const fictional = ["Saved search", "Quote"];

    for (const file of files) {
      const text = source(file);
      for (const kind of fictional) {
        // The page's own explanatory copy names them to say they are excluded,
        // so only the fixture and the rendering components are held to this.
        if (file === "favourites-phone-perfected-page.tsx") continue;
        expect(text, `${file} must not draw a "${kind}" favourite`).not.toContain(kind);
      }
    }
  });

  it("uses the controlled set vocabulary and nothing else", () => {
    // `user_favourites.set_id` is nullable, so "Unfiled" is a real bucket
    // rather than a seventh set name. Every FILED row must use a controlled
    // name; only the null bucket is allowed to sit outside the vocabulary.
    const filed = favouriteRows.filter((row) => row.setId !== "unfiled");
    expect(filed.length).toBeGreaterThan(0);
    for (const label of new Set(filed.map((row) => setLabels[row.setId]))) {
      expect([...favouriteSetNames]).toContain(label);
    }

    // Every controlled name is reachable from the rail, including the ones the
    // fixture leaves empty — an unused set that vanishes cannot be filed into.
    for (const name of favouriteSetNames) {
      expect(Object.values(setLabels)).toContain(name);
    }
  });

  it("keeps clinical-state colour off decoration", () => {
    // `--danger` / `--warning` / `--success` are the clinical-state layer.
    // The only sanctioned uses here are the destructive action and the
    // partial-load failure notice, both in favourites-rows.tsx.
    for (const file of ["fixtures.ts", "favourites-phone-shell.tsx", "favourites-phone-perfected-page.tsx"]) {
      const text = source(file);
      expect(text, `${file} must not paint with clinical-state colour`).not.toMatch(
        /var\(--(?:danger|warning|success)(?:-[a-z]+)?\)/,
      );
    }
  });

  it("keeps every phone tap target at the production 48px knob", () => {
    // Mockups are gate-exempt and may use min-h-11, but this one is authored
    // to be promotable, so interactive rows and sheets never drop below 48px.
    for (const file of ["favourites-rows.tsx", "favourites-phone-perfected-page.tsx"]) {
      const text = source(file);
      expect(text, `${file} must not use the 44px mockup target`).not.toMatch(/\bmin-h-11\b/);
      expect(text, `${file} must not use a 36px tap target`).not.toMatch(/\bmin-h-9\b/);
    }

    const shell = source("favourites-phone-shell.tsx");
    const setRailBlock = shell.split("export function SetRail")[1]?.split("export function PhoneComposer")[0] ?? "";
    expect(setRailBlock, "set chips must use the 48px production knob").toMatch(/\bmin-h-12\b/);
    expect(setRailBlock, "set chips must not use a 36px tap target").not.toMatch(/\bmin-h-9\b/);
  });

  it("keeps pinned rows ahead of grouped sets on the landing view", () => {
    const resumeRow = [...favouriteRows].sort((a, b) => a.recency - b.recency)[0];
    const landingRows = favouriteRows.filter((row) => row.id !== resumeRow.id);
    const order = landingLibrarySectionOrder(landingRows);
    const firstPinnedIndex = order.findIndex((id) => favouriteRows.find((row) => row.id === id)?.pinned);
    const firstClinicalReviewIndex = order.findIndex(
      (id) =>
        favouriteRows.find((row) => row.id === id)?.setId === "clinical-review" &&
        !favouriteRows.find((row) => row.id === id)?.pinned,
    );

    expect(firstPinnedIndex).toBeGreaterThanOrEqual(0);
    expect(firstClinicalReviewIndex).toBeGreaterThan(firstPinnedIndex);
  });

  it("hides the landing cards once View all switches sort away from set", () => {
    // RecentCard's "View all" control (onViewAll) sets sort to "recent". If
    // showCards stayed true after that, the list would open with the same
    // rows ContinueCard/RecentCard already show above it — duplicate recent
    // items right after View all. showCards must require sort === "set" so
    // the cards disappear once the view is no longer the set-grouped landing.
    const pageSource = source("favourites-phone-perfected-page.tsx");
    const showCardsLine = pageSource.split("\n").find((line) => line.trimStart().startsWith("const showCards ="));

    expect(showCardsLine, "showCards assignment not found").toBeDefined();
    expect(showCardsLine, 'showCards must require sort === "set" or View all duplicates RecentCard rows').toMatch(
      /sort === "set"/,
    );
    expect(pageSource).toContain('onViewAll={() => setSort("recent")}');
  });

  it("routes clear-all to its own confirmation sheet, not set management", () => {
    const pageSource = source("favourites-phone-perfected-page.tsx");
    expect(pageSource).toContain('onRequestClearAll={() => setSheet("clear-all")}');
    expect(pageSource).toContain('sheet === "clear-all"');
    expect(pageSource).not.toMatch(/Remove all favourites.*onOpenSets/s);

    const rowsSource = source("favourites-rows.tsx");
    expect(rowsSource).toContain("onRequestClearAll");
    expect(rowsSource).toContain("ClearAllSheetBody");
  });
});
