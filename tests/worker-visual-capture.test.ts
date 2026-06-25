import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync(new URL("../worker/main.ts", import.meta.url), "utf8");
const extractorSource = readFileSync(new URL("../worker/python/extract_pdf_assets.py", import.meta.url), "utf8");

describe("worker visual capture hardening", () => {
  it("invalidates stale image caption cache entries by policy, prompt, and context versions", () => {
    expect(workerSource).toContain('const imageCaptionCacheVersion = "clinical-image-caption-cache-v2"');
    expect(workerSource).toContain('const visionClassificationPromptVersion = "clinical-image-classification-v1"');
    expect(workerSource).toContain("metadata.image_caption_cache_version !== imageCaptionCacheVersion");
    expect(workerSource).toContain("metadata.image_policy_version !== clinicalImagePolicyVersion");
    expect(workerSource).toContain("metadata.visual_intelligence_version !== visualIntelligenceVersion");
    expect(workerSource).toContain("metadata.caption_context_hash !== contextHash");
  });

  it("computes perceptual duplicate groups before caption budget selection", () => {
    expect(workerSource.indexOf("const preparedImages = await Promise.all")).toBeLessThan(
      workerSource.indexOf("const scoredCandidates = rankVisualCandidates"),
    );
    expect(workerSource).toContain("lightweightPerceptualHash(bytes, image.width, image.height)");
    expect(workerSource).toContain("perceptualHash: preparedImages[index]?.perceptualHash ?? null");
  });

  it("propagates OCR failures and captures image-dominant page regions", () => {
    expect(extractorSource).toContain('return "", f"OCR failed on page');
    expect(extractorSource).toContain("warnings.append(ocr_warning)");
    expect(extractorSource).toContain('"warnings": warnings');
    expect(extractorSource).toContain("image_dominant_page_region");
    expect(extractorSource).toContain("source_regions");
    expect(extractorSource).toContain("render_dpi");
  });
});
