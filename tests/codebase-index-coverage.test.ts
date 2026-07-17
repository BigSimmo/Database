import { describe, expect, it } from "vitest";
import { coverageGaps, schemaTableGaps } from "../scripts/check-codebase-index-coverage.mjs";

const index = `
### Product pages (\`src/app/\`)

Routes: \`/documents\`, \`/reference/colour-coding\`.

### API routes (\`src/app/api/\`)

Routes: \`/api/answer\`.

## \`src/lib/\` module map

Modules: \`observability/\`, \`validation/\`, \`extractors/document.ts\`.

## Supabase

### Schema tables

\`documents\`, \`document_chunks\`

### Migration themes
`;

describe("coverageGaps", () => {
  it("reports a module whose name is absent from the index", () => {
    const gaps = coverageGaps(index, [{ kind: "lib", dir: "src/lib", name: "ingestion" }]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].full).toBe("src/lib/ingestion");
  });

  it("treats section-scoped path code spans as covered", () => {
    const gaps = coverageGaps(index, [
      { kind: "lib", dir: "src/lib", name: "observability" },
      { kind: "lib", dir: "src/lib", name: "validation" },
      { kind: "route", dir: "src/app", name: "documents" },
      { kind: "route", dir: "src/app", name: "reference" },
      { kind: "lib", dir: "src/lib", name: "extractors" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("does not count a bare name that appears only in prose", () => {
    const withProse = index.replace("## `src/lib/` module map", "## `src/lib/` module map\n\nIngestion is important.");
    const gaps = coverageGaps(withProse, [{ kind: "lib", dir: "src/lib", name: "ingestion" }]);
    expect(gaps.map((gap) => gap.full)).toEqual(["src/lib/ingestion"]);
  });

  it("does not let a product route satisfy an API route", () => {
    const withProductRoute = index.replace("`/documents`", "`/documents`, `/medications`");
    const gaps = coverageGaps(withProductRoute, [{ kind: "api", dir: "src/app/api", name: "medications" }]);
    expect(gaps.map((gap) => gap.full)).toEqual(["src/app/api/medications"]);
  });

  it("honours the allowlist", () => {
    const gaps = coverageGaps(index, [{ kind: "route", dir: "src/app", name: "icons" }], new Set(["src/app/icons"]));
    expect(gaps).toEqual([]);
  });

  it("reports missing and stale schema-table entries", () => {
    const schema = `
      create table public.documents (id uuid primary key);
      create table if not exists public.rag_queries (id uuid primary key);
    `;
    expect(schemaTableGaps(index, schema)).toEqual({
      missing: ["rag_queries"],
      stale: ["document_chunks"],
    });
  });
});
