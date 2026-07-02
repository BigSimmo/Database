import { loadEnvConfig } from "@next/env";
import { findOwnerIdByEmail, loadAdminClient } from "./eval-utils";

loadEnvConfig(process.cwd());

type PurgeArgs = {
  ownerEmail?: string;
  olderThanDays: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): PurgeArgs {
  const args: PurgeArgs = {
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    olderThanDays: 90,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--owner-email") args.ownerEmail = value;
    else if (token === "--older-than-days") args.olderThanDays = Number.parseInt(value, 10);
    // Audit L1: fail loudly on unknown flags. A typo'd flag used to silently
    // swallow its value (e.g. --owner-emial ate the email), and the purge then
    // ran against the env-configured owner instead of the intended one.
    else throw new Error(`Unknown argument ${token}`);
  }

  if (!args.ownerEmail) throw new Error("Provide --owner-email.");
  if (!Number.isInteger(args.olderThanDays) || args.olderThanDays <= 0) {
    throw new Error("--older-than-days must be a positive integer.");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();
  const ownerId = await findOwnerIdByEmail(supabase, args.ownerEmail!);
  const before = new Date(Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const countQuery = supabase
    .from("rag_queries")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .lt("created_at", before);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  console.log(`RAG query logs older than ${args.olderThanDays} day(s): ${count ?? 0}`);
  if (args.dryRun || !count) return;

  const { error: deleteError } = await supabase
    .from("rag_queries")
    .delete()
    .eq("owner_id", ownerId)
    .lt("created_at", before);
  if (deleteError) throw new Error(deleteError.message);
  console.log(`Deleted ${count} old RAG query log(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
