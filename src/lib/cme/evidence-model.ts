import { z } from "zod";

export const CME_EVIDENCE_BUCKET = "cme-private-evidence";
export const CME_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const CME_EVIDENCE_LIMIT = 20;
export const cmeEvidenceKinds = ["certificate", "receipt", "assessment", "other"] as const;
export const cmeEvidenceKindSchema = z.enum(cmeEvidenceKinds);
export type CmeEvidenceKind = z.infer<typeof cmeEvidenceKindSchema>;
export const cmeEvidenceSchema = z.object({
  id: z.string().uuid(),
  entryId: z.string().uuid(),
  fileName: z.string(),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  byteSize: z.number().int().positive(),
  kind: cmeEvidenceKindSchema,
  uploadedAt: z.string(),
  /** Set when the owner removed the file; the row stays as a record of when and why. */
  removedAt: z.string().nullable().default(null),
  removalReason: z.string().nullable().default(null),
});

/** The reason the owner gives for removing a file. Kept; the file itself is deleted. */
export const cmeEvidenceRemovalSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export type CmeEvidence = z.infer<typeof cmeEvidenceSchema>;
