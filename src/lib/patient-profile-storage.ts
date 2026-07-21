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

import { SCR_UMOL_PER_MGDL } from "@/lib/medication-patient-alerts";
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

// Physiological input-VALIDITY bounds (inclusive). These are deliberately NOT the
// clinical firing thresholds (RENAL_IMPAIRMENT_EGFR / QTC_PROLONGED_MS / the age
// cut-offs live in medication-patient-alerts.ts and must never be relaxed here):
// they only reject values that are physically impossible or a clear data-entry
// error. An out-of-range entry is rejected to `null` — never clamped — so the
// alert engine treats it as a missing input and surfaces a contraindication row
// as "unassessed" rather than reading garbage as a false all-clear. Ranges
// verified 2026-07-21 against clinical extremes: neonate age 0, anuric eGFR/CrCl
// 0, short-QT syndrome ~250 ms, augmented renal clearance CrCl ~350, severe-AKI
// creatinine ~2200 µmol/L.
export const PATIENT_PROFILE_NUMERIC_BOUNDS = {
  ageYears: { min: 0, max: 130 },
  egfr: { min: 0, max: 250 },
  crcl: { min: 0, max: 400 },
  qtc: { min: 240, max: 800 },
} as const;

// Serum creatinine bounds are canonical in µmol/L; a mg/dL entry is normalised by
// ×SCR_UMOL_PER_MGDL before the range check (the same conversion the alert engine
// applies), so a single bound covers both units with no unit/bound mismatch.
export const PATIENT_PROFILE_SCR_UMOL_BOUNDS = { min: 15, max: 3000 } as const;

function boundedNumberOrNull(value: unknown, bounds: { min: number; max: number }): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= bounds.min && value <= bounds.max
    ? value
    : null;
}

// Returns the entered value (in its own unit) when its µmol/L-normalised
// magnitude is physiologically valid, else null. The engine re-normalises the
// raw value itself, so we only use the normalised figure for the range check.
function scrOrNull(value: unknown, scrUnit: ScrUnit): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const umol = scrUnit === "mg/dL" ? value * SCR_UMOL_PER_MGDL : value;
  return umol >= PATIENT_PROFILE_SCR_UMOL_BOUNDS.min && umol <= PATIENT_PROFILE_SCR_UMOL_BOUNDS.max ? value : null;
}

export function sanitizeProfile(raw: unknown): PatientProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PATIENT_PROFILE };
  const value = raw as Record<string, unknown>;
  const hepatic = HEPATIC_LEVELS.includes(value.hepatic as HepaticSeverity) ? (value.hepatic as HepaticSeverity) : null;
  const scrUnit = SCR_UNITS.includes(value.scrUnit as ScrUnit) ? (value.scrUnit as ScrUnit) : "umol/L";
  const allergies = Array.isArray(value.allergies)
    ? value.allergies.filter((item): item is AllergyClass => ALLERGY_CLASSES.includes(item as AllergyClass))
    : [];
  return {
    ageYears: boundedNumberOrNull(value.ageYears, PATIENT_PROFILE_NUMERIC_BOUNDS.ageYears),
    egfr: boundedNumberOrNull(value.egfr, PATIENT_PROFILE_NUMERIC_BOUNDS.egfr),
    crcl: boundedNumberOrNull(value.crcl, PATIENT_PROFILE_NUMERIC_BOUNDS.crcl),
    scr: scrOrNull(value.scr, scrUnit),
    scrUnit,
    hepatic,
    qtc: boundedNumberOrNull(value.qtc, PATIENT_PROFILE_NUMERIC_BOUNDS.qtc),
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
    cachedProfile = raw ? sanitizeProfile(JSON.parse(raw)) : { ...EMPTY_PATIENT_PROFILE };
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
