import { describe, expect, it } from "vitest";

import {
  checkinScanPath,
  isTeachingSecret,
  parseCheckinToken,
  teachingDisplayPath,
} from "@/lib/teaching/checkin-token";

const occurrenceId = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const hex = occurrenceId.replace(/-/g, "");
const mac = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("parseCheckinToken", () => {
  it("reads the occurrence, stream and window from a room token", () => {
    expect(parseCheckinToken(`${hex}r59663201${mac}`)).toEqual({ occurrenceId, stream: "room", window: 59663201 });
  });

  it("reads a Teams token", () => {
    expect(parseCheckinToken(`${hex}t1${mac}`)).toEqual({ occurrenceId, stream: "teams", window: 1 });
  });

  it.each([
    ["empty", ""],
    ["upper-case hex", `${hex.toUpperCase()}r59663201${mac}`],
    ["unknown stream", `${hex}x59663201${mac}`],
    ["short mac with no window digit to borrow", `${hex}t1${mac.slice(1)}`],
    ["window over twelve digits", `${hex}r1234567890123${mac}`],
    ["trailing text", `${hex}r59663201${mac}/extra`],
    ["a uuid alone", occurrenceId],
  ])("refuses %s", (_label, token) => {
    expect(parseCheckinToken(token)).toBeNull();
  });

  // The format has no separator, so a mac one character short takes the window's last digit and
  // still has the shape of a token (the database's own regex reads it the same way). Only the
  // database's MAC check, which holds the secret, can refuse it; this pins that the parser does not
  // pretend otherwise.
  it("leaves a mac short by a character to the database's MAC check", () => {
    expect(parseCheckinToken(`${hex}r59663201${mac.slice(1)}`)).toEqual({
      occurrenceId,
      stream: "room",
      window: 5966320,
    });
  });

  it("refuses anything that is not a string", () => {
    expect(parseCheckinToken(undefined)).toBeNull();
    expect(parseCheckinToken(42)).toBeNull();
  });

  it("builds the scan and display paths", () => {
    const token = `${hex}r59663201${mac}`;
    expect(checkinScanPath(token)).toBe(`/teaching/c/${token}`);
    expect(teachingDisplayPath("d".repeat(64))).toBe(`/teaching/display/${"d".repeat(64)}`);
  });

  it("recognises only 64 lower-case hex characters as a secret", () => {
    expect(isTeachingSecret("d".repeat(64))).toBe(true);
    expect(isTeachingSecret("D".repeat(64))).toBe(false);
    expect(isTeachingSecret("d".repeat(63))).toBe(false);
    expect(isTeachingSecret(null)).toBe(false);
  });
});
