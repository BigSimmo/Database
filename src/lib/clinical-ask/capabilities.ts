import { clinicalAskModeIds, type ClinicalAskModeId } from "@/lib/clinical-ask/contracts";

/** Projects the server-side feature decision into a serializable client capability. */
export function projectClinicalAskAvailableModeIds(
  modeEnabled: (mode: ClinicalAskModeId) => boolean,
): ClinicalAskModeId[] {
  return clinicalAskModeIds.filter(modeEnabled);
}
