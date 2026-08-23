import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { informationPageShellModes } from "@/lib/information-pages";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Therapy global-site convergence", () => {
  it("registers Therapy record routes as shared information pages", () => {
    expect(informationPageShellModes).toContain("therapy-compass");
    expect(read("src/lib/information-pages.ts")).not.toContain("therapy-compass CSS workspace");
  });

  it("keeps submitted Therapy searches connected to shared cross-mode results", () => {
    const searchScreen = read("src/components/therapy-compass/screens/search-screen.tsx");
    expect(searchScreen).toContain("<UniversalSearchAlsoMatches");
    expect(searchScreen).toContain('modeId="therapy-compass"');
  });

  it("supports Therapy records through the account favourite contract", () => {
    expect(read("src/lib/favourites-contract.ts")).toContain(
      'z.enum(["service", "form", "differential", "therapy"])',
    );
    expect(read("src/app/api/account/favourites/route.ts")).toContain(
      'favouriteItemReferenceShape',
    );
    expect(read("supabase/migrations/20260814150000_add_therapy_favourites.sql")).toContain(
      "'differential', 'therapy'",
    );
    expect(read("src/components/therapy-compass/therapy-card.tsx")).toContain("useTherapyFavourite(therapy.slug)");
    expect(read("src/components/therapy-compass/use-therapy-favourite.ts")).toContain(
      'await accountData.setFavourite("therapy", slug, nowSaved)',
    );
  });

  it("uses one shared browser-print output owner for Brief and Patient Sheet", () => {
    const brief = read("src/components/therapy-compass/screens/brief-screen.tsx");
    const sheet = read("src/components/therapy-compass/screens/sheets-screen.tsx");
    const printOutput = read("src/components/ui/print-output.tsx");
    expect(brief).toContain("<PrintOutput");
    expect(sheet).toContain("<PrintOutput");
    expect(printOutput).toContain("window.print()");
    expect(printOutput).not.toMatch(/pdf|persist|storage/i);
  });
});
