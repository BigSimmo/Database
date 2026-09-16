import { describe, expect, it, vi } from "vitest";
import {
  formatSupabaseUnavailableError,
  isSupabaseUnavailableError,
  probeSupabaseHealth,
} from "../src/lib/supabase/health";

describe("Supabase health helpers", () => {
  it("classifies gateway HTML and timeout errors as unavailable", () => {
    expect(isSupabaseUnavailableError(new Error("<title>supabase.co | 522: Connection timed out</title>"))).toBe(true);
    expect(isSupabaseUnavailableError(new Error("Connection terminated due to connection timeout"))).toBe(true);
    expect(isSupabaseUnavailableError(new Error("canceling statement due to statement timeout"))).toBe(true);
    expect(isSupabaseUnavailableError(new Error("permission denied for table documents"))).toBe(false);
  });

  it("formats HTML gateway responses without dumping the page body", () => {
    expect(formatSupabaseUnavailableError("<html><title>supabase.co | 522: Connection timed out</title></html>")).toBe(
      "Supabase is temporarily unavailable (supabase.co | 522: Connection timed out).",
    );
  });

  it("probes with one lightweight table read", async () => {
    const calls: Array<{ table: string; columns: string }> = [];
    const supabase = {
      from(table: string) {
        return {
          select(columns: string) {
            calls.push({ table, columns });
            return {
              async limit() {
                return { error: null };
              },
            };
          },
        };
      },
    };

    await expect(probeSupabaseHealth(supabase)).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([{ table: "import_batches", columns: "id" }]);
  });

  it("fails closed for returned permission, credential, and relation errors", async () => {
    for (const message of [
      "permission denied for table import_batches",
      "invalid JWT",
      'relation "public.import_batches" does not exist',
    ]) {
      const supabase = {
        from() {
          return {
            select() {
              return {
                async limit() {
                  return { error: { message } };
                },
              };
            },
          };
        },
      };

      await expect(probeSupabaseHealth(supabase)).resolves.toMatchObject({
        ok: false,
        failureKind: "query",
        message: "Supabase health check failed.",
        rawMessage: message,
      });
    }
  });

  it("fails closed when the dependency probe throws", async () => {
    const supabase = {
      from() {
        throw new Error("credential validation failed");
      },
    };

    await expect(probeSupabaseHealth(supabase as never)).resolves.toMatchObject({
      ok: false,
      failureKind: "query",
      message: "Supabase health check failed.",
      rawMessage: "credential validation failed",
    });
  });

  it("preserves the existing actionable message for recognized availability failures", async () => {
    const message = "Supabase API returned 522";
    const supabase = {
      from() {
        return {
          select() {
            return {
              async limit() {
                return { error: { message } };
              },
            };
          },
        };
      },
    };

    await expect(probeSupabaseHealth(supabase)).resolves.toMatchObject({
      ok: false,
      failureKind: "unavailable",
      message: "Supabase API is timing out with a 522 response.",
      rawMessage: message,
    });
  });
});

/**
 * The deadline that keeps the deploy gate answerable.
 *
 * This probe is the only database call left on `/api/health/ready`, which is Railway's
 * healthcheck target, and Railway allows each attempt ten seconds. A one-row select is cheap
 * warm, but a cold container has no warm connection, no cached plan and a cold PostgREST schema
 * cache, and an unbounded call has no way to answer before the gate gives up — a deployment that
 * cannot answer is discarded and rolled back.
 *
 * The classification matters as much as the bound. An abort matches none of the provider error
 * patterns, so without explicit handling a deadline would be filed as a query fault and send the
 * next investigation looking for a broken table.
 */
describe("the probe's optional deadline", () => {
  const clientWith = (limit: () => unknown) => ({
    from: () => ({ select: () => ({ limit }) }),
  });

  it("cancels the in-flight request when the client can, rather than abandoning the promise", async () => {
    const controller = new AbortController();
    const abortSignal = vi.fn(async () => ({ error: null }));
    const limit = () => Object.assign(Promise.resolve({ error: null }), { abortSignal });

    const result = await probeSupabaseHealth(clientWith(limit) as never, controller.signal);

    expect(result.ok).toBe(true);
    expect(abortSignal, "an abandoned promise leaves the query running on the database").toHaveBeenCalledWith(
      controller.signal,
    );
  });

  it("reports an expired deadline as unavailable, not as a query fault", async () => {
    const signal = AbortSignal.abort(
      Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }),
    );

    const result = await probeSupabaseHealth(clientWith(async () => ({ error: null })) as never, signal);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failureKind, "a deadline is not a broken table").toBe("unavailable");
    expect(result.message).toContain("deadline");
  });

  it("still works for the many callers that pass no deadline at all", async () => {
    const result = await probeSupabaseHealth(clientWith(async () => ({ error: null })) as never);

    expect(result.ok).toBe(true);
  });
});
