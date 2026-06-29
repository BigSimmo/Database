import * as nextEnv from "@next/env";

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

if (!loadEnvConfig) throw new Error("Unable to load @next/env loadEnvConfig.");
loadEnvConfig(process.cwd());

type ClassifyArgs = {
  allOwners: boolean;
  ownerId?: string;
  documentId?: string;
  limit: number;
  offset: number;
  write: boolean;
  confirm: boolean;
  help: boolean;
};

type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;
type DocumentRow = {
  id: string;
  owner_id: string | null;
  title: string;
  file_name: string;
  source_path: string | null;
  status: string;
  metadata: unknown;
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): ClassifyArgs {
  const args: ClassifyArgs = {
    allOwners: false,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    limit: 100,
    offset: 0,
    write: false,
    confirm: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--all-owners") {
      args.allOwners = true;
      continue;
    }
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--confirm") {
      args.confirm = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;
    if (token === "--owner-id") args.ownerId = value;
    else if (token === "--document-id") args.documentId = value;
    else if (token === "--limit") args.limit = Number(value);
    else if (token === "--offset") args.offset = Number(value);
    else throw new Error(`Unknown option: ${token}`);
  }

  if (args.help) return args;
  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be a positive integer.");
  if (!Number.isInteger(args.offset) || args.offset < 0) throw new Error("--offset must be a non-negative integer.");
  if (!args.allOwners && !args.ownerId && !args.documentId) {
    throw new Error("Pass --owner-id, --document-id, or --all-owners. Dry-run is still the default.");
  }
  if (args.write && !args.confirm) throw new Error("Writing requires --write --confirm after reviewing a dry-run.");
  return args;
}

function usage() {
  return [
    "Usage: npm run classify:documents -- [scope] [options]",
    "",
    "Scopes:",
    "  --owner-id <uuid>       Classify indexed documents for one owner.",
    "  --document-id <uuid>    Classify one indexed document.",
    "  --all-owners           Classify across all owners.",
    "",
    "Options:",
    "  --limit <count>        Batch size for scoped runs. Default: 100.",
    "  --offset <count>       Skip this many indexed documents before the batch. Default: 0.",
    "  --write --confirm      Persist reviewed classifications. Dry-run is the default.",
    "  --help, -h             Show this help.",
  ].join("\n");
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

async function loadDocuments(supabase: SupabaseAdmin, args: ClassifyArgs) {
  let query = supabase
    .from("documents")
    .select("id,owner_id,title,file_name,source_path,status,metadata")
    .eq("status", "indexed")
    .order("id", { ascending: true })
    .range(args.documentId ? 0 : args.offset, args.documentId ? 0 : args.offset + args.limit - 1);

  if (args.documentId) query = query.eq("id", args.documentId);
  if (!args.allOwners && args.ownerId) query = query.eq("owner_id", args.ownerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

async function loadEvidenceText(supabase: SupabaseAdmin, documentId: string) {
  const [{ data: chunks, error: chunkError }, { data: summary, error: summaryError }] = await Promise.all([
    supabase
      .from("document_chunks")
      .select("content,chunk_index")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true })
      .limit(80),
    supabase.from("document_summaries").select("summary").eq("document_id", documentId).maybeSingle(),
  ]);
  if (chunkError) throw new Error(chunkError.message);
  if (summaryError) throw new Error(summaryError.message);
  return {
    contentText: (chunks ?? []).map((chunk) => String(chunk.content ?? "")).join("\n\n"),
    summaryText: typeof summary?.summary === "string" ? summary.summary : "",
  };
}

async function writeClassification(
  supabase: SupabaseAdmin,
  document: DocumentRow,
  classification: Awaited<ReturnType<typeof classifyDocument>>,
) {
  const stampedAt = new Date().toISOString();
  const metadata = {
    ...metadataRecord(document.metadata),
    ...classification.metadata,
    organization_profile_updated_at: stampedAt,
    organization_profile_updated_by: "classify-documents",
  };

  const { error: documentError } = await supabase
    .from("documents")
    .update({ metadata })
    .eq("id", document.id)
    .eq("status", "indexed");
  if (documentError) throw new Error(documentError.message);

  // Delete all previously generated labels for this document (all types)
  const { error: deleteError } = await supabase
    .from("document_labels")
    .delete()
    .eq("document_id", document.id)
    .eq("source", "generated")
    .in("label_type", ["site", "document_type", "population", "topic", "setting", "service", "workflow", "medication"]);
  if (deleteError) throw new Error(deleteError.message);

  // Write site labels (confident only, >= 0.75)
  const siteLabels = classification.labels.filter((label) => label.label_type === "site" && label.confidence >= 0.75);

  // Write document_type labels (any confidence >= 0.5 — so even needs_review types are captured)
  const typeLabels = classification.labels.filter(
    (label) => label.label_type === "document_type" && label.confidence >= 0.5,
  );

  // Write all secondary facet labels (population, topic, setting, service, workflow, medication)
  const secondaryLabels = classification.labels.filter(
    (label) =>
      ["population", "topic", "setting", "service", "workflow", "medication"].includes(label.label_type) && label.confidence >= 0.5,
  );

  const generatedLabels = [...siteLabels, ...typeLabels, ...secondaryLabels];
  if (!generatedLabels.length) return;

  const { error: labelError } = await supabase.from("document_labels").upsert(
    generatedLabels.map((label) => ({
      document_id: document.id,
      owner_id: document.owner_id,
      label: label.label,
      label_type: label.label_type,
      confidence: label.confidence,
      source: "generated",
      metadata: {
        generated_by: "document-organization-classifier",
        organization_profile_version: "document-organization-v1",
        classified_at: stampedAt,
      },
    })),
    { onConflict: "document_id,label_type,label,source" },
  );
  if (labelError) throw new Error(labelError.message);
}

async function classifyDocument(supabase: SupabaseAdmin, document: DocumentRow) {
  const [{ classifyDocumentOrganization }, evidence] = await Promise.all([
    import("@/lib/document-organization"),
    loadEvidenceText(supabase, document.id),
  ]);
  return classifyDocumentOrganization({
    title: document.title,
    file_name: document.file_name,
    source_path: document.source_path,
    metadata: document.metadata,
    contentText: evidence.contentText,
    summaryText: evidence.summaryText,
  });
}

function printPlan(
  plans: Array<{ document: DocumentRow; classification: Awaited<ReturnType<typeof classifyDocument>> }>,
  write: boolean,
) {
  const confident = plans.filter((plan) => plan.classification.profile.review_status === "confident").length;
  const needsReview = plans.filter((plan) => plan.classification.profile.review_status === "needs_review").length;
  const withSite = plans.filter((plan) => plan.classification.profile.site.label).length;

  console.log(`${write ? "WRITE" : "DRY-RUN"} document organization classification`);
  console.log(`documents scanned: ${plans.length}`);
  console.log(`confident profiles: ${confident}`);
  console.log(`needs review: ${needsReview}`);
  console.log(`assigned site labels: ${withSite}`);
  console.log("");

  for (const plan of plans.slice(0, 25)) {
    const profile = plan.classification.profile;
    const site =
      profile.site.label ?? (profile.site.candidates.map((candidate) => candidate.label).join(", ") || "none");
    console.log(`- ${plan.document.title}`);
    console.log(`  display: ${profile.canonical_display_title}`);
    console.log(`  site: ${site}; type: ${profile.document_type.label}; review: ${profile.review_status}`);
    if (profile.raw_bracket_tags.length) console.log(`  bracket tags: ${profile.raw_bracket_tags.join(", ")}`);
  }
  if (!write) console.log("\nNo writes performed. Re-run with --write --confirm after reviewing this output.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const supabase = await loadAdminClient();
  const documents = await loadDocuments(supabase, args);
  const plans = [];

  for (const document of documents) {
    plans.push({ document, classification: await classifyDocument(supabase, document) });
  }

  printPlan(plans, args.write);
  if (!args.write) return;

  for (const plan of plans) {
    await writeClassification(supabase, plan.document, plan.classification);
  }
  console.log(`\nUpdated ${plans.length} document organization profile(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
