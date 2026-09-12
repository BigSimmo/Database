import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assertIndexableCatalogueEntry,
  australianSourceByKey,
  australianSourcePolicyVersion,
} from "@/lib/australian-source-catalogue";
import { classifySourceAuthority } from "@/lib/source-authority-registry";
import { normalizeClinicalSourceMetadata } from "@/lib/source-metadata";
import type { ClinicalSourceMetadataInput } from "@/lib/types";

const publicationDecisionSchema = z.enum(["approved", "keep_private", "quarantine"]);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const evidenceReferenceSchema = z.string().trim().min(1).max(500);

const publicationManifestSchema = z
  .object({
    version: z.literal(1),
    approvingOperatorId: z.string().uuid(),
    reason: z.string().trim().min(3).max(2000),
    evidenceReferences: z.array(z.string().trim().min(1)).min(1),
    documents: z
      .array(
        z.object({
          documentId: z.string().uuid(),
          expectedOwnerId: z.string().uuid(),
          expectedStateDigest: sha256Schema,
          decision: publicationDecisionSchema,
        }),
      )
      .min(1),
  })
  .superRefine((manifest, context) => {
    const seen = new Set<string>();
    for (const [index, document] of manifest.documents.entries()) {
      if (seen.has(document.documentId)) {
        context.addIssue({
          code: "custom",
          message: "documentId values must be unique",
          path: ["documents", index, "documentId"],
        });
      }
      seen.add(document.documentId);
    }
  });

export type PublicationManifest = z.infer<typeof publicationManifestSchema>;

const publicationManifestV2Schema = z
  .object({
    version: z.literal(2),
    sourcePolicyVersion: z.literal(australianSourcePolicyVersion),
    approvingOperatorId: z.string().uuid(),
    reason: z.string().trim().min(3).max(2000),
    evidenceReferences: z.array(evidenceReferenceSchema).min(1).max(50),
    documents: z
      .array(
        z
          .object({
            documentId: z.string().uuid(),
            expectedOwnerId: z.string().uuid(),
            expectedStateDigest: sha256Schema,
            expectedIndexGenerationId: z.string().uuid(),
            sourceCatalogueKey: z.string().trim().min(1).max(100),
            decision: publicationDecisionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()
  .superRefine((manifest, context) => {
    const seen = new Set<string>();
    for (const [index, document] of manifest.documents.entries()) {
      if (seen.has(document.documentId)) {
        context.addIssue({
          code: "custom",
          message: "documentId values must be unique",
          path: ["documents", index, "documentId"],
        });
      }
      seen.add(document.documentId);

      const catalogueEntry = australianSourceByKey(document.sourceCatalogueKey);
      if (!catalogueEntry) {
        context.addIssue({
          code: "custom",
          message: "sourceCatalogueKey must identify a governed Australian source",
          path: ["documents", index, "sourceCatalogueKey"],
        });
        continue;
      }
      if (document.decision !== "approved") continue;
      try {
        assertIndexableCatalogueEntry(catalogueEntry);
      } catch {
        context.addIssue({
          code: "custom",
          message: "sourceCatalogueKey is not eligible for Australian public activation",
          path: ["documents", index, "sourceCatalogueKey"],
        });
      }
    }
  });

export type PublicationManifestV2 = z.infer<typeof publicationManifestV2Schema>;
export type AnyPublicationManifest = PublicationManifest | PublicationManifestV2;

/**
 * Bind public activation to the canonical Task 2 authority tuple and Task 3
 * catalogue role boundary. The reviewed-state digest then protects this exact
 * normalized metadata until the database completes publication.
 */
export function assertAustralianPublicActivationMetadata(input: unknown, expectedCatalogueKey: string) {
  const safeInput =
    input && typeof input === "object" && !Array.isArray(input) ? (input as ClinicalSourceMetadataInput) : null;
  const metadata = normalizeClinicalSourceMetadata(safeInput);
  const authority = classifySourceAuthority(metadata);
  const exactCatalogueIdentity =
    metadata.source_catalogue_key === expectedCatalogueKey &&
    authority.cataloguePolicyResolved &&
    authority.catalogueEntry?.key === expectedCatalogueKey &&
    authority.matchedBy === "source_catalogue_key";
  const completePublisherIdentity = Boolean(metadata.publisher && metadata.publisher_code && metadata.jurisdiction);
  const activeChangeState = metadata.change_state === "changed" || metadata.change_state === "unchanged";

  if (
    metadata.source_kind !== "document" ||
    !exactCatalogueIdentity ||
    !completePublisherIdentity ||
    !authority.australianAugmentationEligible ||
    !activeChangeState
  ) {
    const reasons = [
      ...authority.conflicts,
      ...authority.eligibilityReasons,
      ...(activeChangeState ? [] : ["change_state_inactive_or_unknown"]),
    ];
    throw new Error(
      `Australian activation metadata is not eligible for ${expectedCatalogueKey}: ${[...new Set(reasons)].join(", ") || "identity_or_role_mismatch"}`,
    );
  }

  return metadata;
}

export type PublicationCommandArgs = {
  manifestPath: string;
  apply: boolean;
  expectedCount?: number;
  confirmSha256?: string;
};

export function parsePublicationManifest(raw: string): PublicationManifest {
  return publicationManifestSchema.parse(JSON.parse(raw));
}

export function parsePublicationManifestV2(input: unknown): PublicationManifestV2 {
  return publicationManifestV2Schema.parse(input);
}

export function parseVersionedPublicationManifest(raw: string): AnyPublicationManifest {
  const input: unknown = JSON.parse(raw);
  if (input && typeof input === "object" && "version" in input && input.version === 2) {
    return parsePublicationManifestV2(input);
  }
  return publicationManifestSchema.parse(input);
}

export function publicationManifestDigest(raw: string | Buffer) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Confirmation digest for the complete reviewed state set in a v2 batch.
 * Sorting by document id makes the value independent of manifest row order;
 * the database recomputes this same shape before taking any ownership action.
 */
export function publicationManifestV2ExpectedStateDigest(manifest: PublicationManifestV2) {
  const reviewedStates = manifest.documents
    .map((document) => `${document.documentId}:${document.expectedStateDigest}`)
    .sort()
    .join("\n");
  return publicationManifestDigest(reviewedStates);
}

export function parsePublicationCommandArgs(argv: string[]): PublicationCommandArgs {
  let manifestPath: string | undefined;
  let expectedCount: number | undefined;
  let confirmSha256: string | undefined;
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--manifest") {
      manifestPath = argv[++index];
    } else if (token === "--expected-count") {
      expectedCount = Number(argv[++index]);
    } else if (token === "--confirm-sha256") {
      confirmSha256 = argv[++index]?.toLowerCase();
    } else if (token === "--apply") {
      apply = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!manifestPath) throw new Error("--manifest <path> is required");
  if (expectedCount !== undefined && (!Number.isSafeInteger(expectedCount) || expectedCount < 1)) {
    throw new Error("--expected-count must be a positive integer");
  }
  if (confirmSha256 !== undefined && !/^[0-9a-f]{64}$/.test(confirmSha256)) {
    throw new Error("--confirm-sha256 must be a SHA-256 digest");
  }
  if (apply && expectedCount === undefined) throw new Error("--expected-count is required with --apply");
  if (apply && confirmSha256 === undefined) throw new Error("--confirm-sha256 is required with --apply");

  return { manifestPath, apply, expectedCount, confirmSha256 };
}

export function assertPublicationApplyConfirmation(args: {
  manifest: AnyPublicationManifest;
  digest: string;
  expectedCount?: number;
  confirmSha256?: string;
}) {
  if (args.expectedCount !== args.manifest.documents.length) {
    throw new Error(
      `Expected count ${String(args.expectedCount)} does not match manifest count ${args.manifest.documents.length}`,
    );
  }
  if (args.confirmSha256 !== args.digest) {
    throw new Error(`Confirmed SHA-256 does not match manifest digest ${args.digest}`);
  }
}
