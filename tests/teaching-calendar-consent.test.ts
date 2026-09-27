import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readWeek } from "@/lib/teaching/repository";

const actor = "11111111-1111-4111-8111-111111111111";
const service = "22222222-2222-4222-8222-222222222222";
const range = { from: "2026-09-28", to: "2026-10-04" };

function fixture() {
  const bounded = vi.fn().mockResolvedValue({ data: [], error: null });
  const owner = vi.fn(() => ({ in: bounded }));
  const select = vi.fn(() => ({ eq: owner }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({
    data: {
      teams: [{ id: service, name: "Synthetic service", role: "doctor", acceptsRealData: true, isDemo: false }],
      sessions: [],
      notices: [],
      attendance: [],
    },
    error: null,
  });
  const client = { rpc, from } as unknown as Parameters<typeof readWeek>[0];
  return { client, bounded, owner, select, from };
}

describe("Teaching calendar consent readback", () => {
  it("reads persisted consent after each reload and only for the authenticated owner and visible services", async () => {
    const { client, bounded, owner, select, from } = fixture();
    bounded.mockResolvedValueOnce({ data: [{ service_id: service }], error: null });
    expect((await readWeek(client, actor, range)).teams[0].inCalendar).toBe(true);
    expect(from).toHaveBeenCalledWith("teaching_calendar_optins");
    expect(select).toHaveBeenCalledWith("service_id");
    expect(owner).toHaveBeenCalledWith("user_id", actor);
    expect(bounded).toHaveBeenCalledWith("service_id", [service]);
    expect((await readWeek(client, actor, range)).teams[0].inCalendar).toBe(false);
  });

  it("does not present failed or malformed consent reads as opt-out", async () => {
    const { client, bounded } = fixture();
    bounded.mockResolvedValueOnce({ data: null, error: { code: "network", message: "private diagnostic" } });
    await expect(readWeek(client, actor, range)).rejects.toMatchObject({ status: 503 });
    bounded.mockResolvedValueOnce({ data: [{ service_id: "invalid" }], error: null });
    await expect(readWeek(client, actor, range)).rejects.toMatchObject({ status: 503 });
  });
});
