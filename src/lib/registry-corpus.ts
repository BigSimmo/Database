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

function registryCorpusIdentity(entry: RegistryCorpusEntry) {
  return {
    documentId: registryDocumentId(entry),
    metadata: registryEntryMetadata(entry),
  };
}

export function registryCorpusDetailHref(args: {
  kind: unknown;
  slug: unknown;
  subkind?: unknown;
  recordId?: unknown;
}) {
  const kind = typeof args.kind === "string" ? args.kind : null;
  const slug = typeof args.slug === "string" ? args.slug : null;
  const subkind = typeof args.subkind === "string" ? args.subkind : null;
  const recordId = typeof args.recordId === "string" ? args.recordId : null;
  if (!kind || !slug) return null;
  if (kind === "service") return `/services/${slug}`;
  if (kind === "form") return `/forms/${slug}`;
  if (kind === "medication") return `/medications/${slug}`;
  if (kind === "differential") {
    return subkind === "presentation" && recordId
      ? `/differentials/presentations/${recordId}`
      : `/differentials/diagnoses/${slug}`;
  }
  return null;
}

function registryDocumentRow(entry: RegistryCorpusEntry): TablesInsert<"documents"> {
  const { documentId, metadata } = registryCorpusIdentity(entry);
  const detailHref = registryCorpusDetailHref({
    kind: entry.kind,
    slug: entry.slug,
    subkind: entry.subkind,
    recordId: entry.recordId,
  });
  return {
    id: documentId,
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
    metadata: {
      ...metadata,
      registry_detail_href: detailHref,
    },
  };
}

function registryChunkRow(entry: RegistryCorpusEntry, embedding: Vector): TablesInsert<"document_chunks"> {
  const { documentId, metadata } = registryCorpusIdentity(entry);
  return {
    id: deterministicUuid(`registry-chunk:${entry.kind}:${entry.recordId}`),
    document_id: documentId,
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
    metadata,
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
        tags: row.tag ? [row.tag] : [],
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
  const embeddings = await embedTexts(entries.map((entry) => entry.content));
  const documents = entries.map(registryDocumentRow);
  const chunks = entries.map((entry, index) => registryChunkRow(entry, embeddings[index] as Vector));
  const documentIds = documents.map((document) => document.id).filter((id): id is string => Boolean(id));

  const { error: documentError } = await supabase.from("documents").upsert(documents, { onConflict: "id" });
  if (documentError) throw new Error(`Registry corpus document upsert failed: ${documentError.message}`);

  const { error: chunkError } = await supabase.from("document_chunks").upsert(chunks, { onConflict: "id" });
  if (chunkError) {
    if (documentIds.length > 0) {
      await supabase.from("documents").delete().in("id", documentIds);
    }
    throw new Error(`Registry corpus chunk upsert failed: ${chunkError.message}`);
  }

  return { documentCount: documents.length, chunkCount: chunks.length };
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
