import { describe, expect, it } from "vitest";

import { abandonedReindexGenerationAlertExitCode } from "@/lib/reindex-pipeline";

// Pure decision only — no Supabase client, no network. The scheduled reaper probe
// depends on this exit code to turn a silent dry run into a visible alert.
describe("abandonedReindexGenerationAlertExitCode", () => {
  it("exits non-zero when a read-only probe finds abandoned staged rows", () => {
    expect(
      abandonedReindexGenerationAlertExitCode({
        counts: { document_chunks: 12, document_images: 3 },
        alertOnAbandoned: true,
        apply: false,
      }),
    ).toBe(2);
  });

  it("exits zero when a read-only probe finds nothing", () => {
    expect(abandonedReindexGenerationAlertExitCode({ counts: {}, alertOnAbandoned: true, apply: false })).toBe(0);
    expect(
      abandonedReindexGenerationAlertExitCode({
        counts: { document_chunks: 0, document_sections: 0 },
        alertOnAbandoned: true,
        apply: false,
      }),
    ).toBe(0);
  });

  it("stays silent without the flag, so the existing dry run is unchanged", () => {
    expect(
      abandonedReindexGenerationAlertExitCode({
        counts: { document_chunks: 12 },
        alertOnAbandoned: false,
        apply: false,
      }),
    ).toBe(0);
  });

  it("never overrides the apply path's own exit code", () => {
    expect(
      abandonedReindexGenerationAlertExitCode({
        counts: { document_chunks: 12 },
        alertOnAbandoned: true,
        apply: true,
      }),
    ).toBe(0);
  });
});
