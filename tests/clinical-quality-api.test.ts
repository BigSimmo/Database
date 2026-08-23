import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  administrator: true,
  feedbackRows: [] as unknown[],
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  selections: [] as string[],
  triageUnavailable: false,
  verificationResult: "found" as "found" | "missing" | "unavailable",
  rpcWriteUnavailable: false,
}));

function chainFor(table: string) {
  let result: { data: unknown; error: { message: string } | null } =
    table === "rag_answer_feedback"
      ? { data: state.feedbackRows, error: null }
      : table === "clinical_quality_feedback_triage" && state.triageUnavailable
        ? { data: null, error: { message: "triage unavailable" } }
        : { data: [], error: null };
  const chain: Record<string, unknown> = {
    select(columns: string) {
      state.selections.push(`${table}:${columns}`);
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      return chain;
    },
    gte() {
      return chain;
    },
    in() {
      return chain;
    },
    eq(column: string) {
      if (column !== "id") return chain;
      if (state.verificationResult === "unavailable") {
        result = { data: null, error: { message: "verification unavailable" } };
      } else if (state.verificationResult === "missing") {
        result = { data: [], error: null };
      } else if (table === "rag_answer_feedback") {
        result = {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              feedback_category: "unsupported_answer",
            },
          ],
          error: null,
        };
      } else if (table === "rag_retrieval_logs") {
        result = {
          data: [{ id: "00000000-0000-4000-8000-000000000001", is_miss: true }],
          error: null,
        };
      } else if (table === "rag_visual_eval_runs") {
        result = {
          data: [{ id: "00000000-0000-4000-8000-000000000001", passed: false }],
          error: null,
        };
      }
      return chain;
    },
    then(resolve: (value: typeof result) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: async () =>
        state.administrator
          ? {
              data: {
                user: { id: "00000000-0000-4000-8000-000000000099", app_metadata: { site_role: "administrator" } },
              },
              error: null,
            }
          : { data: { user: null }, error: { message: "invalid" } },
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      if (name === "record_clinical_quality_feedback_triage") {
        if (state.rpcWriteUnavailable) return { data: null, error: { message: "write unavailable" } };
        return {
          data: {
            signal_type: args.p_signal_type,
            signal_id: args.p_signal_id,
            status: args.p_status,
            owner_role: args.p_owner_role,
            owner_user_id: null,
            resolution_code: null,
            retest_reference: "",
            updated_by: "00000000-0000-4000-8000-000000000099",
            created_at: "2026-08-23T00:00:00.000Z",
            updated_at: "2026-08-23T00:00:00.000Z",
            resolved_at: null,
          },
          error: null,
        };
      }
      return {
        data: [
          {
            limited: false,
            limit_value: 60,
            remaining: 59,
            retry_after_seconds: 60,
            reset_at: "2026-08-23T01:00:00.000Z",
          },
        ],
        error: null,
      };
    },
    from: (table: string) => chainFor(table),
  }),
}));

describe("clinical quality API", () => {
  beforeEach(() => {
    state.administrator = true;
    state.feedbackRows = [];
    state.rpcCalls = [];
    state.selections = [];
    state.triageUnavailable = false;
    state.verificationResult = "found";
    state.rpcWriteUnavailable = false;
  });

  it("requires an administrator, rate limits, and returns a strict v1 partial snapshot", async () => {
    const { GET } = await import("@/app/api/clinical-quality/route");
    const response = await GET(
      new Request("http://localhost/api/clinical-quality", { headers: { authorization: "Bearer test" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      version: "1",
      state: "partial",
      qualityQueue: { items: [] },
      sourceImpact: { items: [] },
    });
    expect(state.selections.join("\n")).not.toMatch(/\b(query|answer|excerpt|patient)\b/i);
  });

  it("rejects unauthenticated reads using the shared error envelope", async () => {
    state.administrator = false;
    const { GET } = await import("@/app/api/clinical-quality/route");
    const response = await GET(
      new Request("http://localhost/api/clinical-quality", { headers: { authorization: "Bearer invalid" } }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "authentication_required",
      message: "Authentication required.",
    });
  });

  it("shows quality signals with unknown workflow metadata when triage cannot be read", async () => {
    state.feedbackRows = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        interaction_id: "00000000-0000-4000-8000-000000000002",
        answer_hash: "hash",
        feedback_category: "unsupported_answer",
        source_ids: [],
        cited_source_ids: [],
        created_at: "2026-08-23T00:00:00.000Z",
      },
    ];
    state.triageUnavailable = true;
    const { GET } = await import("@/app/api/clinical-quality/route");
    const response = await GET(
      new Request("http://localhost/api/clinical-quality", { headers: { authorization: "Bearer test" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      qualityQueue: {
        evidence: { state: "partial" },
        items: [{ signalType: "unsupported_claim", triage: { status: "unknown" } }],
      },
    });
  });

  it("persists workflow metadata without accepting clinical text fields", async () => {
    const { PATCH } = await import("@/app/api/clinical-quality/route");
    const response = await PATCH(
      new Request("http://localhost/api/clinical-quality", {
        method: "PATCH",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({
          signalType: "unsupported_claim",
          signalId: "00000000-0000-4000-8000-000000000001",
          status: "in_review",
          ownerRole: "clinical_governance",
          retestReference: "",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: "1", triage: { status: "in_review" } });
    expect(state.rpcCalls).toContainEqual({
      name: "record_clinical_quality_feedback_triage",
      args: expect.objectContaining({
        p_actor_user_id: "00000000-0000-4000-8000-000000000099",
        p_signal_type: "unsupported_claim",
        p_signal_id: "00000000-0000-4000-8000-000000000001",
      }),
    });
  });

  it.each([
    ["retrieval_failure", "engineering"],
    ["evaluation_failure", "clinical_governance"],
  ] as const)("verifies and persists a %s source signal", async (signalType, ownerRole) => {
    const { PATCH } = await import("@/app/api/clinical-quality/route");
    const response = await PATCH(
      new Request("http://localhost/api/clinical-quality", {
        method: "PATCH",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({
          signalType,
          signalId: "00000000-0000-4000-8000-000000000001",
          status: "in_review",
          ownerRole,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(state.rpcCalls).toContainEqual({
      name: "record_clinical_quality_feedback_triage",
      args: expect.objectContaining({ p_signal_type: signalType }),
    });
  });

  it.each([
    ["missing", 404, "quality_signal_not_found"],
    ["unavailable", 503, "quality_signal_verification_unavailable"],
  ] as const)("fails closed when the signal source is %s", async (verificationResult, status, code) => {
    state.verificationResult = verificationResult;
    const { PATCH } = await import("@/app/api/clinical-quality/route");
    const response = await PATCH(
      new Request("http://localhost/api/clinical-quality", {
        method: "PATCH",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({
          signalType: "retrieval_failure",
          signalId: "00000000-0000-4000-8000-000000000001",
          status: "in_review",
          ownerRole: "engineering",
        }),
      }),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
    expect(state.rpcCalls.some((call) => call.name === "record_clinical_quality_feedback_triage")).toBe(false);
  });

  it("returns a canonical 503 when the atomic triage write fails", async () => {
    state.rpcWriteUnavailable = true;
    const { PATCH } = await import("@/app/api/clinical-quality/route");
    const response = await PATCH(
      new Request("http://localhost/api/clinical-quality", {
        method: "PATCH",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({
          signalType: "unsupported_claim",
          signalId: "00000000-0000-4000-8000-000000000001",
          status: "in_review",
          ownerRole: "clinical_governance",
        }),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "triage_write_failed" });
  });

  it("rejects a triage signal type that does not match its persisted source", async () => {
    const { PATCH } = await import("@/app/api/clinical-quality/route");
    const response = await PATCH(
      new Request("http://localhost/api/clinical-quality", {
        method: "PATCH",
        headers: { authorization: "Bearer test", "content-type": "application/json" },
        body: JSON.stringify({
          signalType: "source_conflict",
          signalId: "00000000-0000-4000-8000-000000000001",
          status: "in_review",
          ownerRole: "clinical_governance",
          retestReference: "",
        }),
      }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "quality_signal_type_mismatch" });
    expect(state.rpcCalls.some((call) => call.name === "record_clinical_quality_feedback_triage")).toBe(false);
  });
});
