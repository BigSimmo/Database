import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Therapy PR unblocking contracts", () => {
  it("keeps the Therapy catalogue out of the shared initial favourites graph", () => {
    const source = read("src/components/clinical-dashboard/use-saved-registry-favourites.ts");
    expect(source).not.toContain('from "@/lib/therapies"');
    expect(source).toContain('import("@/lib/therapies")');
  });

  // The Therapy production content gate is gone (see tests/app-modes.test.ts and
  // tests/therapy-review-regressions.test.ts). Its PLAYWRIGHT_OFFLINE_MODE bypass
  // existed only to let offline UI verification reach the gated route, so it must
  // go with it: a bypass left behind an absent gate is how a half-restored gate
  // ends up passing locally and 404ing in production.
  it("retires the offline bypass along with the Therapy production content gate", () => {
    const layoutSource = read("src/app/(search-app)/therapy-compass/layout.tsx");
    const therapiesSource = read("src/lib/therapies.ts");

    expect(layoutSource).not.toContain("PLAYWRIGHT_OFFLINE_MODE");
    expect(layoutSource).not.toContain("offlineReviewBuild");
    expect(layoutSource).not.toContain("notFound()");
    expect(layoutSource).not.toContain("NEXT_PUBLIC_DEMO_MODE");
    expect(therapiesSource).not.toContain("PLAYWRIGHT_OFFLINE_MODE");
    expect(therapiesSource).not.toContain('environment === "production"');
  });

  it("canonicalises hidden shared-home modes instead of retaining impossible URL state", () => {
    const source = read("src/app/(search-app)/page.tsx");
    expect(source).toContain('canonicalParams.set("mode", "answer")');
    expect(source).toContain("redirect(`/?${canonicalParams.toString()}`)");
  });
});
