import { describe, expect, it } from "vitest";
import { resolveModeHomeCanvasClass } from "@/components/clinical-dashboard/mode-home-canvas";

describe("resolveModeHomeCanvasClass", () => {
  it("centres compact shared homes without a nested mobile viewport floor", () => {
    const className = resolveModeHomeCanvasClass({
      activeModeResultKind: "answer",
      centeredModeHome: true,
      compactMobileModeHome: true,
      hasAnswer: false,
      showSharedHome: true,
    });

    expect(className).toContain("max-sm:flex max-sm:grow max-sm:shrink-0 max-sm:flex-col");
    expect(className).toContain("max-sm:items-center max-sm:justify-center");
    expect(className).not.toContain("max-sm:min-h-[calc(100dvh-12.5rem)]");
  });

  it("keeps compact registry homes top-aligned", () => {
    const className = resolveModeHomeCanvasClass({
      activeModeResultKind: "services",
      centeredModeHome: false,
      compactMobileModeHome: true,
      hasAnswer: false,
      showSharedHome: false,
    });

    expect(className).not.toContain("max-sm:items-center");
    expect(className).not.toContain("max-sm:justify-center");
    expect(className).toContain("max-w-6xl");
  });
});
