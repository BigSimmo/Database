"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import { isProfileEmpty, type AllergyClass, type PatientProfile } from "@/lib/medication-patient-alerts";
import {
  EMPTY_PATIENT_PROFILE,
  getPatientProfileSnapshot,
  getServerPatientProfileSnapshot,
  subscribePatientProfile,
  writePatientProfile,
} from "@/lib/patient-profile-storage";

export type PatientProfileContextValue = {
  profile: PatientProfile;
  updateField: <K extends keyof PatientProfile>(key: K, value: PatientProfile[K]) => void;
  toggleAllergy: (allergy: AllergyClass) => void;
  clear: () => void;
  isEmpty: boolean;
};

const PatientProfileContext = createContext<PatientProfileContextValue | null>(null);

export function PatientProfileProvider({ children }: { children: React.ReactNode }) {
  // Read from the sessionStorage-backed external store so the profile is shared
  // across the prescribing workspace and detail pages with no hydration mismatch.
  const profile = useSyncExternalStore(
    subscribePatientProfile,
    getPatientProfileSnapshot,
    getServerPatientProfileSnapshot,
  );

  const updateField = useCallback<PatientProfileContextValue["updateField"]>((key, value) => {
    writePatientProfile({ ...getPatientProfileSnapshot(), [key]: value });
  }, []);

  const toggleAllergy = useCallback((allergy: AllergyClass) => {
    const current = getPatientProfileSnapshot();
    const allergies = current.allergies ?? [];
    const next = allergies.includes(allergy) ? allergies.filter((item) => item !== allergy) : [...allergies, allergy];
    writePatientProfile({ ...current, allergies: next });
  }, []);

  const clear = useCallback(() => {
    writePatientProfile({ ...EMPTY_PATIENT_PROFILE });
  }, []);

  const value = useMemo<PatientProfileContextValue>(
    () => ({ profile, updateField, toggleAllergy, clear, isEmpty: isProfileEmpty(profile) }),
    [profile, updateField, toggleAllergy, clear],
  );

  return <PatientProfileContext.Provider value={value}>{children}</PatientProfileContext.Provider>;
}

export function usePatientProfile(): PatientProfileContextValue {
  const value = useContext(PatientProfileContext);
  if (!value) {
    throw new Error("usePatientProfile must be used within a PatientProfileProvider");
  }
  return value;
}
