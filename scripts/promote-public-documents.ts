import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type PromoteArgs = {
  ownerId?: string;
};

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function parseArgs(argv: string[]): PromoteArgs {
  const args: PromoteArgs = {
    ownerId: process.env.PUBLIC_WORKSPACE_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--owner-id") {
      args.ownerId = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

async function countCandidates(supabase: Awaited<ReturnType<typeof loadAdminClient>>, ownerId?: string) {
  let query = supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "indexed")
    .not("owner_id", "is", null)
    .in("metadata->>clinical_validation_status", ["locally_reviewed", "approved"]);

  if (ownerId) query = query.eq("owner_id", ownerId);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countPublic(supabase: Awaited<ReturnType<typeof loadAdminClient>>) {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "indexed")
    .is("owner_id", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();

  const [candidateCount, publicCount] = await Promise.all([
    countCandidates(supabase, args.ownerId),
    countPublic(supabase),
  ]);

  console.log("[public-documents:promote] indexed public documents:", publicCount);
  console.log(
    `[public-documents:promote] pending promotion${args.ownerId ? ` for owner ${args.ownerId}` : ""}:`,
    candidateCount,
  );
  console.log(
    "Apply migration 20260705220000_promote_locally_reviewed_documents_public.sql with `npx supabase db push --linked`.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
