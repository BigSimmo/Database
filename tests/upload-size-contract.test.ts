import { describe, expect, it } from "vitest";
import { assertAllowedFile, PublicApiError } from "../src/lib/http";

describe("upload size contract", () => {
  it("uses 413 and a stable code one byte above the configured limit", () => {
    const file = new File([new Uint8Array(1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
    expect(() => assertAllowedFile(file, 1)).toThrowError(
      expect.objectContaining<Partial<PublicApiError>>({ status: 413, details: { code: "payload_too_large" } }),
    );
  });
});
