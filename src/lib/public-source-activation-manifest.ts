import { createHash } from "node:crypto";
import { z } from "zod";

import {
  assertIndexableCatalogueEntry,
  australianSourceByKey,
  australianSourceCatalogue,
  australianSourcePolicyVersion,
  type AustralianSourceDefinition,
} from "@/lib/australian-source-catalogue";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const evidenceReferenceSchema = z.string().trim().min(1).max(500);
const rawCodeUnitSort = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const sourceRolesSchema = z.array(z.string()).superRefine((roles, context) => {
  const normalized = roles.map((role) => role.normalize("NFC"));
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", message: "Source roles must be unique." });
  }
});

const canonicalSourceSchema = z
  .object({
    key: z.string(),
    publisherCode: z.string(),
    publisher: z.string(),
    canonicalUrl: z.string(),
    jurisdiction: z.string(),
    corpusScope: z.literal("australian_public"),
    roles: sourceRolesSchema,
    contentMode: z.enum(["indexed_content", "link_only"]),
    licencePolicy: z.enum(["review_required", "public_index_permitted", "metadata_link_only", "index_forbidden"]),
    lifecycle: z.enum(["active", "historical", "retired"]),
    fallbackRank: z.number().finite(),
  })
  .strict();

const canonicalPolicyPayloadSchema = z
  .object({
    version: z.literal(1),
    sourcePolicyVersion: z.string(),
    sources: z.array(canonicalSourceSchema),
  })
  .strict();

function canonicalJson(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical policy values must be finite.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(rawCodeUnitSort)
      .map((key) => `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("Canonical policy values have an unsupported shape.");
}

function canonicalSource(source: AustralianSourceDefinition) {
  return {
    key: source.key,
    publisherCode: source.publisherCode,
    publisher: source.publisher,
    canonicalUrl: source.canonicalUrl,
    jurisdiction: source.jurisdiction,
    corpusScope: source.corpusScope,
    roles: [...source.roles].sort(rawCodeUnitSort),
    contentMode: source.contentMode,
    licencePolicy: source.licencePolicy,
    lifecycle: source.lifecycle,
    fallbackRank: source.fallbackRank,
  };
}

export function canonicalizePublicSourcePolicyPayload(input: unknown): string {
  const parsed = canonicalPolicyPayloadSchema.safeParse(input);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.message === "Source roles must be unique.")) {
      throw new Error("Source roles must be unique.");
    }
    throw new Error("Canonical policy payload has a missing, extra, or invalid shape.");
  }
  const sources = parsed.data.sources
    .map((source) => ({ ...source, roles: [...source.roles].sort(rawCodeUnitSort) }))
    .sort((left, right) => rawCodeUnitSort(left.key, right.key));
  return canonicalJson({ ...parsed.data, sources });
}

const canonicalCataloguePayload = {
  version: 1 as const,
  sourcePolicyVersion: australianSourcePolicyVersion,
  sources: australianSourceCatalogue.map(canonicalSource),
};

export const publicSourcePolicyDigest = createHash("sha256")
  .update(`public-source-policy-digest-v1\n${canonicalizePublicSourcePolicyPayload(canonicalCataloguePayload)}`, "utf8")
  .digest("hex");

const activationManifestSchema = z
  .object({
    version: z.literal(1),
    sourcePolicyVersion: z.literal(australianSourcePolicyVersion),
    sourcePolicyDigest: sha256Schema,
    catalogueKey: z.string().trim().min(1).max(100),
    decision: z.enum(["activate", "quarantine", "retire"]),
    operatorId: z.string().uuid(),
    reason: z.string().trim().min(3).max(2_000),
    evidenceReferences: z.array(evidenceReferenceSchema).min(1).max(50),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.sourcePolicyDigest !== publicSourcePolicyDigest) {
      context.addIssue({
        code: "custom",
        message: "Source policy digest does not match the canonical policy.",
        path: ["sourcePolicyDigest"],
      });
    }
    if (new Set(manifest.evidenceReferences).size !== manifest.evidenceReferences.length) {
      context.addIssue({
        code: "custom",
        message: "Evidence references must be unique.",
        path: ["evidenceReferences"],
      });
    }
    if (manifest.decision !== "activate") return;
    const definition = australianSourceByKey(manifest.catalogueKey);
    if (!definition) {
      context.addIssue({ code: "custom", message: "Source is not in the active catalogue.", path: ["catalogueKey"] });
      return;
    }
    try {
      assertIndexableCatalogueEntry(definition);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Source is not eligible for activation.",
        path: ["catalogueKey"],
      });
    }
  });

export type PublicSourceActivationManifestV1 = z.infer<typeof activationManifestSchema>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function parsePublicSourceActivationManifest(input: unknown): PublicSourceActivationManifestV1 {
  return deepFreeze(activationManifestSchema.parse(input));
}

export function createPublicSourceActivationManifest(input: unknown): PublicSourceActivationManifestV1 {
  return parsePublicSourceActivationManifest(input);
}

export function activationManifestDigest(manifest: PublicSourceActivationManifestV1): string {
  return createHash("sha256").update(canonicalJson(manifest), "utf8").digest("hex");
}
