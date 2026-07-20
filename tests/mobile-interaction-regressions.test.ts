import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { differentialDiagnosesCards } from "@/lib/differentials";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("mobile interaction regressions", () => {
  it("keys diagnosis cards by their unique stable identity", () => {
    const ids = differentialDiagnosesCards.map((card) => card.id);
    const titles = differentialDiagnosesCards.map((card) => card.title);
    const streamSource = source("src/components/differentials/differential-stream-page.tsx");

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBeLessThan(titles.length);
    expect(streamSource).toContain("key={card.id}");
    expect(streamSource).not.toContain("key={card.title}");
  });

  it("leaves phone vertical scrolling to the shared shell", () => {
    const presentationSource = source("src/components/differentials/differential-presentation-workflow-page.tsx");
    const favouritesSource = source("src/components/clinical-dashboard/favourites-command-library-page.tsx");
    const differentialsHomeSource = source("src/components/clinical-dashboard/differentials-home.tsx");

    expect(presentationSource).toMatch(
      /data-testid="differential-presentation-page"\s+className="[^"]*min-h-0[^"]*overflow-x-clip[^"]*sm:min-h-\[calc\(100dvh-4rem\)\]/,
    );
    expect(favouritesSource).toMatch(
      /data-testid="favourites-hub"\s+className="[^"]*min-h-0[^"]*overflow-x-clip[^"]*sm:min-h-\[calc\(100dvh-4rem\)\]/,
    );
    expect(favouritesSource).toContain('"grid min-h-0 min-w-0 overflow-x-clip sm:min-h-[calc(100dvh-4rem)]"');
    // overflow-x-hidden would force overflow-y:auto and nest a scrollport under #main-content.
    expect(differentialsHomeSource).toMatch(
      /data-testid="differentials-search-results"[\s\S]*?className="[^"]*overflow-x-clip[^"]*"/,
    );
    expect(differentialsHomeSource).not.toMatch(
      /data-testid="differentials-search-results"[\s\S]*?className="[^"]*overflow-x-hidden[^"]*"/,
    );
  });

  it("keeps the privacy link at the semantic tap size", () => {
    const privacySource = source("src/components/privacy-input-notice.tsx");

    expect(privacySource).toContain("inline-flex min-h-tap items-center");
    expect(privacySource).toContain("sm:min-h-0");
  });
});
