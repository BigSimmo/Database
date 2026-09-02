/**
 * Argument parsing for `npm run enrich:documents` (scripts/enrich-documents.ts), kept
 * separate so its guard semantics are unit-testable without loading the admin client.
 *
 * Guard semantics, matching the sibling backfill scripts (backfill-smart-index,
 * classify-documents, backfill-text-normalization):
 *   - dry-run is the default; nothing is written and no OpenAI call is made without `--write`;
 *   - `--all-owners` is the only way to cross owners — an absent owner is a refusal, never a
 *     silent widening to every owner on the configured project.
 */
export type EnrichArgs = {
  ownerEmail?: string;
  ownerId?: string;
  allOwners: boolean;
  mode: string;
  limit: number;
  documentId?: string;
  includeCurrent: boolean;
  document?: string;
  write: boolean;
};

export const ENRICH_MODES = ["summaries-labels-images", "metadata-stamp", "deep-memory"] as const;

export const ENRICH_USAGE = [
  "Usage: npm run enrich:documents -- [options]",
  "",
  "Dry-run by default: lists the documents that would be enriched and exits without writing",
  "or calling OpenAI. The target Supabase project is checked before any client is created.",
  "",
  "  --write                  Persist enrichment (writes document/image rows, calls OpenAI).",
  "  --owner-id <uuid>        Scope to one owner (default: RAG_EVAL_OWNER_ID / LOCAL_NO_AUTH_OWNER_ID).",
  "  --owner-email <email>    Scope to one owner by email (default: RAG_EVAL_OWNER_EMAIL).",
  "  --all-owners             Explicitly cross every owner on the project. Never implied.",
  `  --mode <mode>            ${ENRICH_MODES.join(" | ")} (default: summaries-labels-images).`,
  "  --limit <n>              Maximum documents per run (default: 25).",
  "  --document-id <uuid>     Enrich a single document by id.",
  "  --document <text>        Match a document by id, file name or title.",
  "  --include-current        Also re-enrich documents whose enrichment is already current.",
].join("\n");

export function parseEnrichArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): EnrichArgs {
  const args: EnrichArgs = {
    ownerEmail: env.RAG_EVAL_OWNER_EMAIL,
    ownerId: env.RAG_EVAL_OWNER_ID ?? env.LOCAL_NO_AUTH_OWNER_ID,
    // Opt-in only. Defaulting to every owner when no owner env is set was how an
    // argument-less run reached every tenant on the configured project.
    allOwners: false,
    mode: "summaries-labels-images",
    limit: 25,
    includeCurrent: false,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    if (token === "--all-owners") {
      args.allOwners = true;
      continue;
    }
    if (token === "--include-current") {
      args.includeCurrent = true;
      continue;
    }
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--dry-run") continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--owner-email") args.ownerEmail = value;
    else if (token === "--owner-id") args.ownerId = value;
    else if (token === "--mode") args.mode = value;
    else if (token === "--limit") args.limit = Number.parseInt(value, 10);
    else if (token === "--document-id") args.documentId = value;
    else if (token === "--document") args.document = value;
    else throw new Error(`Unknown option ${token}\n${ENRICH_USAGE}`);
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be a positive integer.");
  if (!(ENRICH_MODES as readonly string[]).includes(args.mode)) {
    throw new Error(`--mode supports ${ENRICH_MODES.join(", ")}.`);
  }
  if (!args.ownerId && !args.ownerEmail && !args.allOwners) {
    throw new Error(
      'Provide --owner-id, set LOCAL_NO_AUTH_OWNER_ID or RAG_EVAL_OWNER_ID, provide --owner-email "you@example.com", ' +
        "or pass --all-owners explicitly to cross every owner.",
    );
  }
  return args;
}
