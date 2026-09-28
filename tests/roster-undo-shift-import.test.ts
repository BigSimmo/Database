import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { undoShiftImport } from "@/lib/roster/shifts/repository";

type Call = { table: string; op: string; filters: string[] };

function fakeClient(opts: { ownImportedAt: string | null; newerIds: string[] }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      const chain =
        (name: string) =>
        (...args: unknown[]) => {
          call.filters.push(`${name}:${args.join(",")}`);
          return builder;
        };
      for (const name of ["eq", "neq", "gt", "gte", "lt", "is", "limit"]) builder[name] = chain(name);
      builder.select = () => builder;
      builder.delete = () => {
        call.op = "delete";
        return builder;
      };
      builder.maybeSingle = async () => ({
        data: opts.ownImportedAt ? { imported_at: opts.ownImportedAt } : null,
        error: null,
      });
      builder.then = (resolve: (value: unknown) => unknown) =>
        resolve(call.op === "delete" ? { error: null } : { data: opts.newerIds.map((id) => ({ id })), error: null });
      return builder;
    },
  };
  return { client, calls };
}

const undo = { importId: "imp-1", workplace: "Example Hospital", windowStart: "2026-10-01", windowEnd: "2026-10-14" };
const owner = "00000000-0000-4000-8000-000000000001";

describe("undoShiftImport", () => {
  it("keeps the shifts when a newer import for the workplace landed meanwhile", async () => {
    const { client, calls } = fakeClient({ ownImportedAt: "2026-10-01T00:00:00Z", newerIds: ["imp-2"] });
    await undoShiftImport(client as never, owner, undo);
    expect(calls.some((call) => call.table === "on_call_shifts")).toBe(false);
    expect(calls.at(-1)).toMatchObject({ table: "on_call_shift_imports", op: "delete" });
  });

  it("removes the stale refresh's window rows when nothing newer exists", async () => {
    const { client, calls } = fakeClient({ ownImportedAt: "2026-10-01T00:00:00Z", newerIds: [] });
    await undoShiftImport(client as never, owner, undo);
    expect(calls.find((call) => call.table === "on_call_shifts")).toMatchObject({ op: "delete" });
  });
});
