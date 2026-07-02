/**
 * In-place text-normalization backfill (no re-index, no re-embed).
 *
 * Applies the shared, lossless `normalizeExtractedGlyphs` transform to the stored
 * `document_chunks.content` (and `section_heading`) of already-indexed documents.
 * Only rows whose text actually changes are updated. Embeddings are NEVER
 * recomputed, so vector/semantic retrieval is unchanged by construction; the
 * generated `search_tsv` column refreshes automatically and can only improve.
 *
 * Safety:
 *   - Confirms the Supabase project before writing.
 *   - Dry-run by default; requires BOTH --write and --confirm to mutate.
 *   - Writes a JSON backup of every changed row (id, old content/heading) before
 *     updating, so the change is fully revertible.
 *
 * Usage:
 *   npm run backfill:text-normalization                       # dry-run, all indexed docs
 *   npm run backfill:text-normalization -- --limit 50         # dry-run sample
 *   npm run backfill:text-normalization -- --document-id <id> # single document
 *   npm run backfill:text-normalization -- --write --confirm  # apply (with backup)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type Args = {
  limit: number;
  documentId?: string;
  write: boolean;
  confirm: boolean;
  backup: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 0, write: false, confirm: false, backup: true };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--confirm") {
      args.confirm = true;
      continue;
    }
    if (token === "--no-backup") {
      args.backup = false;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--document-id") args.documentId = value;
  }
  if (args.limit && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }
  return args;
}

type ChunkRow = {
  id: string;
  document_id: string;
  content: string | null;
  section_heading: string | null;
};

type ChangedRow = {
  id: string;
  document_id: string;
  content_changed: boolean;
  heading_changed: boolean;
  old_content: string | null;
  new_content: string | null;
  old_section_heading: string | null;
  new_section_heading: string | null;
};

type SelectResult = Promise<{ data: ChunkRow[] | null; error: { message: string } | null }> & {
  eq: (column: string, value: unknown) => SelectResult;
  order: (column: string, opts: { ascending: boolean }) => SelectResult;
  range: (from: number, to: number) => SelectResult;
};

type AdminClient = {
  from: (table: string) => {
    select: (columns: string) => SelectResult;
    update: (patch: Record<string, string | null>) => {
      eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
};

const PAGE_SIZE = 1000;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const [{ requireServerEnv }, { createAdminClient }, { normalizeExtractedGlyphs }, projectModule] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/supabase/admin"),
    import("@/lib/source-text-sanitizer"),
    import("@/lib/supabase/project"),
  ]);
  requireServerEnv();

  const { checkSupabaseProjectConfig, expectedSupabaseProject, formatSupabaseProjectCheck } = projectModule;
  const projectCheck = checkSupabaseProjectConfig(
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
      SUPABASE_PROJECT_NAME: process.env.SUPABASE_PROJECT_NAME,
    },
    { requireMetadata: false },
  );
  if (projectCheck.status === "missing" || projectCheck.status === "mismatch") {
    console.error(formatSupabaseProjectCheck(projectCheck));
    throw new Error(`Refusing to run: Supabase project is not ${expectedSupabaseProject.name}.`);
  }

  const supabase = createAdminClient() as unknown as AdminClient;

  const writeEnabled = args.write && args.confirm;
  if (args.write && !args.confirm) console.log("WRITE requested without --confirm; staying in dry-run mode.");
  console.log(
    `Text-normalization backfill ${writeEnabled ? "WRITE" : "DRY-RUN"} against ${expectedSupabaseProject.name} (${expectedSupabaseProject.ref})`,
  );

  let changed: ChangedRow[] = [];
  const sampleDiffs: Array<{ id: string; before: string; after: string }> = [];
  let scanned = 0;
  let offset = 0;

  for (;;) {
    let query = supabase
      .from("document_chunks")
      .select("id,document_id,content,section_heading")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (args.documentId) query = query.eq("document_id", args.documentId);

    const { data, error } = (await query) as { data: ChunkRow[] | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const newContent = row.content == null ? row.content : normalizeExtractedGlyphs(row.content);
      const newHeading =
        row.section_heading == null ? row.section_heading : normalizeExtractedGlyphs(row.section_heading);
      const contentChanged = newContent !== row.content;
      const headingChanged = newHeading !== row.section_heading;
      if (!contentChanged && !headingChanged) continue;

      changed.push({
        id: row.id,
        document_id: row.document_id,
        content_changed: contentChanged,
        heading_changed: headingChanged,
        old_content: row.content,
        new_content: newContent,
        old_section_heading: row.section_heading,
        new_section_heading: newHeading,
      });
      if (contentChanged && sampleDiffs.length < 8) {
        sampleDiffs.push({
          id: row.id,
          before: (row.content ?? "").slice(0, 160),
          after: (newContent ?? "").slice(0, 160),
        });
      }
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
    if (args.limit && changed.length >= args.limit) break;
  }

  // --limit bounds the number of rows we will WRITE, not just how far we page.
  if (args.limit && changed.length > args.limit) changed = changed.slice(0, args.limit);

  console.log(
    `Scanned ${scanned} chunks; ${changed.length} would change${args.limit ? ` (capped at --limit ${args.limit})` : ""}.`,
  );
  for (const diff of sampleDiffs) {
    console.log(`\n  chunk ${diff.id}`);
    console.log(`    before: ${JSON.stringify(diff.before)}`);
    console.log(`    after:  ${JSON.stringify(diff.after)}`);
  }

  if (changed.length === 0) {
    console.log("\nNothing to update.");
    return;
  }

  if (!writeEnabled) {
    console.log("\nDRY-RUN complete. Re-run with --write --confirm to apply (a JSON backup is written first).");
    return;
  }

  if (args.backup) {
    const backupDir = resolve(process.cwd(), "output", "backfills");
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = resolve(backupDir, `text-normalization-${stamp}.json`);
    writeFileSync(
      backupPath,
      JSON.stringify(
        changed.map((row) => ({
          id: row.id,
          document_id: row.document_id,
          old_content: row.old_content,
          old_section_heading: row.old_section_heading,
        })),
        null,
        2,
      ),
      "utf8",
    );
    console.log(`\nBackup of ${changed.length} rows written to ${backupPath}`);
  }

  let updated = 0;
  for (const row of changed) {
    const patch: Record<string, string | null> = {};
    if (row.content_changed) patch.content = row.new_content;
    if (row.heading_changed) patch.section_heading = row.new_section_heading;
    const { error } = (await supabase.from("document_chunks").update(patch).eq("id", row.id)) as {
      error: { message: string } | null;
    };
    if (error) throw new Error(`Update failed for chunk ${row.id}: ${error.message}`);
    updated += 1;
    if (updated % 250 === 0) console.log(`  updated ${updated}/${changed.length}`);
  }

  console.log(`\nDone. Updated ${updated} chunks in place (no embeddings changed).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
