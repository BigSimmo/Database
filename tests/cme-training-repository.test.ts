import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PublicApiError } from "@/lib/http";
import {
  CME_TRAINING_MAX_ROWS,
  createOwnerTrainingMilestone,
  createOwnerTrainingPeriod,
  deleteOwnerTrainingMilestone,
  deleteOwnerTrainingPeriod,
  fetchOwnerTrainingMilestones,
  fetchOwnerTrainingPeriods,
  rowToTrainingMilestone,
  rowToTrainingPeriod,
  updateOwnerTrainingMilestone,
  updateOwnerTrainingPeriod,
} from "@/lib/cme/training-repository";
import type { TrainingPeriodInput } from "@/lib/cme/training-timeline";

const OWNER = "11111111-1111-4111-8111-111111111111";
const PERIOD_ID = "22222222-2222-4222-8222-222222222222";
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333";

type Call = { method: string; args: unknown[] };
type Result = { data: unknown; error: { message: string } | null; count?: number | null };

/**
 * A fake Supabase client. Every `.from()` starts a chain that records its
 * calls; awaiting the chain (or `.single()` / `.maybeSingle()`) takes the next
 * queued result for that table.
 */
function fakeClient(results: Record<string, Result[]>) {
  const chains: { table: string; calls: Call[] }[] = [];
  const client = {
    from(table: string) {
      const chain = { table, calls: [] as Call[] };
      chains.push(chain);
      const take = () => {
        const queue = results[table] ?? [];
        const next = queue.shift();
        if (!next) throw new Error(`No queued result for ${table}`);
        return Promise.resolve(next);
      };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "insert", "update", "delete", "eq", "in", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          chain.calls.push({ method, args });
          return builder;
        };
      }
      builder.single = () => {
        chain.calls.push({ method: "single", args: [] });
        return take();
      };
      builder.maybeSingle = () => {
        chain.calls.push({ method: "maybeSingle", args: [] });
        return take();
      };
      builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        take().then(resolve, reject);
      return builder;
    },
  };
  return { client: client as never, chains };
}

function ownerScoped(chain: { calls: Call[] }) {
  return chain.calls.some((call) => call.method === "eq" && call.args[0] === "owner_id" && call.args[1] === OWNER);
}

function insertedOwner(chain: { calls: Call[] }) {
  const insert = chain.calls.find((call) => call.method === "insert");
  return (insert?.args[0] as { owner_id?: string } | undefined)?.owner_id;
}

const periodRow = {
  id: PERIOD_ID,
  kind: "rotation" as const,
  label: "Adult inpatient",
  starts_on: "2026-02-02",
  ends_on: "2026-07-31",
  fte: "1.00",
};

const milestoneRow = {
  id: MILESTONE_ID,
  label: "Formulation assessment",
  due_kind: "fte-months" as const,
  due_fte_months: "12.50",
  due_on: null,
  completed_on: null,
};

const rotationInput: TrainingPeriodInput = {
  kind: "rotation",
  label: "Consultation liaison",
  startsOn: "2026-08-03",
  endsOn: "2027-01-29",
  fte: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("row mapping", () => {
  it("turns numeric columns into numbers and snake_case into camelCase", () => {
    expect(rowToTrainingPeriod(periodRow)).toEqual({
      id: PERIOD_ID,
      kind: "rotation",
      label: "Adult inpatient",
      startsOn: "2026-02-02",
      endsOn: "2026-07-31",
      fte: 1,
    });
    expect(rowToTrainingMilestone(milestoneRow)).toEqual({
      id: MILESTONE_ID,
      label: "Formulation assessment",
      dueKind: "fte-months",
      dueFteMonths: 12.5,
      dueOn: null,
      completedOn: null,
    });
  });
});

describe("owner predicate on every query", () => {
  it("scopes both list reads and caps their size", async () => {
    const { client, chains } = fakeClient({
      cme_training_periods: [{ data: [periodRow], error: null }],
      cme_training_milestones: [{ data: [milestoneRow], error: null }],
    });
    await fetchOwnerTrainingPeriods(client, OWNER);
    await fetchOwnerTrainingMilestones(client, OWNER);
    expect(chains).toHaveLength(2);
    for (const chain of chains) {
      expect(ownerScoped(chain)).toBe(true);
      expect(chain.calls).toContainEqual({ method: "limit", args: [CME_TRAINING_MAX_ROWS] });
    }
  });

  it("scopes period create, update and delete", async () => {
    const { client, chains } = fakeClient({
      cme_training_periods: [
        { data: [], error: null },
        { data: { ...periodRow, id: "x" }, error: null },
        { data: [periodRow], error: null },
        { data: periodRow, error: null },
        { data: [{ id: PERIOD_ID }], error: null },
      ],
    });
    await createOwnerTrainingPeriod(client, OWNER, rotationInput);
    await updateOwnerTrainingPeriod(client, OWNER, PERIOD_ID, { ...rotationInput, startsOn: "2026-02-02" });
    await deleteOwnerTrainingPeriod(client, OWNER, PERIOD_ID);
    expect(chains).toHaveLength(5);
    for (const chain of chains) {
      const isInsert = chain.calls.some((call) => call.method === "insert");
      if (isInsert) expect(insertedOwner(chain)).toBe(OWNER);
      else expect(ownerScoped(chain)).toBe(true);
    }
    const update = chains[3];
    expect(update.calls).toContainEqual({ method: "eq", args: ["id", PERIOD_ID] });
    const remove = chains[4];
    expect(remove.calls.map((call) => call.method)).toContain("delete");
    expect(remove.calls).toContainEqual({ method: "eq", args: ["id", PERIOD_ID] });
  });

  it("scopes milestone create, update and delete", async () => {
    const input = {
      label: "Formulation assessment",
      dueKind: "fte-months" as const,
      dueFteMonths: 12.5,
      dueOn: null,
      completedOn: null,
    };
    const { client, chains } = fakeClient({
      cme_training_milestones: [
        { data: null, error: null, count: 0 },
        { data: milestoneRow, error: null },
        { data: milestoneRow, error: null },
        { data: [{ id: MILESTONE_ID }], error: null },
      ],
    });
    await createOwnerTrainingMilestone(client, OWNER, input);
    await updateOwnerTrainingMilestone(client, OWNER, MILESTONE_ID, input);
    await deleteOwnerTrainingMilestone(client, OWNER, MILESTONE_ID);
    expect(chains).toHaveLength(4);
    for (const chain of chains) {
      const isInsert = chain.calls.some((call) => call.method === "insert");
      if (isInsert) expect(insertedOwner(chain)).toBe(OWNER);
      else expect(ownerScoped(chain)).toBe(true);
    }
  });

  it("refuses to run without an owner", async () => {
    const { client, chains } = fakeClient({});
    await expect(fetchOwnerTrainingPeriods(client, "")).rejects.toThrow(/without an ownerId/);
    expect(chains).toHaveLength(0);
  });
});

describe("timeline checks before a period write", () => {
  it("rejects a rotation that overlaps an existing one, and writes nothing", async () => {
    const { client, chains } = fakeClient({ cme_training_periods: [{ data: [periodRow], error: null }] });
    const overlapping = { ...rotationInput, startsOn: "2026-07-01" };
    const failure = await createOwnerTrainingPeriod(client, OWNER, overlapping).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PublicApiError);
    expect((failure as PublicApiError).status).toBe(400);
    expect((failure as PublicApiError).message).toMatch(/overlap/);
    expect(chains).toHaveLength(1);
    expect(chains[0].calls.map((call) => call.method)).not.toContain("insert");
  });

  it("rejects an update that would make two rotations overlap", async () => {
    const other = { ...periodRow, id: "44444444-4444-4444-8444-444444444444", starts_on: "2026-08-03", ends_on: null };
    const { client, chains } = fakeClient({ cme_training_periods: [{ data: [periodRow, other], error: null }] });
    await expect(
      updateOwnerTrainingPeriod(client, OWNER, PERIOD_ID, { ...rotationInput, startsOn: "2026-02-02", endsOn: null }),
    ).rejects.toThrow(/overlap/);
    expect(chains).toHaveLength(1);
  });

  it("says not found when updating a period the owner does not have", async () => {
    const { client } = fakeClient({ cme_training_periods: [{ data: [], error: null }] });
    await expect(updateOwnerTrainingPeriod(client, OWNER, PERIOD_ID, rotationInput)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("says not found when a delete matches nothing", async () => {
    const { client } = fakeClient({ cme_training_milestones: [{ data: [], error: null }] });
    await expect(deleteOwnerTrainingMilestone(client, OWNER, MILESTONE_ID)).rejects.toMatchObject({ status: 404 });
  });
});
