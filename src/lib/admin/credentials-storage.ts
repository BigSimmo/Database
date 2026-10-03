"use client";

export type SiteProviderNumber = {
  readonly id: string;
  readonly site: string;
  readonly number: string;
};

export type DoctorCredentials = {
  readonly ahpraNumber: string;
  readonly prescriberNumber: string;
  readonly providerNumbers: readonly SiteProviderNumber[];
  readonly wwccNumber: string;
  readonly radiationLicense: string;
};

export const DEFAULT_CREDENTIALS: DoctorCredentials = {
  ahpraNumber: "",
  prescriberNumber: "",
  providerNumbers: [
    { id: "p1", site: "Royal Perth Hospital", number: "" },
    { id: "p2", site: "Sir Charles Gairdner", number: "" },
  ],
  wwccNumber: "",
  radiationLicense: "",
};

import { DOCTOR_CREDENTIALS_STORAGE_KEY } from "@/lib/account-scoped-browser-state";

export const CREDENTIALS_STORAGE_KEY = DOCTOR_CREDENTIALS_STORAGE_KEY;

export function loadDoctorCredentials(): DoctorCredentials {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_CREDENTIALS;
  }
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) return DEFAULT_CREDENTIALS;
    const parsed = JSON.parse(raw) as Partial<DoctorCredentials>;
    return {
      ahpraNumber: parsed.ahpraNumber ?? "",
      prescriberNumber: parsed.prescriberNumber ?? "",
      providerNumbers: Array.isArray(parsed.providerNumbers)
        ? parsed.providerNumbers
        : DEFAULT_CREDENTIALS.providerNumbers,
      wwccNumber: parsed.wwccNumber ?? "",
      radiationLicense: parsed.radiationLicense ?? "",
    };
  } catch {
    return DEFAULT_CREDENTIALS;
  }
}

export function saveDoctorCredentials(creds: DoctorCredentials): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
    return true;
  } catch {
    return false;
  }
}
