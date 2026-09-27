"use client";
import { useState, useSyncExternalStore } from "react";
import { FIRST_NATIONS_HOSPITAL_STORAGE_KEY } from "@/lib/account-scoped-browser-state";
import type { HospitalView } from "@/lib/first-nations/view-model";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(FIRST_NATIONS_HOSPITAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The chosen hospital id only; account-scoped, so it clears at sign-out. It
 * describes the doctor's workplace, never a patient. The page works before a
 * choice (the first hospital), and the server render always uses that default.
 */
export function useChosenHospital(hospitals: readonly HospitalView[]): [HospitalView | null, (id: string) => void] {
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const [chosen, setChosen] = useState<string | null>(null);
  const id = chosen ?? stored;
  const choose = (next: string) => {
    setChosen(next);
    try {
      window.localStorage.setItem(FIRST_NATIONS_HOSPITAL_STORAGE_KEY, next);
    } catch {
      // Storage refused: the choice lasts for this page only.
    }
  };
  return [hospitals.find((h) => h.id === id) ?? hospitals[0] ?? null, choose];
}
