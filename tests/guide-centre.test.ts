import { describe, expect, it } from "vitest";

import {
  guideTopicIds,
  guideTopics,
  guideTourStepIds,
  guideTourSteps,
} from "@/components/clinical-dashboard/guide-content";
import {
  completeGuideStep,
  emptyGuideProgress,
  firstIncompleteGuideStep,
  parseGuideProgress,
} from "@/components/clinical-dashboard/guide-progress";

describe("PsychSift Guide Centre content", () => {
  it("keeps topic and tour identifiers unique and in the intended order", () => {
    expect(new Set(guideTopicIds).size).toBe(guideTopicIds.length);
    expect(guideTopics.map((topic) => topic.id)).toEqual(guideTopicIds);
    expect(new Set(guideTourStepIds).size).toBe(guideTourStepIds.length);
    expect(guideTourSteps.map((step) => step.id)).toEqual(guideTourStepIds);
    expect(guideTourSteps.map((step) => step.label)).toEqual([
      "Start here",
      "Ask with precision",
      "Control your scope",
      "Verify the evidence",
      "Use answers safely",
    ]);
  });

  it("keeps every reference topic concise enough to scan", () => {
    for (const topic of guideTopics) {
      const words = [
        topic.summary,
        ...topic.sections.flatMap((section) => [
          section.heading,
          ...(section.paragraphs ?? []),
          ...(section.bullets ?? []),
        ]),
      ]
        .join(" ")
        .trim()
        .split(/\s+/).length;
      expect(words, topic.id).toBeGreaterThanOrEqual(120);
      expect(words, topic.id).toBeLessThanOrEqual(220);
    }
  });

  it("lists only the keyboard controls that are currently implemented", () => {
    const shortcuts = guideTopics
      .find((topic) => topic.id === "keyboard-shortcuts")
      ?.sections.flatMap((section) => section.bullets ?? []);
    expect(shortcuts).toEqual([
      "/ — focus the main clinical search input when you are not already editing text.",
      "Esc — close the active dialog or other dismissible surface that supports it.",
    ]);
  });
});

describe("PsychSift Guide Centre progress", () => {
  it("falls back safely for corrupt, unknown-version, and unknown-step records", () => {
    expect(parseGuideProgress("not json")).toEqual(emptyGuideProgress);
    expect(parseGuideProgress(JSON.stringify({ version: 2, completedStepIds: [] }))).toEqual(emptyGuideProgress);
    expect(
      parseGuideProgress(
        JSON.stringify({ version: 1, completedStepIds: ["ask", "unknown", "ask"], lastStepId: "unknown" }),
      ),
    ).toEqual({ version: 1, completedStepIds: ["ask"], lastStepId: null });
  });

  it("stores ordered completion and chooses the first incomplete step", () => {
    const afterScope = completeGuideStep(emptyGuideProgress, "scope");
    const afterStart = completeGuideStep(afterScope, "start");
    expect(afterStart.completedStepIds).toEqual(["start", "scope"]);
    expect(firstIncompleteGuideStep(afterStart)).toBe("ask");
  });
});
