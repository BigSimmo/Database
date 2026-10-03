// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  ON_CALL_CALL_LOG_FULL_MESSAGE,
  ON_CALL_CALL_LOG_IDENTIFIER_MESSAGE,
  ON_CALL_CALL_LOG_LIMIT,
  ON_CALL_CALL_LOG_NAME_MESSAGE,
  addOnCallCallLogEntry,
  clearOnCallCallLog,
  onCallCallLogProblem,
  onCallHandoverItems,
  onCallHandoverText,
  readOnCallCallLog,
  removeOnCallCallLogEntry,
  onCallCallLogStorageKey,
  setOnCallCallLogDone,
  visibleOnCallCallLog,
  type OnCallCallLogDraft,
} from "@/lib/on-call/call-log";
import {
  PATIENT_LABEL_EXPIRY_STORAGE_KEY,
  PATIENT_LABEL_KEY_PREFIX,
  clearExpiredPatientLabels,
  clearPatientLabels,
} from "@/lib/patient-label-storage";

const draft = (overrides: Partial<OnCallCallLogDraft> = {}): OnCallCallLogDraft => ({
  label: "4B-12",
  caller: "ED registrar",
  note: "Agitated overnight, reviewed",
  followUp: "Bloods in the morning",
  ...overrides,
});

// 02:00 and 03:30 Perth time on 3 Oct 2026.
const twoAm = new Date("2026-10-02T18:00:00Z");
const halfThree = new Date("2026-10-02T19:30:00Z");

afterEach(() => {
  window.localStorage.clear();
});

describe("onCallCallLogProblem", () => {
  it("accepts a bed number or initials with ordinary notes", () => {
    expect(onCallCallLogProblem(draft())).toBeNull();
    expect(onCallCallLogProblem(draft({ label: "JS" }))).toBeNull();
  });

  it("refuses an empty note", () => {
    expect(onCallCallLogProblem({ label: " ", caller: "", note: "", followUp: "" })).not.toBeNull();
  });

  it.each([
    ["a record number", { note: "URN: 1234567" }],
    ["a date of birth", { note: "DOB: 01/02/1980" }],
    ["a phone number", { followUp: "ring family on 0412 345 678" }],
    ["an email", { caller: "someone@example.com" }],
  ])("refuses %s anywhere in the note", (_name, overrides) => {
    expect(onCallCallLogProblem(draft(overrides))).toBe(ON_CALL_CALL_LOG_IDENTIFIER_MESSAGE);
  });

  it.each(["Jane Smith", "Smith", "JANE SMITH", "Zoë Ng"])("refuses %s as a bed-or-initials label", (label) => {
    expect(onCallCallLogProblem(draft({ label }))).toBe(ON_CALL_CALL_LOG_NAME_MESSAGE);
  });

  it.each(["JS", "J.S.", "ICU", "4B-12", "Bed 7", ""])("accepts %s as a bed-or-initials label", (label) => {
    expect(onCallCallLogProblem(draft({ label }))).toBeNull();
  });
});

describe("the call log store", () => {
  it("never writes a refused note", () => {
    const result = addOnCallCallLogEntry(draft({ note: "MRN: 998877" }), twoAm);
    expect(result.ok).toBe(false);
    expect(window.localStorage.getItem(onCallCallLogStorageKey)).toBeNull();
  });

  it("keeps notes newest first, trimmed", () => {
    addOnCallCallLogEntry(draft({ label: " 4B-12 " }), twoAm);
    addOnCallCallLogEntry(draft({ label: "5A-3" }), halfThree);
    const log = readOnCallCallLog(halfThree);
    expect(log.map((entry) => entry.label)).toEqual(["5A-3", "4B-12"]);
  });

  it("lets a note lapse 12 hours after it was written", () => {
    addOnCallCallLogEntry(draft(), twoAm);
    expect(readOnCallCallLog(new Date(twoAm.getTime() + 11 * 3_600_000))).toHaveLength(1);
    expect(readOnCallCallLog(new Date(twoAm.getTime() + 12 * 3_600_000 + 1))).toHaveLength(0);
  });

  it("refuses a note once the log is full, rather than dropping the oldest", () => {
    for (let index = 0; index < ON_CALL_CALL_LOG_LIMIT; index += 1) {
      addOnCallCallLogEntry(draft({ label: `B${index}` }), new Date(twoAm.getTime() + index * 1000));
    }
    const extra = addOnCallCallLogEntry(draft({ label: "B99" }), halfThree);
    expect(extra).toEqual({ ok: false, problem: ON_CALL_CALL_LOG_FULL_MESSAGE });
    const log = readOnCallCallLog(halfThree);
    expect(log).toHaveLength(ON_CALL_CALL_LOG_LIMIT);
    expect(log.some((entry) => entry.label === "B0")).toBe(true);
  });

  it("shows nothing once the shift has ended, even before the wipe runs", () => {
    addOnCallCallLogEntry(draft(), twoAm);
    const rawLog = window.localStorage.getItem(onCallCallLogStorageKey);
    const rawStamp = window.localStorage.getItem(PATIENT_LABEL_EXPIRY_STORAGE_KEY);
    expect(visibleOnCallCallLog(rawLog, rawStamp, halfThree).entries).toHaveLength(1);
    const ended = new Date(twoAm.getTime() + 12 * 3_600_000);
    expect(visibleOnCallCallLog(rawLog, rawStamp, ended)).toEqual({ entries: [], expiresAt: null });
    expect(visibleOnCallCallLog(rawLog, null, halfThree).entries).toEqual([]);
  });

  it("treats a foreign payload as an empty log", () => {
    window.localStorage.setItem(onCallCallLogStorageKey, JSON.stringify([{ id: "x", name: "Jane Smith" }]));
    expect(readOnCallCallLog(twoAm)).toEqual([]);
  });

  it("marks done, deletes and clears", () => {
    const first = addOnCallCallLogEntry(draft(), twoAm);
    const second = addOnCallCallLogEntry(draft({ label: "5A-3" }), halfThree);
    if (!first.ok || !second.ok) throw new Error("setup failed");
    setOnCallCallLogDone(first.entry.id, true, halfThree);
    expect(readOnCallCallLog(halfThree).find((entry) => entry.id === first.entry.id)?.done).toBe(true);
    removeOnCallCallLogEntry(second.entry.id, halfThree);
    expect(readOnCallCallLog(halfThree)).toHaveLength(1);
    clearOnCallCallLog();
    expect(window.localStorage.getItem(onCallCallLogStorageKey)).toBeNull();
  });

  it("is kept only through the patient-label store, behind its expiry stamp", () => {
    expect(onCallCallLogStorageKey.startsWith(PATIENT_LABEL_KEY_PREFIX)).toBe(true);
    addOnCallCallLogEntry(draft(), twoAm);
    expect(window.localStorage.getItem(PATIENT_LABEL_EXPIRY_STORAGE_KEY)).not.toBeNull();
  });

  it("is wiped at sign-out with every other patient label", () => {
    addOnCallCallLogEntry(draft(), twoAm);
    clearPatientLabels("account-transition");
    expect(window.localStorage.getItem(onCallCallLogStorageKey)).toBeNull();
  });

  it("is wiped when the shift ends", () => {
    addOnCallCallLogEntry(draft(), twoAm);
    expect(clearExpiredPatientLabels(twoAm.getTime() + 12 * 3_600_000)).toBe(true);
    expect(window.localStorage.getItem(onCallCallLogStorageKey)).toBeNull();
  });
});

describe("the handover", () => {
  it("carries open notes only, oldest first, in Perth time", () => {
    const first = addOnCallCallLogEntry(draft(), twoAm);
    addOnCallCallLogEntry(draft({ label: "5A-3", caller: "", note: "Settled", followUp: "" }), halfThree);
    addOnCallCallLogEntry(draft({ label: "6C-1" }), new Date(halfThree.getTime() + 60_000));
    const log = readOnCallCallLog(halfThree);
    const done = log.find((entry) => entry.label === "6C-1");
    if (!first.ok || !done) throw new Error("setup failed");
    setOnCallCallLogDone(done.id, true, halfThree);

    const items = onCallHandoverItems(readOnCallCallLog(halfThree));
    expect(items.map((entry) => entry.label)).toEqual(["4B-12", "5A-3"]);

    const text = onCallHandoverText(readOnCallCallLog(halfThree), halfThree);
    expect(text).toBe(
      [
        "On call handover, Sat 3 Oct",
        "",
        "02:00 · 4B-12 · from ED registrar",
        "  Agitated overnight, reviewed",
        "  To do: Bloods in the morning",
        "",
        "03:30 · 5A-3",
        "  Settled",
      ].join("\n"),
    );
  });

  it("is empty when nothing is open", () => {
    expect(onCallHandoverText([], halfThree)).toBe("");
  });
});
