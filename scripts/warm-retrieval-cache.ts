import { loadEnvConfig } from "@next/env";
import {
  loadCapturedRagEvalCases,
  mergeRagEvalCases,
  selectRagEvalCases,
  type RagEvalCase,
  type SupabaseEvalCaseClient,
} from "@/lib/rag/rag-eval-cases";
import { findOwnerIdByEmail, loadAdminClient } from "./eval-utils";

loadEnvConfig(process.cwd());

type WarmArgs = {
  ownerEmail?: string;
  ownerId?: string;
  limit?: number;
  question?: string;
  includeCaptured: boolean;
  answers: boolean;
  repeat: number;
};

function parseArgs(argv: string[]): WarmArgs {
  const args: WarmArgs = {
    ownerEmail: process.env.RAG_EVAL_OWNER_EMAIL,
    ownerId: process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID,
    includeCaptured: false,
    answers: false,
    repeat: 1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    if (token === "--include-captured") {
      args.includeCaptured = true;
      continue;
    }
    if (token === "--answers") {
      args.answers = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (token === "--owner-email") args.ownerEmail = value;
    if (token === "--owner-id") args.ownerId = value;
    if (token === "--limit") args.limit = Number.parseInt(value, 10);
    if (token === "--question") args.question = value;
    if (token === "--repeat") args.repeat = Number.parseInt(value, 10);
  }

  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }
  if (!Number.isInteger(args.repeat) || args.repeat <= 0) {
    throw new Error("--repeat must be a positive integer.");
  }
  return args;
}

function dedupeCases(cases: RagEvalCase[]) {
  const seen = new Set<string>();
  const deduped: RagEvalCase[] = [];
  for (const testCase of cases) {
    const key = testCase.question.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(testCase);
  }
  return deduped;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [{ requireOpenAIEnv, requireServerEnv }, rag, supabase] = await Promise.all([
    import("@/lib/env"),
    import("@/lib/rag/rag"),
    loadAdminClient(),
  ]);

  requireServerEnv();
  requireOpenAIEnv();

  const ownerId = args.ownerId ?? (args.ownerEmail ? await findOwnerIdByEmail(supabase, args.ownerEmail) : undefined);
  const evalCaseClient = supabase as unknown as SupabaseEvalCaseClient;
  const baseCases = selectRagEvalCases({ limit: args.limit, question: args.question });
  const capturedCases = args.includeCaptured
    ? await loadCapturedRagEvalCases({ supabase: evalCaseClient, ownerId, limit: args.limit ?? 50 })
    : [];
  const cases = dedupeCases(mergeRagEvalCases(baseCases, capturedCases)).slice(0, args.limit ?? undefined);

  console.log(
    `Warming ${cases.length} retrieval cache path(s), scope=${ownerId ? "owner" : "global"}, answers=${args.answers}, repeat=${args.repeat}.`,
  );

  for (let pass = 1; pass <= args.repeat; pass += 1) {
    for (const testCase of cases) {
      const startedAt = Date.now();
      if (args.answers) {
        const answer = await rag.answerQuestionWithScope({
          query: testCase.question,
          ownerId,
          allowGlobalSearch: !ownerId,
          logQuery: false,
          skipCache: false,
        });
        console.log(
          `pass=${pass} answer ${Date.now() - startedAt}ms route=${answer.routingMode ?? "none"} q=${testCase.question}`,
        );
      } else {
        const search = await rag.searchChunksWithTelemetry({
          query: testCase.question,
          ownerId,
          allowGlobalSearch: !ownerId,
          topK: 12,
          minSimilarity: 0.12,
          skipCache: false,
        });
        console.log(
          `pass=${pass} search ${Date.now() - startedAt}ms strategy=${search.telemetry.retrieval_strategy} results=${search.results.length} q=${testCase.question}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
