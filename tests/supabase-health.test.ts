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
});
