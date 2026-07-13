import { afterEach, describe, expect, it } from "vitest";
import {
  acquireUploadAdmission,
  parseUploadContentLength,
  resetUploadAdmissionForTests,
} from "../src/lib/upload-admission";

afterEach(() => resetUploadAdmissionForTests());

describe("upload admission", () => {
  it("parses valid content lengths and rejects malformed or negative values", () => {
    expect(parseUploadContentLength(null)).toBeNull();
    expect(parseUploadContentLength("1024")).toBe(1024);
    expect(() => parseUploadContentLength("-1")).toThrow(/content-length/i);
    expect(() => parseUploadContentLength("12.5")).toThrow(/content-length/i);
    expect(() => parseUploadContentLength("not-a-number")).toThrow(/content-length/i);
  });

  it("rejects concurrent capacity and releases the slot", () => {
    const first = acquireUploadAdmission({ bytes: 10, maxConcurrent: 1, maxBytes: 100 });
    expect(first.ok).toBe(true);
    expect(acquireUploadAdmission({ bytes: 10, maxConcurrent: 1, maxBytes: 100 })).toEqual({
      ok: false,
      reason: "concurrency",
    });
    if (first.ok) first.release();
    expect(acquireUploadAdmission({ bytes: 10, maxConcurrent: 1, maxBytes: 100 }).ok).toBe(true);
  });

  it("rejects reservations over the byte budget and releases bytes exactly once", () => {
    const first = acquireUploadAdmission({ bytes: 80, maxConcurrent: 2, maxBytes: 100 });
    expect(first.ok).toBe(true);
    expect(acquireUploadAdmission({ bytes: 30, maxConcurrent: 2, maxBytes: 100 })).toEqual({
      ok: false,
      reason: "bytes",
    });
    if (first.ok) {
      first.release();
      first.release();
    }
    expect(acquireUploadAdmission({ bytes: 100, maxConcurrent: 2, maxBytes: 100 }).ok).toBe(true);
  });
});
