import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), demo: vi.fn(), rate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => ({
  requireAuthenticatedUser: mocks.auth,
  AuthenticationError: class extends Error {},
  unauthorizedResponse: () => Response.json({ error: "Sign in" }, { status: 401 }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  rateLimitJsonResponse: () => Response.json({}, { status: 429 }),
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
}));

import { POST } from "@/app/api/cme/plan/carry/route";

const OWNER = "11111111-1111-4111-8111-111111111111";
const GOAL = "33333333-3333-4333-8333-333333333333";
const route = "http://localhost/api/cme/plan/carry";
const body = { sourceYear: 2026, goalId: GOAL };

function post(payload: unknown) {
  return new Request(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.auth.mockResolvedValue({ id: OWNER });
  mocks.rate.mockResolvedValue({ limited: false });
});

describe("atomic CPD goal carry", () => {
  it("takes owner from session and returns the appended next-year plan", async () => {
    const goals = [{ id: GOAL, goal: "Review communication", sortOrder: 0 }];
    mocks.rpc.mockResolvedValue({ data: { goals, carried: true }, error: null });
    const response = await POST(post(body));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("cme_carry_plan_goal", {
      p_owner_id: OWNER,
      p_source_year: 2026,
      p_goal_id: GOAL,
    });
    expect(await response.json()).toEqual({ year: 2027, goals, carried: true });
  });

  it("reports an idempotent duplicate without another write", async () => {
    mocks.rpc.mockResolvedValue({ data: { goals: [], carried: false }, error: null });
    expect(await (await POST(post(body))).json()).toEqual({ year: 2027, goals: [], carried: false });
  });

  it("refuses demo, invalid payload, missing authentication and rate limit before RPC", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await POST(post(body))).status).toBe(400);
    mocks.demo.mockReturnValue(false);
    expect((await POST(post({ ...body, ownerId: OWNER }))).status).toBe(400);
    expect((await POST(post({ ...body, goalId: "not-a-uuid" }))).status).toBe(400);
    mocks.auth.mockRejectedValueOnce(new (await import("@/lib/supabase/auth")).AuthenticationError());
    expect((await POST(post(body))).status).toBe(401);
    mocks.rate.mockResolvedValueOnce({ limited: true });
    expect((await POST(post(body))).status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["cme_goal_not_found", 404],
    ["cme_year_not_confirmed", 400],
    ["cme_year_closed", 409],
    ["cme_goal_limit", 409],
    ["cme_carry_unavailable", 409],
  ])("maps %s to a stable public error", async (code, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const response = await POST(post(body));
    expect(response.status).toBe(status);
    expect((await response.json()).code).toBe(code);
  });
});

describe("atomic carry migration contract", () => {
  const sql = readFileSync("supabase/migrations/20260927195000_cme_atomic_goal_carry.sql", "utf8");

  it("shares the owner lock, checks year and goal ownership, and appends without deletion", () => {
    expect(sql.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(sql).toContain("where id = p_goal_id and owner_id = p_owner_id and year_id = v_source_id");
    expect(sql).toContain("where owner_id = p_owner_id and year = p_source_year + 1 and closed_at is null");
    expect(sql).toContain("if v_count >= 10 then raise exception 'cme_goal_limit'");
    expect(sql).toContain("lower(btrim(goal)) = lower(btrim(v_text))");
    expect(sql).not.toMatch(/delete from public\.cme_plan_goals/);
  });

  it("checks stale saves under the same lock and grants only service role access", () => {
    expect(sql).toContain(
      "if v_current_goals is distinct from p_expected_goals then raise exception 'cme_plan_conflict'",
    );
    expect(sql).toContain("jsonb_build_object('id', id, 'goal', goal) order by sort_order, id");
    expect(sql).toContain("primary key (owner_id, source_goal_id)");
    expect(sql).toContain("foreign key (source_goal_id, owner_id)");
    expect(sql).toContain("foreign key (target_goal_id, owner_id)");
    expect(sql).toContain("alter table public.cme_plan_goal_carries enable row level security");
    expect(sql).toContain("revoke all on table public.cme_plan_goal_carries from public, anon, authenticated");
    expect(sql).toContain("from public.cme_plan_goal_carries");
    expect(sql).toContain("on delete set null (target_goal_id)");
    expect(sql).toContain("v_already_mapped := found");
    expect(sql).toContain("if not v_already_mapped then");
    expect(sql).not.toContain("on conflict (owner_id, source_goal_id) do nothing");
    for (const name of ["cme_carry_plan_goal", "cme_save_plan_goals_checked"]) {
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\)\\s+from public, anon, authenticated`),
      );
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role`));
    }
  });
});
