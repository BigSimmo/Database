// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ON_CALL_DEVICE_STATE_KEYS,
  clearOnCallDeviceState,
  onCallCallMarksStorageKey,
  onCallDeviceStateChangedEvent,
  onCallEditorFlagStorageKey,
  onCallEmergencyPinnedStorageKey,
  onCallHandbookOfflineStorageKey,
  readOnCallEditorFlag,
  readOnCallEditorStatus,
  rememberOnCallEditorFlag,
} from "@/lib/on-call/device-state-keys";
import {
  ON_CALL_YOU_CALLED_HOURS,
  onCallYouCalledAt,
  readOnCallYouCalled,
  rememberOnCallYouCalled,
} from "@/lib/on-call/call-marks";
import { readOnCallEmergencyPinned, rememberOnCallEmergencyPinned } from "@/lib/on-call/emergency-pin-memory";
import {
  ON_CALL_ADMIN_ROWS_HREF,
  ON_CALL_WHOS_ON_ENABLED,
  ON_CALL_YOU_CALLED_ENABLED,
} from "@/lib/on-call/feature-flags";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("On Call device state", () => {
  it("imports nothing, because the sign-out path loads it on every page", () => {
    const source = readFileSync("src/lib/on-call/device-state-keys.ts", "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("lists the offline copy with the rest, so an approved lane D is wiped at sign-out too", () => {
    expect(ON_CALL_DEVICE_STATE_KEYS).toContain(onCallHandbookOfflineStorageKey);
    expect(new Set(ON_CALL_DEVICE_STATE_KEYS).size).toBe(ON_CALL_DEVICE_STATE_KEYS.length);
  });

  it("wipes the You called marks, the emergency yes/no and the editor flag with the rest", () => {
    for (const key of [onCallCallMarksStorageKey, onCallEmergencyPinnedStorageKey, onCallEditorFlagStorageKey]) {
      expect(ON_CALL_DEVICE_STATE_KEYS).toContain(key);
    }
  });

  it("removes every key and tells mounted stores once", () => {
    for (const key of ON_CALL_DEVICE_STATE_KEYS) window.localStorage.setItem(key, "x");
    const heard = vi.fn();
    window.addEventListener(onCallDeviceStateChangedEvent, heard);
    clearOnCallDeviceState();
    window.removeEventListener(onCallDeviceStateChangedEvent, heard);
    for (const key of ON_CALL_DEVICE_STATE_KEYS) expect(window.localStorage.getItem(key)).toBeNull();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("still notifies when storage throws, so in-memory copies are dropped", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const heard = vi.fn();
    window.addEventListener(onCallDeviceStateChangedEvent, heard);
    clearOnCallDeviceState();
    window.removeEventListener(onCallDeviceStateChangedEvent, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("the editor flag the pages sheet reads (review S3)", () => {
  it("offers Manage service while the role is unknown, and hides it only for a known non-editor", () => {
    expect(readOnCallEditorStatus()).toBe("unknown");
    expect(readOnCallEditorFlag()).toBe(true);
    rememberOnCallEditorFlag(false);
    expect(readOnCallEditorStatus()).toBe("not-editor");
    expect(window.localStorage.getItem(onCallEditorFlagStorageKey)).toBe("0");
    expect(readOnCallEditorFlag()).toBe(false);
    rememberOnCallEditorFlag(true);
    expect(readOnCallEditorStatus()).toBe("editor");
    expect(readOnCallEditorFlag()).toBe(true);
  });

  it("is unknown again after the sign-out wipe, so the next reader still sees the row", () => {
    rememberOnCallEditorFlag(false);
    clearOnCallDeviceState();
    expect(readOnCallEditorStatus()).toBe("unknown");
    expect(readOnCallEditorFlag()).toBe(true);
  });

  it("treats a value it does not recognise, or blocked storage, as unknown", () => {
    window.localStorage.setItem(onCallEditorFlagStorageKey, "maybe");
    expect(readOnCallEditorStatus()).toBe("unknown");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readOnCallEditorStatus()).toBe("unknown");
    expect(readOnCallEditorFlag()).toBe(true);
  });
});

describe("You called (device only, 12 hours)", () => {
  const at = new Date("2026-09-26T18:14:00.000Z");

  it("is switched on by one constant", () => {
    expect(ON_CALL_YOU_CALLED_ENABLED).toBe(true);
    expect(ON_CALL_YOU_CALLED_HOURS).toBe(12);
  });

  it("remembers an entry id and a time, never a number", () => {
    rememberOnCallYouCalled("entry-1", at);
    expect(readOnCallYouCalled(at)).toEqual([{ entryId: "entry-1", calledAt: at.toISOString() }]);
    expect(window.localStorage.getItem(onCallCallMarksStorageKey)).not.toMatch(/\d{4}\s?\d{4}/);
  });

  it("keeps only the latest call per entry", () => {
    rememberOnCallYouCalled("entry-1", at);
    const later = new Date(at.getTime() + 60_000);
    rememberOnCallYouCalled("entry-1", later);
    expect(readOnCallYouCalled(later)).toEqual([{ entryId: "entry-1", calledAt: later.toISOString() }]);
    expect(onCallYouCalledAt("entry-1", later)).toBe(later.toISOString());
  });

  it("forgets a call after 12 hours", () => {
    rememberOnCallYouCalled("entry-1", at);
    const justBefore = new Date(at.getTime() + 12 * 60 * 60 * 1000 - 1);
    const after = new Date(at.getTime() + 12 * 60 * 60 * 1000);
    expect(onCallYouCalledAt("entry-1", justBefore)).toBe(at.toISOString());
    expect(onCallYouCalledAt("entry-1", after)).toBeNull();
    expect(readOnCallYouCalled(after)).toEqual([]);
  });

  it("treats a foreign payload as no marks", () => {
    window.localStorage.setItem(onCallCallMarksStorageKey, JSON.stringify([{ entryId: "x", phone: "90000001" }]));
    expect(readOnCallYouCalled(at)).toEqual([]);
  });

  it("is cleared by clearOnCallDeviceState", () => {
    rememberOnCallYouCalled("entry-1", at);
    clearOnCallDeviceState();
    expect(readOnCallYouCalled(at)).toEqual([]);
  });
});

describe("whether this hospital has a pinned emergency number (a yes or no, never the number)", () => {
  it("is unknown until a hospital has loaded once", () => {
    expect(readOnCallEmergencyPinned("svc:site")).toBeNull();
  });

  it("remembers yes and no per hospital", () => {
    rememberOnCallEmergencyPinned("svc:site-a", true);
    rememberOnCallEmergencyPinned("svc:site-b", false);
    expect(readOnCallEmergencyPinned("svc:site-a")).toBe(true);
    expect(readOnCallEmergencyPinned("svc:site-b")).toBe(false);
    expect(window.localStorage.getItem(onCallEmergencyPinnedStorageKey)).not.toMatch(/\d{3,}/);
  });

  it("is cleared by clearOnCallDeviceState", () => {
    rememberOnCallEmergencyPinned("svc:site-a", true);
    clearOnCallDeviceState();
    expect(readOnCallEmergencyPinned("svc:site-a")).toBeNull();
  });
});

describe("kit constants that one line flips", () => {
  it("shows role-only Who's on in Stage C and points admin rows at today's page", () => {
    expect(ON_CALL_WHOS_ON_ENABLED).toBe(true);
    expect(ON_CALL_ADMIN_ROWS_HREF).toBe("/on-call/logistics");
  });

  it("keeps the flags module import-free so the header may read it", () => {
    const source = readFileSync("src/lib/on-call/feature-flags.ts", "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
