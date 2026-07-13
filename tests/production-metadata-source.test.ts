import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production metadata origin", () => {
  it("derives metadata from the request instead of a localhost production fallback", () => {
    const source = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

    expect(source).toContain("export async function generateMetadata");
    expect(source).not.toContain('metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")');
  });
});
