import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Therapy PR unblocking contracts", () => {
  it("keeps the Therapy catalogue out of the shared initial favourites graph", () => {
    const source = read("src/components/clinical-dashboard/use-saved-registry-favourites.ts");
    expect(source).not.toContain('from "@/lib/therapies"');
    expect(source).toContain('import("@/lib/therapies")');
  });

  it("keeps the production content gate while allowing isolated offline UI verification", () => {
    const layoutSource = read("src/app/(search-app)/therapy-compass/layout.tsx");
    const therapiesSource = read("src/lib/therapies.ts");

    expect(layoutSource).toContain('process.env.PLAYWRIGHT_OFFLINE_MODE === "true"');
    expect(layoutSource).toContain("!offlineReviewBuild");
    expect(layoutSource).toContain("notFound()");
    expect(layoutSource).not.toContain("NEXT_PUBLIC_DEMO_MODE");
    expect(therapiesSource).toContain('process.env.PLAYWRIGHT_OFFLINE_MODE === "true" ? "development"');
    expect(therapiesSource).toContain('environment === "production"');
  });

  it("canonicalises hidden shared-home modes instead of retaining impossible URL state", () => {
    const source = read("src/app/(search-app)/page.tsx");
    expect(source).toContain('canonicalParams.set("mode", "answer")');
    expect(source).toContain("redirect(`/?${canonicalParams.toString()}`)");
  });
});
