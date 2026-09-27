"use client";

import { z } from "zod";

import { createBrowserStore } from "@/lib/client-store-factory";
import {
  onCallDeviceStateChangedEvent,
  onCallDeviceStoreChangedEvent,
  onCallMyTeamStorageKey,
} from "@/lib/on-call/device-state-keys";
import { parseHandbookTitle, type OnCallTeam } from "@/lib/on-call/handbook-title";

/**
 * The reader's own team, for Now's "Your team" block and Who's on's order.
 *
 * Any team an editor writes as a title prefix is a team (review F10), so this
 * stores whatever name the reader chose, in its canonical form ("Intensive
 * care" is stored as "ICU"). It is a word, never a number, and the key lives in
 * `device-state-keys.ts`, so the sign-out wipe already clears it.
 */

const teamSchema = z.string().trim().min(1).max(40);

/**
 * The canonical name, through the one title grammar: "Intensive care" and
 * "ICU" are the same team. A name the grammar reads as a category ("Ward",
 * "Emergency") is not a team, and nor is text that is not a short name.
 */
export function canonicalOnCallTeam(raw: unknown): OnCallTeam | null {
  const parsed = teamSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parseHandbookTitle(`${parsed.data}: team`).team;
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(onCallMyTeamStorageKey);
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): OnCallTeam | null {
  if (!raw) return null;
  try {
    return canonicalOnCallTeam(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readOnCallMyTeam(): OnCallTeam | null {
  return parseStored(readRaw());
}

/** Stores the canonical name, or removes it for "No team". */
export function saveOnCallMyTeam(team: OnCallTeam | null): void {
  if (typeof window === "undefined") return;
  const canonical = team === null ? null : canonicalOnCallTeam(team);
  try {
    if (canonical === null) window.localStorage.removeItem(onCallMyTeamStorageKey);
    else window.localStorage.setItem(onCallMyTeamStorageKey, JSON.stringify(canonical));
    window.dispatchEvent(new Event(onCallDeviceStoreChangedEvent));
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(onCallDeviceStoreChangedEvent, onChange);
  window.addEventListener(onCallDeviceStateChangedEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(onCallDeviceStoreChangedEvent, onChange);
    window.removeEventListener(onCallDeviceStateChangedEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const useMyTeamSnapshot = createBrowserStore(subscribe, () => readRaw() ?? "", "");

export function useOnCallMyTeam(): OnCallTeam | null {
  return parseStored(useMyTeamSnapshot() || null);
}
