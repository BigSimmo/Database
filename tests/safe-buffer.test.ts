import { describe, expect, it } from "vitest";
import { safeBufferFrom } from "../src/lib/safe-buffer";

describe("safeBufferFrom", () => {
  it("copies binary inputs", () => {
    const original = Buffer.from("clinical");
    const copied = safeBufferFrom(original);

    expect(copied?.toString("utf8")).toBe("clinical");
    expect(copied).not.toBe(original);
  });

  it("decodes canonical base64 payloads", () => {
    expect(safeBufferFrom("Y2xpbmljYWw=", "base64")?.toString("utf8")).toBe("clinical");
  });

  it("returns null for malformed base64 payloads", () => {
    expect(safeBufferFrom("%%%not-base64%%%", "base64")).toBeNull();
    expect(safeBufferFrom("abcde", "base64")).toBeNull();
  });

  it("returns null for unsupported uncertain inputs", () => {
    expect(safeBufferFrom({ data: "YQ==" }, "base64")).toBeNull();
  });
});
