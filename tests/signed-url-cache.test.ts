import { describe, expect, it } from "vitest";
import {
  clearCachedSignedUrl,
  clearSignedUrlCache,
  getCachedSignedUrl,
  setCachedSignedUrl,
} from "../src/lib/signed-url-cache";

describe("signed URL cache", () => {
  it("stores signed image URL payloads by endpoint", () => {
    clearSignedUrlCache();

    expect(getCachedSignedUrl("/api/images/a/signed-url")).toBeNull();
    setCachedSignedUrl("/api/images/a/signed-url", {
      url: "/demo-documents/image.png",
      caption: "Image caption",
    });

    expect(getCachedSignedUrl("/api/images/a/signed-url")?.url).toBe("/demo-documents/image.png");
  });

  it("clears one signed URL endpoint without clearing the full cache", () => {
    clearSignedUrlCache();

    setCachedSignedUrl("/api/images/a/signed-url", { url: "/demo-documents/a.png" });
    setCachedSignedUrl("/api/images/b/signed-url", { url: "/demo-documents/b.png" });

    clearCachedSignedUrl("/api/images/a/signed-url");

    expect(getCachedSignedUrl("/api/images/a/signed-url")).toBeNull();
    expect(getCachedSignedUrl("/api/images/b/signed-url")?.url).toBe("/demo-documents/b.png");
  });
});
