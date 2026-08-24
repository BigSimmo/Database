import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { jsonError, PublicApiError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { transcribeClinicalAskAudio } from "@/lib/openai";
import { publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { validateSpeechTranscriptionForm } from "@/lib/validation/speech-transcription-request";

export const runtime = "nodejs";
const transcriptionTimeoutMs = 30_000;
const noStore = (response: Response) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "speech_transcription",
      allowInMemoryFallbackOnUnavailable: false,
    });
    if (rateLimit.limited)
      return noStore(
        rateLimitJsonResponse("Too many transcription requests. Retry shortly.", rateLimit, {
          bucket: "speech_transcription",
        }),
      );
    if (request.signal.aborted) throw new PublicApiError("Transcription cancelled.", 499, { code: "client_cancelled" });
    const formData = await request.formData().catch(() => {
      throw new PublicApiError("Invalid transcription form data.", 400, { code: "invalid_form_data" });
    });
    const { audio, durationMs } = validateSpeechTranscriptionForm(formData);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(transcriptionTimeoutMs)]);
    const result = await transcribeClinicalAskAudio(audio, signal, transcriptionTimeoutMs);
    return Response.json({ transcript: result.transcript, durationMs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return noStore(unauthorizedResponse(error));
    if (error instanceof PublicApiError) return noStore(jsonError(error, error.status));
    const aborted = request.signal.aborted || (error instanceof Error && error.name === "AbortError");
    logger.warn("Speech transcription failed", { aborted, category: "provider_or_timeout" });
    return noStore(
      jsonError(
        new PublicApiError(
          aborted ? "Transcription was cancelled." : "Transcription is temporarily unavailable.",
          aborted ? 499 : 502,
          { code: aborted ? "client_cancelled" : "transcription_unavailable" },
        ),
        aborted ? 499 : 502,
      ),
    );
  }
}
