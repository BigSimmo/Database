import { describe, expect, it, vi } from "vitest";

import { buildDifferentialStreamModel } from "@/lib/differential-stream";

const presentationFixtures = vi.hoisted(() => {
  let safetySnapshotReads = 0;

  function workflow(id: string, status: "emergent" | "urgent" | "routine") {
    return {
      id,
      title: `${id} title`,
      subtitle: `${id} subtitle`,
      status,
      candidates: [{ slug: `${id}-candidate` }],
      get safetySnapshot() {
        safetySnapshotReads += 1;
        return { tags: [`${id} safety cue`] };
      },
    };
  }

  const workflows = [
    workflow("emergent-pathway", "emergent"),
    workflow("urgent-pathway", "urgent"),
    workflow("routine-pathway", "routine"),
  ];

  return {
    workflows,
    resetSafetySnapshotReads: () => {
      safetySnapshotReads = 0;
    },
    getSafetySnapshotReads: () => safetySnapshotReads,
  };
});

vi.mock("@/lib/differentials", () => ({
  differentialPresentations: () => presentationFixtures.workflows,
  differentialRecords: [],
  differentialScenarioPresets: () => [],
  rankDifferentialRecords: () => [],
  rankPresentationWorkflows: () => [],
  getPresentationWorkflowSelectionForDiagnosisIds: () => null,
}));

describe("presentation stream browse construction", () => {
  it("builds each presentation item once when there is no query", () => {
    presentationFixtures.resetSafetySnapshotReads();

    const model = buildDifferentialStreamModel("presentations", "");

    expect(model.items).toHaveLength(presentationFixtures.workflows.length);
    expect(presentationFixtures.getSafetySnapshotReads()).toBe(presentationFixtures.workflows.length);
  });
});
