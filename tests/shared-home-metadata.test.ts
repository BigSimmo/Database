import { describe, expect, it } from "vitest";

import { generateMetadata } from "@/app/(search-app)/page";
import { appModeIds } from "@/lib/app-modes";
import { sharedHomeDocumentTitle, sharedHomePresentation } from "@/lib/ui-copy";

describe("shared home metadata", () => {
  it.each([
    [undefined, "Clinical Answers | Clinical KB"],
    ["dictionary", "Clinical Dictionary | Clinical KB"],
    ["therapy-compass", "Therapy | Clinical KB"],
  ])("describes the selected %s mode", async (mode, title) => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve(mode ? { mode } : {}),
    });

    expect(metadata.title).toBe(title);
  });

  it("falls back to Answer for an unavailable mode", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ mode: "not-a-mode" }),
    });

    expect(metadata.title).toBe("Clinical Answers | Clinical KB");
  });

  it("covers every app mode from the canonical presentation map", async () => {
    for (const mode of appModeIds) {
      const metadata = await generateMetadata({ searchParams: Promise.resolve({ mode }) });

      expect(metadata.title).toBe(sharedHomeDocumentTitle(mode));
      expect(metadata.title).toBe(`${sharedHomePresentation[mode].title} | Clinical KB`);
    }
  });

  it.each([
    [[], "Clinical Answers | Clinical KB"],
    [["dictionary", "therapy-compass"], "Clinical Dictionary | Clinical KB"],
    [["not-a-mode", "dictionary"], "Clinical Answers | Clinical KB"],
  ])("handles adversarial repeated mode parameters %#", async (mode, title) => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ mode }) });

    expect(metadata.title).toBe(title);
  });
});
