// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { clearOnCallDeviceState, onCallMyTeamStorageKey } from "@/lib/on-call/device-state-keys";
import { canonicalOnCallTeam, readOnCallMyTeam, saveOnCallMyTeam } from "@/lib/on-call/my-team-storage";

beforeEach(() => window.localStorage.clear());

describe("my team", () => {
  it("stores the canonical name of any team, because any prefix is a team", () => {
    saveOnCallMyTeam("Renal medicine");
    expect(readOnCallMyTeam()).toBe("Renal medicine");
    saveOnCallMyTeam("Intensive care");
    expect(readOnCallMyTeam()).toBe("ICU");
    expect(window.localStorage.getItem(onCallMyTeamStorageKey)).toBe(JSON.stringify("ICU"));
  });

  it("ignores a stored value that is not a team name", () => {
    window.localStorage.setItem(onCallMyTeamStorageKey, JSON.stringify(42));
    expect(readOnCallMyTeam()).toBeNull();
    window.localStorage.setItem(onCallMyTeamStorageKey, JSON.stringify(""));
    expect(readOnCallMyTeam()).toBeNull();
    window.localStorage.setItem(onCallMyTeamStorageKey, "not json");
    expect(readOnCallMyTeam()).toBeNull();
  });

  it("never treats a category prefix as a team", () => {
    expect(canonicalOnCallTeam("Emergency")).toBeNull();
    expect(canonicalOnCallTeam("Ward")).toBeNull();
  });

  it("forgets the team on No team", () => {
    saveOnCallMyTeam("Medicine");
    saveOnCallMyTeam(null);
    expect(readOnCallMyTeam()).toBeNull();
    expect(window.localStorage.getItem(onCallMyTeamStorageKey)).toBeNull();
  });

  it("is cleared at sign-out", () => {
    saveOnCallMyTeam("ICU");
    clearOnCallDeviceState();
    expect(readOnCallMyTeam()).toBeNull();
  });
});
