import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type { Approval } from "@/lib/first-nations/content-schema";
import { buildBedsideModel } from "@/lib/first-nations/view-model";
import { approvalFor, enabledProfile, testInputs } from "./first-nations-content";

/** Bedside with the service layer on; nothing approved unless approvals are passed. */
export function bedsideFixture(approvals: Approval[] = []) {
  const model = buildBedsideModel(testInputs({ profile: enabledProfile(), approvals }));
  const hospital = model.hospitals[0];
  if (!hospital) throw new Error("fixture profile has no hospital");
  return { model, hospital };
}

/** The owner's OK for the Wants to leave risk line. */
export function riskLineApproval(): Approval {
  const risk = testInputs().content.riskLines[0];
  return approvalFor(risk.id, risk);
}

/** The service's approval of the fixture profile's Acknowledgement. */
export function acknowledgementApproval(): Approval {
  const profile = enabledProfile();
  return approvalFor(`acknowledgement:${profile.id}`, profile.acknowledgement);
}

/** Call once at the top level of every First Nations DOM test file. */
export function resetAfterEach(): void {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}
