import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EVAL_OWNER_ID,
  expectedFileCoverage,
  isProviderRateLimitError,
  pauseBetweenEvalCases,
  resolveEvalOwnerId,
  validateRagAnswer,
  withProviderBackoff,
  type SupabaseAdmin,
} from "../scripts/eval-utils";
import type { RagEvalCase } from "../src/lib/rag-eval-cases";
import type { RagAnswer } from "../src/lib/types";

describe("RAG eval source identity matching", () => {
  it("matches legacy expected shorthand against current indexed document-family titles", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.NOCC.pdf", "CG.MHSP.PtSafetyPlan.pdf"],
      [
        {
          title: "National Outcomes And Casemix Collection(NOCC)(AKG)",
          file_name: "National Outcomes and Casemix Collection (NOCC) (AKG).pdf",
        },
        {
          title: "Safety Planning - Mother Baby Unit(KEMH)",
          file_name: "Safety Planning - Mother Baby Unit (KEMH).pdf",
        },
      ],
      5,
    );

    expect(coverage).toMatchObject({
      matchedFiles: ["MHSP.NOCC.pdf", "CG.MHSP.PtSafetyPlan.pdf"],
      missingFiles: [],
      allHit: true,
    });
  });

  it("does not match unrelated retrieved files just because aliases exist", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.Discharge.pdf"],
      [
        {
          title: "Pantoprazole Guideline(NMHS)",
          file_name: "Pantoprazole Guideline (NMHS).pdf",
        },
      ],
      5,
    );

    expect(coverage.anyHit).toBe(false);
    expect(coverage.missingFiles).toEqual(["MHSP.Discharge.pdf"]);
  });

  it("fails supported clinical eval cases when numeric faithfulness warnings are present", () => {
    const testCase: RagEvalCase = {
      id: "dose-warning",
      question: "What clozapine dose should be used?",
      category: "routine",
      supported: true,
      expectedFiles: ["clozapine.pdf"],
      allowedRoutes: ["fast", "strong"],
      minCitations: 1,
      latencyTargetMs: 10_000,
    };
    const answer = {
      answer: "Use clozapine 200 mg.",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "chunk-1", document_id: "doc-1", title: "Clozapine", file_name: "clozapine.pdf" }],
      sources: [{ title: "Clozapine", file_name: "clozapine.pdf" }],
      routingMode: "fast",
      visualEvidence: [],
      unverifiedNumericTokens: ["200mg"],
      faithfulnessWarning: "verify against source",
      latencyTimings: { total_latency_ms: 100 },
    } as unknown as RagAnswer;

    const validation = validateRagAnswer(testCase, answer);

    expect(validation.failures).toContain("clinical numeric faithfulness warning present (1 unverified token(s))");
  });

  it("accepts a source-only answer for acceptSourceOnly cases when expected documents are still cited", () => {
    const testCase: RagEvalCase = {
      id: "discharge-documentation",
      question: "What should discharge documentation include?",
      category: "routine",
      supported: true,
      acceptSourceOnly: true,
      expectedFiles: ["MHSP.Discharge.pdf"],
      allowedRoutes: ["extractive", "fast"],
      minCitations: 2,
      latencyTargetMs: 2000,
    };
    const dischargeSources = [
      {
        title: "Admission to Discharge for Mental Health Inpatients",
        file_name: "Admission to Discharge for Mental Health Inpatients (NMHS).pdf",
      },
      {
        title: "Referral, Admission and Discharge - MHHITH",
        file_name:
          "Referral, Admission and Discharge - Mental Health Hospital in the Home (MHHITH) Policy and Procedure (RKPG).pdf",
      },
    ];
    const sourceOnly = {
      answer: "The following indexed discharge documents are available.",
      grounded: false,
      confidence: "high",
      citations: dischargeSources.map((source, index) => ({
        chunk_id: `c${index}`,
        document_id: `d${index}`,
        ...source,
      })),
      sources: dischargeSources,
      routingMode: "extractive",
      visualEvidence: [],
      latencyTimings: { total_latency_ms: 800 },
    } as unknown as RagAnswer;

    const validation = validateRagAnswer(testCase, sourceOnly);

    expect(validation.expectedHit).toBe(true);
    expect(validation.failures).not.toContain("expected grounded answer");
    expect(validation.failures).toEqual([]);
  });

  it("still fails an acceptSourceOnly case when the expected documents are no longer retrieved", () => {
    const testCase: RagEvalCase = {
      id: "discharge-documentation",
      question: "What should discharge documentation include?",
      category: "routine",
      supported: true,
      acceptSourceOnly: true,
      expectedFiles: ["MHSP.Discharge.pdf"],
      allowedRoutes: ["extractive", "fast"],
      minCitations: 2,
      latencyTargetMs: 2000,
    };
    const wrongSources = [
      { title: "Pantoprazole Guideline", file_name: "Pantoprazole Guideline (NMHS).pdf" },
      { title: "Pantoprazole Guideline", file_name: "Pantoprazole Guideline (NMHS).pdf" },
    ];
    const sourceOnlyMissingDocs = {
      answer: "A source-only answer citing unrelated documents.",
      grounded: false,
      confidence: "high",
      citations: wrongSources.map((source, index) => ({ chunk_id: `c${index}`, document_id: `d${index}`, ...source })),
      sources: wrongSources,
      routingMode: "extractive",
      visualEvidence: [],
      latencyTimings: { total_latency_ms: 800 },
    } as unknown as RagAnswer;

    const validation = validateRagAnswer(testCase, sourceOnlyMissingDocs);

    expect(validation.expectedHit).toBe(false);
    expect(validation.failures).toContain("expected document not in retrieved sources");
  });

  it("retries transient provider rate-limit errors for eval operations", async () => {
    let attempts = 0;

    const result = await withProviderBackoff(
      "test-rate-limit",
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("OpenAI is rate limited. Retry in a moment.");
        return "ok";
      },
      { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    expect(isProviderRateLimitError(new Error("429 too many requests"))).toBe(true);
  });

  it("pauses between eval cases when configured", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("RAG_EVAL_CASE_DELAY_MS", "15");
      vi.stubEnv("RAG_EVAL_FORCE_EMBEDDING_DELAY_MS", "15");

      const pausePromise = pauseBetweenEvalCases({ caseIndex: 1, forceEmbedding: true });
      await vi.advanceTimersByTimeAsync(30);
      await pausePromise;

      await pauseBetweenEvalCases({ caseIndex: 0, forceEmbedding: true });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });
});

describe("resolveEvalOwnerId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function adminClientWithUsers(users: Array<{ id: string; email: string }>): SupabaseAdmin {
    return {
      auth: { admin: { listUsers: async () => ({ data: { users }, error: null }) } },
    } as unknown as SupabaseAdmin;
  }

  it("prefers an explicit ownerId over email lookup and the sentinel", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const listUsers = vi.fn();
    const supabase = { auth: { admin: { listUsers } } } as unknown as SupabaseAdmin;

    const ownerId = await resolveEvalOwnerId(supabase, {
      ownerId: "explicit-owner",
      ownerEmail: "user@example.com",
    });

    expect(ownerId).toBe("explicit-owner");
    expect(listUsers).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("resolves ownerEmail via Supabase Auth when no ownerId is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = adminClientWithUsers([{ id: "user-123", email: "Clinician@Example.com" }]);

    const ownerId = await resolveEvalOwnerId(supabase, { ownerEmail: "clinician@example.com" });

    expect(ownerId).toBe("user-123");
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the public-owner sentinel and warns when no owner is provided", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = adminClientWithUsers([]);

    const ownerId = await resolveEvalOwnerId(supabase, {});

    expect(ownerId).toBe(DEFAULT_EVAL_OWNER_ID);
    expect(DEFAULT_EVAL_OWNER_ID).toBe("00000000-0000-0000-0000-000000000000");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(DEFAULT_EVAL_OWNER_ID);
  });
});
