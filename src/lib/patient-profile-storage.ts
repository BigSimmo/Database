// Session-scoped persistence for the patient-considerations profile.
//
// The profile is anonymous physiology (age, renal/hepatic function, QTc,
// pregnancy/lactation, allergy classes) — deliberately NOT PHI. It is kept in
// `sessionStorage` so it survives navigation between the prescribing search and
// a medication detail page within a tab session, but clears when the tab closes
// (appropriate for transient patient context on a shared workstation).
//
// Exposed as an external store (snapshot + subscribe + write) so React can read
// it via `useSyncExternalStore` — the same pattern as `use-theme.ts` /
// `use-sidebar-collapsed.ts` — which shares state across the prescribing
// workspace and detail pages without a hydration mismatch or setState-in-effect.

import type { AllergyClass, HepaticSeverity, PatientProfile, ScrUnit } from "@/lib/medication-patient-alerts";

export const PATIENT_PROFILE_STORAGE_KEY = "clinical-kb-patient-profile";
const PATIENT_PROFILE_CHANGE_EVENT = "clinical-kb-patient-profile-change";

export const EMPTY_PATIENT_PROFILE: PatientProfile = {
  ageYears: null,
  egfr: null,
  crcl: null,
  scr: null,
  scrUnit: "umol/L",
  hepatic: null,
  qtc: null,
  pregnant: false,
  breastfeeding: false,
  allergies: [],
};

const SCR_UNITS: ScrUnit[] = ["umol/L", "mg/dL"];
const HEPATIC_LEVELS: HepaticSeverity[] = ["none", "mild", "moderate", "severe"];
const ALLERGY_CLASSES: AllergyClass[] = [
  "penicillin",
  "sulfa",
  "nsaid",
  "cephalosporin",
  "macrolide",
  "fluoroquinolone",
];

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitize(raw: unknown): PatientProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PATIENT_PROFILE };
  const value = raw as Record<string, unknown>;
  const hepatic = HEPATIC_LEVELS.includes(value.hepatic as HepaticSeverity) ? (value.hepatic as HepaticSeverity) : null;
  const scrUnit = SCR_UNITS.includes(value.scrUnit as ScrUnit) ? (value.scrUnit as ScrUnit) : "umol/L";
  const allergies = Array.isArray(value.allergies)
    ? value.allergies.filter((item): item is AllergyClass => ALLERGY_CLASSES.includes(item as AllergyClass))
    : [];
  return {
    ageYears: numberOrNull(value.ageYears),
    egfr: numberOrNull(value.egfr),
    crcl: numberOrNull(value.crcl),
    scr: numberOrNull(value.scr),
    scrUnit,
    hepatic,
    qtc: numberOrNull(value.qtc),
    pregnant: value.pregnant === true,
    breastfeeding: value.breastfeeding === true,
    allergies,
  };
}

// Cache the parsed snapshot keyed by the raw string so `useSyncExternalStore`
// receives a stable reference until the stored value actually changes.
let cachedRaw: string | null = null;
let cachedProfile: PatientProfile = EMPTY_PATIENT_PROFILE;

export function getPatientProfileSnapshot(): PatientProfile {
  if (typeof window === "undefined") return EMPTY_PATIENT_PROFILE;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PATIENT_PROFILE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedProfile;
  cachedRaw = raw;
  try {
    cachedProfile = raw ? sanitize(JSON.parse(raw)) : { ...EMPTY_PATIENT_PROFILE };
  } catch {
    cachedProfile = { ...EMPTY_PATIENT_PROFILE };
  }
  return cachedProfile;
}

export function getServerPatientProfileSnapshot(): PatientProfile {
  return EMPTY_PATIENT_PROFILE;
}

export function subscribePatientProfile(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(PATIENT_PROFILE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PATIENT_PROFILE_CHANGE_EVENT, onChange);
  };
}

export function writePatientProfile(profile: PatientProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Persistence is a convenience only; ignore quota/availability errors.
  }
  window.dispatchEvent(new Event(PATIENT_PROFILE_CHANGE_EVENT));
}
