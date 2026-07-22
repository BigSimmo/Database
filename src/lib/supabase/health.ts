type SupabaseProbeClient = {
  from(table: string): {
    select(
      columns: string,
      options?: Record<string, unknown>,
    ): {
      limit(
        count: number,
      ): PromiseLike<{ error: { message?: string; code?: string; details?: string; hint?: string } | null }>;
    };
  };
};

export type SupabaseHealthResult =
  { ok: true; checkedAt: string } | { ok: false; checkedAt: string; message: string; rawMessage: string };

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

export function isSupabaseUnavailableError(error: unknown) {
  const message = errorMessage(error);
  return /<!doctype html|<html[\s>]|522|544|504|520|connection terminated|connection timeout|statement timeout|fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(
    message,
  );
}

export function formatSupabaseUnavailableError(error: unknown) {
  const message = errorMessage(error);
  const title = message
    .match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  if (title) return `Supabase is temporarily unavailable (${title}).`;
  if (/connection terminated/i.test(message)) return "Supabase SQL connection was terminated due to a timeout.";
  if (/statement timeout/i.test(message)) return "Supabase cancelled the query due to statement timeout.";
  if (/544/.test(message)) return "Supabase Storage is timing out with a 544 response.";
  if (/522/.test(message)) return "Supabase API is timing out with a 522 response.";
  if (/504/.test(message)) return "Supabase API is timing out with a 504 response.";
  return message
    ? `Supabase is temporarily unavailable: ${message.slice(0, 240)}`
    : "Supabase is temporarily unavailable.";
}

export async function probeSupabaseHealth(supabase: SupabaseProbeClient): Promise<SupabaseHealthResult> {
  const checkedAt = new Date().toISOString();
  try {
    const { error } = await supabase.from("import_batches").select("id").limit(1);
    if (!error) return { ok: true, checkedAt };
    return {
      ok: false,
      checkedAt,
      message: isSupabaseUnavailableError(error)
        ? formatSupabaseUnavailableError(error)
        : "Supabase health check failed.",
      rawMessage: errorMessage(error),
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      message: isSupabaseUnavailableError(error)
        ? formatSupabaseUnavailableError(error)
        : "Supabase health check failed.",
      rawMessage: errorMessage(error),
    };
  }
}

export function assertSupabaseHealthy(result: SupabaseHealthResult, action: string) {
  if (result.ok) return;
  throw new Error(`${action} is paused because ${result.message}`);
}
