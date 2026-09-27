import { describe, expect, it } from "vitest";

import { generateMetadata } from "@/app/(search-app)/page";

// Audit F26: every `/?mode=<id>` variant renders the same home page, so they must all
// name `/` as canonical instead of competing as duplicate pages.
describe("home page canonical metadata", () => {
  it.each([undefined, "answer", "services", "not-a-mode"])("names / as canonical for mode=%s", async (mode) => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve(mode ? { mode } : {}) });
    expect(metadata.alternates?.canonical).toBe("/");
  });
});
