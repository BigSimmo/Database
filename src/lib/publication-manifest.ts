import { createHash } from "node:crypto";
import { z } from "zod";

const publicationDecisionSchema = z.enum(["approved", "keep_private", "quarantine"]);

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
          expectedStateDigest: z.string().regex(/^[0-9a-f]{64}$/),
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

export type PublicationCommandArgs = {
  manifestPath: string;
  apply: boolean;
  expectedCount?: number;
  confirmSha256?: string;
};

export function parsePublicationManifest(raw: string): PublicationManifest {
  return publicationManifestSchema.parse(JSON.parse(raw));
}

export function publicationManifestDigest(raw: string | Buffer) {
  return createHash("sha256").update(raw).digest("hex");
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
  manifest: PublicationManifest;
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
