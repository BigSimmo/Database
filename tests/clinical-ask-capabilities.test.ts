import { describe, expect, it, vi } from "vitest";

import { projectClinicalAskAvailableModeIds } from "@/lib/clinical-ask/capabilities";

describe("projectClinicalAskAvailableModeIds", () => {
  it("projects only server-enabled governed modes into the client capability", () => {
    const enabled = vi.fn((mode: string) => mode === "services" || mode === "therapy-compass");
    expect(projectClinicalAskAvailableModeIds(enabled)).toEqual(["services", "therapy-compass"]);
    expect(enabled).toHaveBeenCalledTimes(7);
  });
});
