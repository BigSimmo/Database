import { describe, expect, it } from "vitest";
import { classifyChangedFiles, fullRunSentinelFiles, parsePorcelainV1Z } from "../scripts/lib/ci-change-scope.mjs";

describe("CI change scope", () => {
  it("keeps ordinary documentation changes on the docs-only path", () => {
    expect(classifyChangedFiles(["docs/operator-note.md"])).toMatchObject({
      docs_only: true,
      source_changed: false,
      build_changed: false,
    });
  });

  it("classifies UI, API, database, RAG, and workflow changes conservatively", () => {
    expect(classifyChangedFiles(["src/lib/app-modes.ts"])).toMatchObject({ ui_changed: true, build_changed: true });
    expect(classifyChangedFiles(["src/app/api/search/route.ts"])).toMatchObject({
      source_changed: true,
      ui_changed: true,
      rag_eval_changed: true,
      build_changed: true,
    });
    expect(classifyChangedFiles(["src/app/api/answer/route.ts"])).toMatchObject({
      source_changed: true,
      rag_eval_changed: true,
      build_changed: true,
    });
    expect(classifyChangedFiles(["supabase/migrations/20260710000000_example.sql"])).toMatchObject({
      source_changed: true,
      db_changed: true,
    });
    expect(classifyChangedFiles(["src/lib/retrieval-selection.ts"])).toMatchObject({
      source_changed: true,
      rag_eval_changed: true,
    });
    expect(classifyChangedFiles([".github/actions/setup/action.yml"])).toMatchObject({
      workflow_changed: true,
      docs_only: false,
    });
    expect(classifyChangedFiles(["scripts/ci-change-scope.mjs"])).toMatchObject({
      source_changed: true,
      workflow_changed: true,
      docs_only: false,
    });
  });

  it("treats runtime and build configuration as build-sensitive", () => {
    for (const file of [".env.example", ".npmrc", ".nvmrc", "next.config.ts", "tsconfig.json"]) {
      expect(classifyChangedFiles([file]), file).toMatchObject({ source_changed: true, build_changed: true });
    }
  });

  it("enables every scope lane for the full-run sentinel", () => {
    expect(classifyChangedFiles(fullRunSentinelFiles)).toMatchObject({
      docs_only: false,
      source_changed: true,
      ui_changed: true,
      db_changed: true,
      container_changed: true,
      rag_eval_changed: true,
      workflow_changed: true,
      build_changed: true,
    });
  });

  it("parses untracked porcelain entries", () => {
    expect(parsePorcelainV1Z(" M src/lib/changed-helper.ts\0?? src/lib/new-helper.ts\0")).toEqual([
      "src/lib/changed-helper.ts",
      "src/lib/new-helper.ts",
    ]);
  });

  it("keeps both paths for rename and copy entries", () => {
    const files = parsePorcelainV1Z(
      "R  src/components/NewPanel.tsx\0docs/OldPanel.md\0C  src/lib/new-copy.ts\0docs/source-copy.md\0",
    );

    expect(files).toEqual([
      "src/components/NewPanel.tsx",
      "docs/OldPanel.md",
      "src/lib/new-copy.ts",
      "docs/source-copy.md",
    ]);
    expect(classifyChangedFiles(files)).toMatchObject({ source_changed: true, ui_changed: true, build_changed: true });
  });
});
