import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";

loadEnvConfig(process.cwd());

type EnrichArgs = {
  ownerEmail?: string;
  mode: string;
  limit: number;
  documentId?: string;
};

type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): EnrichArgs {
  const args: EnrichArgs = {
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    mode: "summaries-labels-images",
    limit: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--mode") args.mode = value;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--document-id") args.documentId = value;
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be a positive integer.");
  return args;
}

async function findOwnerIdByEmail(supabase: SupabaseAdmin, email: string) {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user?.id) return user.id;
    if (data.users.length < perPage) break;
  }

  throw new Error(`No Supabase Auth user found for ${email}. Sign in once before enriching documents.`);
}

async function loadDocuments(supabase: SupabaseAdmin, args: EnrichArgs, ownerId: string) {
  let query = supabase
    .from("documents")
    .select("id,owner_id,title,file_name,source_path,status,metadata")
    .eq("owner_id", ownerId)
    .eq("status", "indexed")
    .order("created_at", { ascending: true })
    .limit(args.limit);

  if (args.documentId) query = query.eq("id", args.documentId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadEvidence(supabase: SupabaseAdmin, documentId: string) {
  const [chunksResult, imagesResult] = await Promise.all([
    supabase
      .from("document_chunks")
      .select("id,page_number,chunk_index,section_heading,content")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true })
      .limit(24),
    supabase
      .from("document_images")
      .select("id,page_number,caption,image_type,labels")
      .eq("document_id", documentId)
      .eq("searchable", true)
      .order("clinical_relevance_score", { ascending: false })
      .limit(12),
  ]);

  if (chunksResult.error) throw new Error(chunksResult.error.message);
  if (imagesResult.error) throw new Error(imagesResult.error.message);
  return { chunks: chunksResult.data ?? [], images: imagesResult.data ?? [] };
}

function hashBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function classifyExistingImages(supabase: SupabaseAdmin, documentId: string) {
  const [{ env }, { cheapImageSkipReason, classifiedImageSkipReason, lightweightPerceptualHash }, { classifyAndCaptionImageFromBase64 }] =
    await Promise.all([import("@/lib/env"), import("@/lib/image-filtering"), import("@/lib/openai")]);
  const { data: images, error } = await supabase
    .from("document_images")
    .select(
      "id,page_number,storage_path,mime_type,caption,bbox,width,height,source_kind,image_hash,image_type,searchable,clinical_relevance_score,skip_reason",
    )
    .eq("document_id", documentId)
    .order("page_number", { ascending: true });

  if (error) throw new Error(error.message);

  const seenHashes = new Set<string>();
  let searchable = 0;
  let skipped = 0;

  for (const image of images ?? []) {
    if (
      (image.image_type && image.image_type !== "unclear") ||
      image.clinical_relevance_score > 0 ||
      image.skip_reason
    ) {
      if (image.searchable) searchable += 1;
      else skipped += 1;
      continue;
    }

    const download = await supabase.storage.from(env.SUPABASE_IMAGE_BUCKET).download(image.storage_path);
    if (download.error || !download.data) {
      await supabase
        .from("document_images")
        .update({ searchable: false, skip_reason: download.error?.message ?? "image unavailable in storage" })
        .eq("id", image.id);
      skipped += 1;
      continue;
    }

    const bytes = Buffer.from(await download.data.arrayBuffer());
    const imageHash = image.image_hash ?? hashBytes(bytes);
    const perceptualHash = lightweightPerceptualHash(imageHash, image.width, image.height);
    const cheapSkip = cheapImageSkipReason({
      bytesLength: bytes.length,
      imageHash,
      seenHashes,
      image: {
        bbox: image.bbox as [number, number, number, number] | null,
        width: image.width,
        height: image.height,
        sourceKind: image.source_kind as "embedded" | "diagram_crop" | "page_region" | "fallback" | undefined,
      },
    });

    if (cheapSkip) {
      await supabase
        .from("document_images")
        .update({
          searchable: false,
          skip_reason: cheapSkip,
          image_hash: imageHash,
          perceptual_hash: perceptualHash,
          clinical_relevance_score: 0,
        })
        .eq("id", image.id);
      skipped += 1;
      continue;
    }
    seenHashes.add(imageHash);

    const classification = await classifyAndCaptionImageFromBase64({
      base64: bytes.toString("base64"),
      mimeType: image.mime_type,
      nearbyText: image.caption ?? undefined,
    });
    const classifiedSkip = classifiedImageSkipReason(classification);

    await supabase
      .from("document_images")
      .update({
        caption: classification.caption || image.caption,
        image_type: classification.image_type,
        searchable: !classifiedSkip,
        clinical_relevance_score: classifiedSkip ? 0 : classification.clinical_relevance_score,
        skip_reason: classifiedSkip,
        image_hash: imageHash,
        perceptual_hash: perceptualHash,
        labels: classification.labels,
      })
      .eq("id", image.id);

    if (classifiedSkip) skipped += 1;
    else searchable += 1;
  }

  return { searchable, skipped, total: images?.length ?? 0 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ownerEmail) {
    throw new Error('Provide --owner-email "you@example.com" or set RAG_EVAL_OWNER_EMAIL.');
  }
  if (args.mode !== "summaries-labels-images") {
    throw new Error("--mode currently supports summaries-labels-images.");
  }

  const [{ requireOpenAIEnv, requireServerEnv }, { upsertDocumentEnrichment }, supabase] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/document-enrichment"),
    loadAdminClient(),
  ]);
  requireServerEnv();
  requireOpenAIEnv();

  const ownerId = await findOwnerIdByEmail(supabase, args.ownerEmail);
  const documents = await loadDocuments(supabase, args, ownerId);
  console.log(`Enriching ${documents.length} indexed document(s).`);

  let completed = 0;
  for (const document of documents) {
    const imageStats = await classifyExistingImages(supabase, document.id);
    await supabase
      .from("documents")
      .update({
        image_count: imageStats.searchable,
        metadata: {
          ...(document.metadata ?? {}),
          searchable_image_count: imageStats.searchable,
          skipped_image_count: imageStats.skipped,
          image_enriched_at: new Date().toISOString(),
        },
      })
      .eq("id", document.id);

    const evidence = await loadEvidence(supabase, document.id);
    if (evidence.chunks.length === 0) {
      console.log(`SKIP no chunks: ${document.file_name}`);
      continue;
    }

    await upsertDocumentEnrichment({
      supabase,
      document,
      chunks: evidence.chunks,
      images: evidence.images,
    });
    completed += 1;
    console.log(
      `ENRICHED ${document.file_name} chunks=${evidence.chunks.length} images=${imageStats.searchable}/${imageStats.total} skipped=${imageStats.skipped}`,
    );
  }

  console.log(`Enrichment complete. completed=${completed} skipped=${documents.length - completed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
