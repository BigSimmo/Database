import { loadEnvConfig } from "@next/env";
import { confirm } from "./cli-utils";
import { committedIndexGeneration, metadataRecord } from "@/lib/reindex-pipeline";

loadEnvConfig(process.cwd());

type Args = {
  documentId: string | null;
  ownerId: string | null;
  allOwners: boolean;
  limit: number;
  write: boolean;
  confirm: boolean;
};

type DocumentRow = {
  id: string;
  title: string | null;
  file_name: string | null;
  metadata: unknown;
};

type ImageRow = {
  id: string;
  index_generation_id: string | null;
  metadata: unknown;
};

type ImagePatch = {
  imageId: string;
  indexGenerationId: string;
  metadata: Record<string, unknown>;
};

type UntypedTable = {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      order(
        column: string,
        options: { ascending: boolean },
      ): {
        range(from: number, to: number): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): Promise<{ error: { message: string } | null }>;
  };
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function untypedTable(supabase: Awaited<ReturnType<typeof loadAdminClient>>, table: string): UntypedTable {
  return supabase.from(table as never) as unknown as UntypedTable;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    documentId: null,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID ?? null,
    allOwners: false,
    limit: 25,
    write: false,
    confirm: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--all-owners") {
      args.allOwners = true;
      args.ownerId = null;
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

    if (token !== "--document-id" && token !== "--owner-id" && token !== "--limit") {
      throw new Error(`Unknown argument: ${token}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    if (token === "--document-id") args.documentId = value;
    else if (token === "--owner-id") args.ownerId = value;
    else args.limit = Number.parseInt(value, 10);
    index += 1;
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }
  if (!args.documentId && !args.ownerId && !args.allOwners) {
    throw new Error("Provide --document-id, --owner-id, or --all-owners.");
  }
  return args;
}

function rowNeedsRefresh(row: ImageRow, committedGeneration: string) {
  if (row.index_generation_id === null) return true;
  if (row.index_generation_id !== committedGeneration) return true;
  return committedIndexGeneration(row.metadata) !== committedGeneration;
}

async function loadDocuments(args: {
  supabase: Awaited<ReturnType<typeof loadAdminClient>>;
  ownerId: string | null;
  documentId: string | null;
  allOwners: boolean;
  limit: number;
}) {
  let query = args.supabase
    .from("documents")
    .select("id,title,file_name,metadata")
    .eq("status", "indexed")
    .order("created_at", {
      ascending: false,
    });

  if (args.documentId) query = query.eq("id", args.documentId);
  if (args.ownerId) query = query.eq("owner_id", args.ownerId);
  if (!args.allOwners && !args.ownerId && !args.documentId) return [];

  const { data, error } = await query.limit(args.limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

async function loadImages(args: { supabase: Awaited<ReturnType<typeof loadAdminClient>>; documentId: string }) {
  const rows: ImageRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await untypedTable(args.supabase, "document_images")
      .select("id,index_generation_id,metadata")
      .eq("document_id", args.documentId)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as ImageRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function main() {
  const { requireServerEnv } = await import("@/lib/env");
  const { assertSupabaseHealthy, probeSupabaseHealth } = await import("@/lib/supabase/health");
  const { checkSupabaseProjectConfig, formatSupabaseProjectCheck } = await import("@/lib/supabase/project");
  const args = parseArgs(process.argv.slice(2));
  requireServerEnv();

  const projectCheck = checkSupabaseProjectConfig(
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
      SUPABASE_PROJECT_NAME: process.env.SUPABASE_PROJECT_NAME,
    },
    { requireMetadata: true },
  );
  if (projectCheck.status === "mismatch") {
    throw new Error(`Supabase project mismatch: ${formatSupabaseProjectCheck(projectCheck)}`);
  }
  if (projectCheck.warnings.length > 0) {
    console.log(`Supabase project warning: ${projectCheck.warnings.join(" ; ")}`);
  }

  const supabase = await loadAdminClient();
  console.log(`Target project: ${projectCheck.expected.name} (${projectCheck.expected.ref})`);
  assertSupabaseHealthy(await probeSupabaseHealth(supabase), "Re-stamp document image generation");

  const documents = await loadDocuments({
    supabase,
    ownerId: args.ownerId,
    documentId: args.documentId,
    allOwners: args.allOwners,
    limit: args.limit,
  });

  if (documents.length === 0) {
    console.log("No indexed documents matched the target filter.");
    return;
  }

  const label = args.allOwners
    ? "all owners"
    : args.documentId
      ? `document ${args.documentId}`
      : `owner ${args.ownerId}`;
  console.log(`Loaded ${documents.length} indexed document(s) for ${label} inspection.`);

  const patches: ImagePatch[] = [];
  let inspectedImageCount = 0;
  let documentsWithCandidates = 0;

  for (const document of documents) {
    const committedGeneration = committedIndexGeneration(document.metadata);
    if (!committedGeneration) {
      console.log(
        `SKIP ${document.title ?? document.file_name ?? document.id}: missing index_generation_id in documents.metadata`,
      );
      continue;
    }

    const images = await loadImages({ supabase, documentId: document.id });
    const staleRows = images.filter((image) => rowNeedsRefresh(image, committedGeneration));
    inspectedImageCount += images.length;

    if (staleRows.length === 0) {
      console.log(`OK   ${document.title ?? document.file_name ?? document.id}: ${images.length} image rows aligned`);
      continue;
    }

    documentsWithCandidates += 1;
    console.log(
      `MISMATCH ${document.title ?? document.file_name ?? document.id}: ${staleRows.length}/${images.length} image rows need re-stamp`,
    );
    for (const row of staleRows) {
      patches.push({
        imageId: row.id,
        indexGenerationId: committedGeneration,
        metadata: { ...metadataRecord(row.metadata), index_generation_id: committedGeneration },
      });
    }
  }

  if (patches.length === 0) {
    console.log(`\nNo stale image generation metadata found. Images inspected: ${inspectedImageCount}.`);
    return;
  }

  console.log(`\nStale rows found: ${patches.length} image rows across ${documentsWithCandidates} documents.`);
  if (!args.write) {
    console.log("Dry run complete. Run with --write --confirm to apply changes.");
    return;
  }

  const approved = args.confirm || (await confirm(`Apply re-stamp to ${patches.length} image rows?`));
  if (!approved) {
    console.log("Operation cancelled. No rows updated.");
    return;
  }

  for (let start = 0; start < patches.length; start += 8) {
    const batch = patches.slice(start, start + 8);
    await Promise.all(
      batch.map(async (patch) => {
        const { error } = await untypedTable(supabase, "document_images")
          .update({
            index_generation_id: patch.indexGenerationId,
            metadata: patch.metadata,
          })
          .eq("id", patch.imageId);
        if (error) throw new Error(`Failed to re-stamp image row ${patch.imageId}: ${error.message}`);
      }),
    );
  }

  console.log(`Completed re-stamp. Updated ${patches.length} image rows across ${documentsWithCandidates} documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
