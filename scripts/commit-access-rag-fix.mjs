import fs from "node:fs";
import { execSync } from "node:child_process";

const ownerScope = `import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";

export const PUBLIC_OWNER_FILTER_SENTINEL = "00000000-0000-0000-0000-000000000000";

export function requireOwnerScope(ownerId: string | null | undefined): string | undefined {
  if (ownerId) return ownerId;
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return undefined;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}

export function retrievalOwnerFilter(args: {
  ownerId?: string | null;
  documentIds?: string[];
  allowGlobalSearch?: boolean;
}): string | null | undefined {
  if (args.ownerId) return requireOwnerScope(args.ownerId);
  if (isDemoMode() || isLocalNoAuthMode() || process.env.NODE_ENV === "test") {
    return undefined;
  }
  if (args.allowGlobalSearch || args.documentIds?.length) {
    return PUBLIC_OWNER_FILTER_SENTINEL;
  }
  throw new Error(
    "Owner-scoped retrieval was called without an ownerId; refusing to run to avoid returning another tenant's data.",
  );
}
`;

fs.writeFileSync("src/lib/owner-scope.ts", ownerScope);

let rag = fs.readFileSync("src/lib/rag.ts", "utf8");
rag = rag.replace(
  'import { requireOwnerScope } from "@/lib/owner-scope";',
  'import { requireOwnerScope, retrievalOwnerFilter } from "@/lib/owner-scope";',
);
rag = rag.replace(
  /function ownerScopeForDocumentFilteredRetrieval\([\s\S]*?\n\}/,
  `function ownerScopeForDocumentFilteredRetrieval(
  ownerId: string | undefined,
  documentIds: string[] | undefined,
  allowGlobalSearch?: boolean,
) {
  return retrievalOwnerFilter({ ownerId, documentIds, allowGlobalSearch });
}`,
);
rag = rag.replaceAll(
  "ownerScopeForDocumentFilteredRetrieval(args.ownerId, args.documentIds)",
  "ownerScopeForDocumentFilteredRetrieval(args.ownerId, args.documentIds, args.allowGlobalSearch)",
);
rag = rag.replaceAll(
  "ownerScopeForDocumentFilteredRetrieval(args.ownerId, documentFilterList)",
  "ownerScopeForDocumentFilteredRetrieval(args.ownerId, documentFilterList, args.allowGlobalSearch)",
);
rag = rag.replace(
  `documentFilter ? [documentFilter] : undefined,
        ),`,
  `documentFilter ? [documentFilter] : undefined,
          documentFilter ? undefined : args.allowGlobalSearch,
        ),`,
);
rag = rag.replace(
  `documentIds: documentFilterList,
    matchCount: textCandidateCount,`,
  `documentIds: documentFilterList,
    allowGlobalSearch: args.allowGlobalSearch,
    matchCount: textCandidateCount,`,
);
rag = rag.replaceAll(
  `documentIds: documentFilterList,
      matchCount: Math.min(candidateCount, 48),`,
  `documentIds: documentFilterList,
      allowGlobalSearch: args.allowGlobalSearch,
      matchCount: Math.min(candidateCount, 48),`,
);
rag = rag.replace(
  `documentIds: documentFilterList,
      matchCount: Math.min(candidateCount, 64),`,
  `documentIds: documentFilterList,
      allowGlobalSearch: args.allowGlobalSearch,
      matchCount: Math.min(candidateCount, 64),`,
);
rag = rag.replace(
  "documentIds?: string[];\n  matchCount: number;\n}) {\n  const runChunkText",
  "documentIds?: string[];\n  allowGlobalSearch?: boolean;\n  matchCount: number;\n}) {\n  const runChunkText",
);
for (const fn of ["searchTableFactCandidates", "searchEmbeddingFieldCandidates", "searchIndexUnitCandidates"]) {
  rag = rag.replace(
    new RegExp(`async function ${fn}\\([\\s\\S]*?documentIds\\?: string\\[\\];\\n  matchCount: number;`),
    (m) =>
      m.replace(
        "documentIds?: string[];\n  matchCount: number;",
        "documentIds?: string[];\n  allowGlobalSearch?: boolean;\n  matchCount: number;",
      ),
  );
}
if (!rag.includes('else documentQuery = documentQuery.is("owner_id", null);')) {
  rag = rag.replace(
    `if (args.ownerId) documentQuery = documentQuery.eq("owner_id", args.ownerId);
  const { data: documents, error: documentsError } = await documentQuery;`,
    `if (args.ownerId) documentQuery = documentQuery.eq("owner_id", args.ownerId);
  else documentQuery = documentQuery.is("owner_id", null);
  const { data: documents, error: documentsError } = await documentQuery;`,
  );
}
fs.writeFileSync("src/lib/rag.ts", rag);

let enrichment = fs.readFileSync("src/lib/document-enrichment.ts", "utf8");
enrichment = enrichment.replace(
  'import { requireOwnerScope } from "@/lib/owner-scope";',
  'import { retrievalOwnerFilter } from "@/lib/owner-scope";',
);
enrichment = enrichment.replace(
  "owner_filter: args.ownerId ? requireOwnerScope(args.ownerId) : null,",
  "owner_filter: retrievalOwnerFilter({ ownerId: args.ownerId, documentIds: args.documentIds }),",
);
fs.writeFileSync("src/lib/document-enrichment.ts", enrichment);

let memory = fs.readFileSync("src/lib/deep-memory.ts", "utf8");
if (!memory.includes("retrievalOwnerFilter")) {
  memory = memory.replace(
    'import { requireOwnerScope } from "@/lib/owner-scope";',
    'import { retrievalOwnerFilter } from "@/lib/owner-scope";',
  );
  memory = memory.replace(
    /owner_filter:[\s\S]*?requireOwnerScope\(args\.ownerId\)[\s\S]*?\),/,
    `owner_filter: retrievalOwnerFilter({
          ownerId: args.ownerId,
          documentIds: args.documentIds,
          allowGlobalSearch: !args.ownerId && !args.documentIds?.length,
        }),`,
  );
}
fs.writeFileSync("src/lib/deep-memory.ts", memory);

let schema = fs.readFileSync("supabase/schema.sql", "utf8");
if (!schema.includes("create or replace function public.retrieval_owner_matches")) {
  schema = schema.replace(
    "create or replace function public.match_document_chunks(",
    `create or replace function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when owner_filter is null then true
    when owner_filter = '00000000-0000-0000-0000-000000000000'::uuid then row_owner_id is null
    else row_owner_id = owner_filter
  end;
$$;

create or replace function public.match_document_chunks(`,
  );
}
schema = schema.replaceAll(
  "(owner_filter is null or d.owner_id = owner_filter)",
  "public.retrieval_owner_matches(owner_filter, d.owner_id)",
);
schema = schema.replaceAll(
  "(owner_filter is null or l.owner_id = owner_filter)",
  "public.retrieval_owner_matches(owner_filter, l.owner_id)",
);
schema = schema.replaceAll(
  "(owner_filter is null or s.owner_id = owner_filter)",
  "public.retrieval_owner_matches(owner_filter, s.owner_id)",
);
schema = schema.replaceAll(
  "(owner_filter is null or f.owner_id = owner_filter)",
  "public.retrieval_owner_matches(owner_filter, f.owner_id)",
);
fs.writeFileSync("supabase/schema.sql", schema);

const names = [
  "retrieval_owner_matches",
  "match_document_chunks",
  "match_document_chunks_hybrid",
  "match_document_memory_cards_hybrid",
  "match_documents_for_query",
  "match_document_chunks_text",
  "match_document_lookup_chunks_text",
  "get_related_document_metadata",
  "match_document_table_facts_text",
  "match_document_embedding_fields_hybrid",
  "match_document_index_units_hybrid",
];
const chunks = names.map((name) => {
  const re = new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\n\\$\\$;`, "i");
  const match = schema.match(re);
  if (!match) throw new Error(`missing ${name}`);
  return match[0];
});
fs.writeFileSync(
  "supabase/migrations/20260705210000_retrieval_owner_filter_sentinel.sql",
  `-- Public-only retrieval owner filter sentinel for hybrid RPCs.\nset search_path = public, extensions, pg_temp;\n\n${chunks.join("\n\n")}\n`,
);

let ownerTest = fs.readFileSync("tests/owner-scope.test.ts", "utf8");
if (!ownerTest.includes("retrievalOwnerFilter")) {
  ownerTest += `\ndescribe("retrievalOwnerFilter", () => {
  it("returns the public sentinel for anonymous production global search", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false, isLocalNoAuthMode: () => false }));
    vi.stubEnv("NODE_ENV", "production");
    const { retrievalOwnerFilter, PUBLIC_OWNER_FILTER_SENTINEL } = await import("../src/lib/owner-scope");
    expect(retrievalOwnerFilter({ allowGlobalSearch: true })).toBe(PUBLIC_OWNER_FILTER_SENTINEL);
  });
});\n`;
  fs.writeFileSync("tests/owner-scope.test.ts", ownerTest);
}

execSync(
  "git add src/lib/owner-scope.ts src/lib/rag.ts src/lib/document-enrichment.ts src/lib/deep-memory.ts supabase/schema.sql supabase/migrations/20260705210000_retrieval_owner_filter_sentinel.sql tests/owner-scope.test.ts scripts/commit-access-rag-fix.mjs",
  { stdio: "inherit" },
);
execSync('git commit -m "fix(rag): scope anonymous retrieval to public documents via owner sentinel"', {
  stdio: "inherit",
});
console.log("committed");
