import { describe, expect, it } from "vitest";
import {
  probeContentEncodings,
  probeCorpusImageEncodings,
  runSelfTest,
} from "../scripts/probe-corpus-image-encodings.mjs";

describe("probe-corpus-image-encodings", () => {
  it("passes built-in self-test", () => {
    expect(() => runSelfTest()).not.toThrow();
  });

  it("detects JBIG2, JPX, and standard 14 font references in synthetic streams", () => {
    const stream = `
      << /Type /XObject /Subtype /Image /Filter /JBIG2Decode /Width 800 >>
      stream ... endstream
      << /Type /XObject /Subtype /Image /Filter /JPXDecode /Width 1200 >>
      stream ... endstream
      << /Type /Font /BaseFont /Times-Bold >>
    `;
    const result = probeContentEncodings(stream);
    expect(result.hasJbig2).toBe(true);
    expect(result.hasJpx).toBe(true);
    expect(result.encodings.JBIG2).toBe(1);
    expect(result.encodings.JPX).toBe(1);
    expect(result.standard14Count).toBe(1);
  });

  it("scans corpus fixtures and returns a valid report structure", () => {
    const report = probeCorpusImageEncodings();
    expect(report).toHaveProperty("scannedFilesCount");
    expect(report).toHaveProperty("encodings");
    expect(report).toHaveProperty("findings");
    expect(typeof report.findings.requiresPdfJsDecoders).toBe("boolean");
    expect(typeof report.findings.recommendation).toBe("string");
  });
});
