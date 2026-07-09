import { createHash } from "node:crypto";

import { diagnosisFullText, presentationFullText } from "@/lib/differentials";
import type { DifferentialPresentationWorkflow, DifferentialRecord } from "@/lib/differential-snapshot";
import {
  rowToDifferentialRecord,
  rowToPresentationWorkflow,
  type DifferentialRecordRow,
} from "@/lib/differential-records";
import { env } from "@/lib/env";
import { formRecordSearchText } from "@/lib/forms";
import { rowToMedicationRecord, type MedicationRecordRow } from "@/lib/medication-records";
import { rowToServiceRecord, type RegistryRecordKind, type RegistryRecordRow } from "@/lib/registry-records";
import { serviceRecordSearchText } from "@/lib/services";
import type { Json, TablesInsert, Vector } from "@/lib/supabase/database.types";

export type RegistryCorpusKind = "service" | "form" | "medication" | "differential";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

type RegistryCorpusEntry = {
  kind: RegistryCorpusKind;
  subkind: string | null;
  ownerId: string;
  recordId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: string;
  searchText: string;
  sourceStatus: string;
  validationStatus: string;
  metadata: Record<string, Json>;
};

export type RegistryCorpusEmbedResult = {
  documentCount: number;
  chunkCount: number;
  skipped?: boolean;
  reason?: "disabled" | "not_found" | "failed";
  errorMessage?: string;
};

export type RegistryCorpusEditTarget =
  | { corpusKind: "service" | "form"; ownerId: string; slug: string }
  | { corpusKind: "medication"; ownerId: string; slug: string }
  | { corpusKind: "differential"; ownerId: string; slug: string; differentialKind?: DifferentialRecordRow["kind"] };

const REGISTRY_EMBEDDING_WRITE_BATCH_SIZE = 64;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(seed: string) {
  const hex = sha256(seed).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function compactText(parts: unknown[], limit = 8000) {
  const text = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) =>
      String(part ?? "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
  return text.length <= limit ? text : `${text.slice(0, limit - 3).trim()}...`;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function registryBaseMetadata(entry: RegistryCorpusEntry): Record<string, Json> {
  return {
    source_kind: "registry_record",
    registry_record_kind: entry.kind,
    registry_record_subkind: entry.subkind,
    registry_record_id: entry.recordId,
    registry_record_slug: entry.slug,
    source_title: entry.title,
    document_status: entry.sourceStatus,
    clinical_validation_status: entry.validationStatus,
    extraction_quality: "good",
    publisher: "Clinical KB registry",
    jurisdiction: "WA/local clinical workspace",
  };
}

function registryDocumentId(entry: RegistryCorpusEntry) {
  return deterministicUuid(`registry-document:${entry.kind}:${entry.recordId}`);
}

function registryEntryMetadata(entry: RegistryCorpusEntry): Record<string, Json> {
  return { ...registryBaseMetadata(entry), ...entry.metadata };
}

function registryDocumentRow(entry: RegistryCorpusEntry): TablesInsert<"documents"> {
  return {
    id: registryDocumentId(entry),
    owner_id: entry.ownerId,
    title: entry.title,
    description: entry.subtitle,
    file_name: `${entry.kind}-${entry.slug}.registry.json`,
    file_type: "application/vnd.clinical-kb.registry+json",
    file_size: Buffer.byteLength(entry.content, "utf8"),
    storage_path: `registry://${entry.kind}/${entry.recordId}`,
    source_path: `registry://${entry.kind}/${entry.slug}`,
    status: "indexed",
    page_count: 1,
    chunk_count: 1,
    image_count: 0,
    content_hash: sha256(entry.content),
    metadata: registryEntryMetadata(entry),
  };
}

function registryChunkRow(entry: RegistryCorpusEntry, embedding: Vector): TablesInsert<"document_chunks"> {
  return {
    id: deterministicUuid(`registry-chunk:${entry.kind}:${entry.recordId}`),
    document_id: registryDocumentId(entry),
    chunk_index: 0,
    page_number: 1,
    section_heading: "Registry summary",
    section_path: ["Registry summary"],
    content: entry.content,
    retrieval_synopsis: entry.subtitle,
    token_estimate: Math.ceil(entry.content.length / 4),
    image_ids: [],
    content_hash: sha256(entry.content),
    embedding,
    metadata: registryEntryMetadata(entry),
  };
}

export function registryCorpusEmbeddingEnabled() {
  return env.RAG_REGISTRY_CORPUS_EMBEDDING === true;
}

export function clinicalRegistryRowsToCorpusEntries(rows: RegistryRecordRow[]): RegistryCorpusEntry[] {
  return rows.map((row) => {
    const kind: RegistryRecordKind = row.kind === "form" ? "form" : "service";
    const record = rowToServiceRecord(row);
    const searchText = kind === "form" ? formRecordSearchText(record) : serviceRecordSearchText(record);
    const content = compactText([
      `${kind === "form" ? "Form" : "Service"}: ${record.title}`,
      record.subtitle,
      record.route && `Route: ${record.route}`,
      record.eligibility && `Eligibility: ${record.eligibility}`,
      record.referral && `Referral: ${record.referral}`,
      record.location && `Location: ${record.location}`,
      record.bestUse && `Best use: ${record.bestUse}`,
      record.primaryContact && `Primary contact: ${record.primaryContact.value} ${record.primaryContact.detail ?? ""}`,
      record.tags?.length ? `Tags: ${record.tags.join(", ")}` : null,
      record.catchments?.length ? `Catchments: ${record.catchments.join(", ")}` : null,
      searchText,
    ]);
    return {
      kind,
      subkind: kind,
      ownerId: row.owner_id,
      recordId: row.id,
      slug: row.slug,
      title: record.title,
      subtitle: record.subtitle ?? null,
      content,
      searchText,
      sourceStatus: row.source_status,
      validationStatus: row.validation_status,
      metadata: {
        catalogue_label: row.catalogue_label,
        tags: row.tags,
        catchments: row.catchments,
      },
    };
  });
}

export function medicationRowsToCorpusEntries(rows: MedicationRecordRow[]): RegistryCorpusEntry[] {
  return rows.map((row) => {
    const record = rowToMedicationRecord(row);
    const sectionText = Array.isArray(record.sections)
      ? record.sections
          .flatMap((section) => [
            section.title,
            section.type,
            ...(section.rows ?? []).flatMap((item) => [item.key, item.val]),
          ])
          .join(" ")
      : "";
    const quickText = Array.isArray(record.quick)
      ? record.quick.flatMap((item) => [item.label, item.value]).join(" ")
      : "";
    const searchText = compactText(
      [record.name, record.slug, record.class, record.subclass, record.category, sectionText, quickText],
      4000,
    );
    return {
      kind: "medication",
      subkind: record.category || record.class || null,
      ownerId: row.owner_id,
      recordId: row.id,
      slug: row.slug,
      title: record.name,
      subtitle: record.class || row.category,
      content: compactText([
        `Medication: ${record.name}`,
        record.class && `Class: ${record.class}`,
        record.subclass && `Subclass: ${record.subclass}`,
        record.schedule && `Schedule: ${record.schedule}`,
        record.tag && `Tag: ${record.tag}`,
        sectionText,
        quickText,
      ]),
      searchText,
      sourceStatus: row.source_status,
      validationStatus: row.validation_status,
      metadata: {
        medication_class: row.class,
        medication_subclass: row.subclass,
        tags: stringArray(row.tag),
      },
    };
  });
}

export function differentialRowsToCorpusEntries(rows: DifferentialRecordRow[]): RegistryCorpusEntry[] {
  return rows.map((row) => {
    const isPresentation = row.kind === "presentation";
    const payload = isPresentation ? rowToPresentationWorkflow(row) : rowToDifferentialRecord(row);
    const searchText = isPresentation
      ? presentationFullText(payload as DifferentialPresentationWorkflow)
      : diagnosisFullText(payload as DifferentialRecord);
    return {
      kind: "differential",
      subkind: isPresentation ? "presentation" : "diagnosis",
      ownerId: row.owner_id,
      recordId: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      content: compactText([
        `${isPresentation ? "Presentation workflow" : "Differential diagnosis"}: ${row.title}`,
        row.subtitle,
        row.clinical_hinge && `Clinical hinge: ${row.clinical_hinge}`,
        row.tags.length ? `Tags: ${row.tags.join(", ")}` : null,
        searchText,
      ]),
      searchText,
      sourceStatus: row.source_status,
      validationStatus: row.validation_status,
      metadata: {
        differential_kind: row.kind,
        status: row.status,
        tags: row.tags,
      },
    };
  });
}

export async function embedRegistryCorpusEntries(supabase: AdminClient, entries: RegistryCorpusEntry[]) {
  if (entries.length === 0) return { documentCount: 0, chunkCount: 0 };

  const { embedTexts } = await import("@/lib/openai");
  let documentCount = 0;
  let chunkCount = 0;

  for (let start = 0; start < entries.length; start += REGISTRY_EMBEDDING_WRITE_BATCH_SIZE) {
    const batch = entries.slice(start, start + REGISTRY_EMBEDDING_WRITE_BATCH_SIZE);
    const embeddings = await embedTexts(batch.map((entry) => entry.content));
    const documents = batch.map(registryDocumentRow);
    const chunks = batch.map((entry, index) => registryChunkRow(entry, embeddings[index] as Vector));

    const { error: documentError } = await supabase.from("documents").upsert(documents, { onConflict: "id" });
    if (documentError) throw new Error(`Registry corpus document upsert failed: ${documentError.message}`);

    const { error: chunkError } = await supabase.from("document_chunks").upsert(chunks, { onConflict: "id" });
    if (chunkError) throw new Error(`Registry corpus chunk upsert failed: ${chunkError.message}`);

    documentCount += documents.length;
    chunkCount += chunks.length;
  }

  return { documentCount, chunkCount };
}

export function embedClinicalRegistryRows(supabase: AdminClient, rows: RegistryRecordRow[]) {
  return embedRegistryCorpusEntries(supabase, clinicalRegistryRowsToCorpusEntries(rows));
}

export function embedMedicationRows(supabase: AdminClient, rows: MedicationRecordRow[]) {
  return embedRegistryCorpusEntries(supabase, medicationRowsToCorpusEntries(rows));
}

export function embedDifferentialRows(supabase: AdminClient, rows: DifferentialRecordRow[]) {
  return embedRegistryCorpusEntries(supabase, differentialRowsToCorpusEntries(rows));
}

/** Best-effort corpus embedding for a seed path: failures are logged, not thrown,
 *  so a broken embedding call never blocks the seed write it runs after. */
export async function bestEffortEmbedRows(args: {
  scope: string;
  ownerId: string;
  detail?: string;
  embed: () => Promise<unknown>;
}) {
  if (!registryCorpusEmbeddingEnabled()) return;
  try {
    await args.embed();
  } catch (embedError) {
    const suffix = args.detail ? ` ${args.detail}` : "";
    console.error(`[${args.scope}] corpus embedding failed for owner ${args.ownerId}${suffix}`, embedError);
  }
}

/** Reload an owner's rows for a table and embed them, returning the chunk count
 *  written. Shared by the registry/medication/differential seed CLIs, which each
 *  re-read their own rows (rather than reusing the upsert response) so the
 *  embedded corpus always reflects what is actually stored. */
export async function embedReloadedOwnerRows<Row>(
  reload: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  embed: (rows: Row[]) => Promise<{ chunkCount: number }>,
  tableLabel: string,
) {
  const { data, error } = await reload;
  if (error) throw new Error(`Could not reload ${tableLabel} rows for embedding: ${error.message}`);
  const { chunkCount } = await embed(data ?? []);
  return chunkCount;
}

function skippedRegistryEmbedResult(reason: RegistryCorpusEmbedResult["reason"]): RegistryCorpusEmbedResult {
  return { documentCount: 0, chunkCount: 0, skipped: true, reason };
}

export async function reembedClinicalRegistryRecordBySlug(
  supabase: AdminClient,
  args: { ownerId: string; slug: string; kind?: RegistryRecordKind },
): Promise<RegistryCorpusEmbedResult> {
  if (!registryCorpusEmbeddingEnabled()) return skippedRegistryEmbedResult("disabled");

  let query = supabase.from("clinical_registry_records").select("*").eq("owner_id", args.ownerId).eq("slug", args.slug);
  if (args.kind) query = query.eq("kind", args.kind);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load registry record for re-embedding: ${error.message}`);
  if (!data) return skippedRegistryEmbedResult("not_found");

  return embedClinicalRegistryRows(supabase, [data as RegistryRecordRow]);
}

export async function reembedMedicationRecordBySlug(
  supabase: AdminClient,
  args: { ownerId: string; slug: string },
): Promise<RegistryCorpusEmbedResult> {
  if (!registryCorpusEmbeddingEnabled()) return skippedRegistryEmbedResult("disabled");

  const { data, error } = await supabase
    .from("medication_records")
    .select("*")
    .eq("owner_id", args.ownerId)
    .eq("slug", args.slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load medication record for re-embedding: ${error.message}`);
  if (!data) return skippedRegistryEmbedResult("not_found");

  return embedMedicationRows(supabase, [data as MedicationRecordRow]);
}

export async function reembedDifferentialRecordBySlug(
  supabase: AdminClient,
  args: { ownerId: string; slug: string; kind?: DifferentialRecordRow["kind"] },
): Promise<RegistryCorpusEmbedResult> {
  if (!registryCorpusEmbeddingEnabled()) return skippedRegistryEmbedResult("disabled");

  let query = supabase.from("differential_records").select("*").eq("owner_id", args.ownerId).eq("slug", args.slug);
  if (args.kind) query = query.eq("kind", args.kind);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load differential record for re-embedding: ${error.message}`);
  if (!data) return skippedRegistryEmbedResult("not_found");

  return embedDifferentialRows(supabase, [data as DifferentialRecordRow]);
}

export function reembedRegistryRecordAfterEdit(
  supabase: AdminClient,
  target: RegistryCorpusEditTarget,
): Promise<RegistryCorpusEmbedResult> {
  if (target.corpusKind === "medication") {
    return reembedMedicationRecordBySlug(supabase, { ownerId: target.ownerId, slug: target.slug });
  }

  if (target.corpusKind === "differential") {
    return reembedDifferentialRecordBySlug(supabase, {
      ownerId: target.ownerId,
      slug: target.slug,
      kind: target.differentialKind,
    });
  }

  return reembedClinicalRegistryRecordBySlug(supabase, {
    ownerId: target.ownerId,
    slug: target.slug,
    kind: target.corpusKind,
  });
}

export async function bestEffortReembedRegistryRecordAfterEdit(args: {
  supabase: AdminClient;
  target: RegistryCorpusEditTarget;
  scope: string;
}) {
  if (!registryCorpusEmbeddingEnabled()) return skippedRegistryEmbedResult("disabled");

  try {
    return await reembedRegistryRecordAfterEdit(args.supabase, args.target);
  } catch (embedError) {
    const errorMessage = embedError instanceof Error ? embedError.message : String(embedError);
    console.error(
      `[${args.scope}] corpus re-embedding failed after registry edit for ${args.target.ownerId}/${args.target.corpusKind}/${args.target.slug}`,
      embedError,
    );
    return { documentCount: 0, chunkCount: 0, skipped: true, reason: "failed", errorMessage } satisfies RegistryCorpusEmbedResult;
  }
}
