import type { ExtractedImage, ImageEvidenceCategory } from "@/lib/types";

export type CheapImageFilterInput = {
  bytesLength: number;
  imageHash: string;
  seenHashes: Set<string>;
  image: Pick<ExtractedImage, "bbox" | "height" | "width" | "sourceKind">;
};

export type ClassifiedImage = {
  image_type: ImageEvidenceCategory;
  searchable: boolean;
  clinical_relevance_score: number;
  skip_reason: string | null;
};

function bboxLooksLikeHeaderOrFooter(bbox: ExtractedImage["bbox"]) {
  if (!bbox) return false;
  const [, y0, , y1] = bbox;
  const height = Math.abs(y1 - y0);
  if (height > 110) return false;
  return y1 < 105 || y0 > 705;
}

export function cheapImageSkipReason(input: CheapImageFilterInput) {
  const { bytesLength, imageHash, image, seenHashes } = input;
  const sourceKind = image.sourceKind ?? "embedded";
  const width = image.width ?? null;
  const height = image.height ?? null;

  if (seenHashes.has(imageHash)) return "duplicate image";
  if (sourceKind === "embedded" && bytesLength < 4096) return "small decorative image";
  if (width && height) {
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    const aspectRatio = longestSide / Math.max(shortestSide, 1);

    if (sourceKind === "embedded" && bboxLooksLikeHeaderOrFooter(image.bbox)) {
      return "logo/header/footer placement";
    }
    if (sourceKind === "embedded" && shortestSide < 72) return "tiny icon or marker";
    if (sourceKind === "embedded" && aspectRatio > 12) return "extreme aspect ratio decorative image";
  }

  return null;
}

export function classifiedImageSkipReason(classification: ClassifiedImage) {
  if (classification.image_type === "logo_decorative") return classification.skip_reason ?? "logo or decorative mark";
  if (!classification.searchable) return classification.skip_reason ?? "not clinically searchable";
  if (classification.clinical_relevance_score < 0.18) return classification.skip_reason ?? "low clinical relevance";
  return null;
}

export function lightweightPerceptualHash(imageHash: string, width?: number | null, height?: number | null) {
  return [imageHash.slice(0, 24), width ?? "w", height ?? "h"].join(":");
}
