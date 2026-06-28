import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { findOwnerIdByEmail, loadAdminClient } from "./eval-utils";

loadEnvConfig(process.cwd());

const defaultRpcs = [
  "match_documents_for_query",
  "match_document_chunks_text",
  "match_document_lookup_chunks_text",
  "match_document_table_facts_text",
];

type Args = {
  query: string;
  ownerEmail?: string;
  ownerId?: string;
  documentIds?: string[];
  matchCount: number;
  analyze: boolean;
  output?: string;
  rpcs: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    query: "patient safety plan",
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    matchCount: 24,
    analyze: false,
    rpcs: defaultRpcs,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    if (token === "--analyze") {
      args.analyze = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--query") args.query = value;
    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--owner-id") args.ownerId = value;
    if (token === "--match-count") args.matchCount = Number.parseInt(value, 10);
    if (token === "--document-ids")
      args.documentIds = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    if (token === "--rpc")
      args.rpcs = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    if (token === "--output") args.output = value;
  }

  if (!Number.isInteger(args.matchCount) || args.matchCount <= 0) {
    throw new Error("--match-count must be a positive integer.");
  }
  if (!args.rpcs.length) throw new Error("--rpc must include at least one RPC name.");
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = await loadAdminClient();
  const ownerId = args.ownerId ?? (args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined);
  const results: Record<string, unknown> = {};

  for (const rpcName of args.rpcs) {
    const { data, error } = await supabase.rpc("explain_retrieval_rpc", {
      p_rpc: rpcName,
      p_query_text: args.query,
      p_match_count: args.matchCount,
      p_owner_filter: ownerId ?? null,
      p_document_filters: args.documentIds ?? null,
      p_analyze: args.analyze,
    });
    if (error) {
      results[rpcName] = { error: error.message };
      continue;
    }
    results[rpcName] = data;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    query: args.query,
    owner_id: ownerId ?? null,
    document_ids: args.documentIds ?? null,
    match_count: args.matchCount,
    analyze: args.analyze,
    results,
  };
  const json = JSON.stringify(payload, null, 2);
  if (args.output) {
    const outputPath =
      args.output.includes("\\") || args.output.includes("/") ? args.output : join(process.cwd(), args.output);
    await writeFile(outputPath, json, "utf8");
    console.log(`Retrieval RPC profile written to ${outputPath}`);
  } else {
    console.log(json);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
