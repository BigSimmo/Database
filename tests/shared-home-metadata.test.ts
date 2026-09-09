import { describe, expect, it } from "vitest";

import { generateMetadata } from "@/app/(search-app)/page";
import { appModeIds } from "@/lib/app-modes";
import { sharedHomeDocumentTitle, sharedHomePresentation } from "@/lib/ui-copy";

describe("shared home metadata", () => {
  it.each([
    [undefined, "Clinical Answers | PsychSift"],
    ["dictionary", "Clinical Dictionary | PsychSift"],
    ["therapy-compass", "Therapy | PsychSift"],
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

    expect(metadata.title).toBe("Clinical Answers | PsychSift");
  });

  it("covers every app mode from the canonical presentation map", async () => {
    for (const mode of appModeIds) {
      const metadata = await generateMetadata({ searchParams: Promise.resolve({ mode }) });

      expect(metadata.title).toBe(sharedHomeDocumentTitle(mode));
      expect(metadata.title).toBe(`${sharedHomePresentation[mode].title} | PsychSift`);
    }
  });

  it.each([
    [[], "Clinical Answers | PsychSift"],
    [["dictionary", "therapy-compass"], "Clinical Dictionary | PsychSift"],
    [["not-a-mode", "dictionary"], "Clinical Answers | PsychSift"],
  ])("handles adversarial repeated mode parameters %#", async (mode, title) => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ mode }) });

    expect(metadata.title).toBe(title);
  });
});
