"use client";

import { useSyncExternalStore } from "react";

import { onCallDeviceStateChangedEvent, onCallDeviceStoreChangedEvent } from "@/lib/on-call/device-state-keys";
import type { HandbookDial } from "@/lib/on-call/number-resolver";

/**
 * Two small stores Call needs on the device, beside the kit's own:
 *
 *  - **"Didn't connect"** (plan 3.3, idea 3): which rows this reader could not
 *    reach, as an entry id and a time. No digits, no name, no outcome, and it
 *    lapses 12 hours after the tap, like the kit's "You called" marks.
 *  - **"I'm on a hospital phone"** (owner card 19:06Z): a yes or no about THIS
 *    phone, off by default. While it is on, a short extension gets a call disc.
 *
 * Neither holds a phone number. Both are wiped at sign-out: the kit's
 * `clearOnCallDeviceState()` fires `onCallDeviceStateChangedEvent`, and the
 * listener below removes both keys when it hears it. (The kit's key list
 * should also name them, so a wipe with no Call code loaded clears them too;
 * that is a one-line kit change, reported rather than made from this lane.)
 */

export const onCallDidntConnectStorageKey = "clinical-kb-on-call-didnt-connect";
export const onCallHospitalPhoneStorageKey = "clinical-kb-on-call-hospital-phone";
export const ON_CALL_LANE_B_DEVICE_KEYS = [onCallDidntConnectStorageKey, onCallHospitalPhoneStorageKey] as const;

const DIDNT_CONNECT_HOURS = 12;
const EXPIRY_MS = DIDNT_CONNECT_HOURS * 60 * 60 * 1000;
const MARK_LIMIT = 40;

type DidntConnectMark = { readonly entryId: string; readonly at: string };

function wipeLaneStores(): void {
  for (const key of ON_CALL_LANE_B_DEVICE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Blocked storage: nothing further can be removed for this key.
    }
  }
}

let wipeListening = false;
function listenForWipe(): void {
  if (wipeListening || typeof window === "undefined") return;
  window.addEventListener(onCallDeviceStateChangedEvent, wipeLaneStores);
  wipeListening = true;
}
listenForWipe();

function notify(): void {
  try {
    window.dispatchEvent(new Event(onCallDeviceStoreChangedEvent));
  } catch {
    // No window events to send; nothing is listening either.
  }
}

function isMark(value: unknown): value is DidntConnectMark {
  if (!value || typeof value !== "object") return false;
  const { entryId, at } = value as Record<string, unknown>;
  return (
    typeof entryId === "string" &&
    entryId.length > 0 &&
    typeof at === "string" &&
    Number.isFinite(Date.parse(at)) &&
    Object.keys(value).length === 2
  );
}

/** Whole-list rejection, as the kit's stores do: a foreign payload is no marks. */
function readMarks(now: Date): DidntConnectMark[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(onCallDidntConnectStorageKey) ?? "[]");
    if (!Array.isArray(parsed) || !parsed.every(isMark)) return [];
    const cutoff = now.getTime() - EXPIRY_MS;
    return parsed.filter((mark) => {
      const at = Date.parse(mark.at);
      return at > cutoff && at <= now.getTime() + 60_000;
    });
  } catch {
    return [];
  }
}

function writeMarks(marks: readonly DidntConnectMark[]): void {
  try {
    if (marks.length === 0) window.localStorage.removeItem(onCallDidntConnectStorageKey);
    else window.localStorage.setItem(onCallDidntConnectStorageKey, JSON.stringify(marks.slice(0, MARK_LIMIT)));
  } catch {
    // Blocked storage: the mark lasts only as long as the sheet that set it.
  }
  notify();
}

/** When this row was marked "Didn't connect" within 12 hours, or null. */
export function onCallDidntConnectAt(entryId: string, now: Date = new Date()): string | null {
  return readMarks(now).find((mark) => mark.entryId === entryId)?.at ?? null;
}

export function markOnCallDidntConnect(entryId: string, now: Date = new Date()): void {
  if (typeof window === "undefined" || !entryId) return;
  writeMarks([{ entryId, at: now.toISOString() }, ...readMarks(now).filter((mark) => mark.entryId !== entryId)]);
}

export function clearOnCallDidntConnect(entryId: string, now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  writeMarks(readMarks(now).filter((mark) => mark.entryId !== entryId));
}

export function readOnCallHospitalPhone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(onCallHospitalPhoneStorageKey) === "1";
  } catch {
    return false;
  }
}

export function setOnCallHospitalPhone(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(onCallHospitalPhoneStorageKey, "1");
    else window.localStorage.removeItem(onCallHospitalPhoneStorageKey);
  } catch {
    // Blocked storage: the switch stays off, which is the conservative default.
  }
  notify();
}

/**
 * The dial a row shows. While this phone is a hospital phone, a short
 * extension (under 8 digits; 000, 112 and 106 already dial) rings its own
 * digits. Otherwise the number is unchanged, and a short one stays desk-only
 * with no call disc (review F1).
 */
export function withHospitalPhone(dial: HandbookDial, hospitalPhone: boolean): HandbookDial {
  if (!hospitalPhone || dial.kind !== "extension") return dial;
  return { kind: "direct", display: dial.display, tel: `tel:${dial.extension}`, copy: dial.copy, route: "any-phone" };
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(onCallDeviceStoreChangedEvent, onChange);
  window.addEventListener(onCallDeviceStateChangedEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(onCallDeviceStoreChangedEvent, onChange);
    window.removeEventListener(onCallDeviceStateChangedEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The row's "Didn't connect at 02:14" time, or null. A string snapshot, so unrelated writes skip the render. */
export function useOnCallDidntConnectAt(entryId: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => onCallDidntConnectAt(entryId),
    () => null,
  );
}

/** Whether this reader said this phone is a hospital phone. Off until they say so. */
export function useOnCallHospitalPhone(): boolean {
  return useSyncExternalStore(subscribe, readOnCallHospitalPhone, () => false);
}
