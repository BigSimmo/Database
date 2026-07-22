import { describe, expect, it } from "vitest";
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
