import { PublicApiError } from "@/lib/http";

export const maxClinicalAskAudioBytes = 10 * 1024 * 1024;
export const maxClinicalAskRecordingMs = 60_000;
export const clinicalAskAudioMimeTypes = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

export function validateSpeechTranscriptionForm(formData: FormData) {
  const audio = formData.get("audio");
  if (!(audio instanceof File))
    throw new PublicApiError("An audio recording is required.", 400, { code: "missing_audio" });
  if (!clinicalAskAudioMimeTypes.has(audio.type.toLowerCase()))
    throw new PublicApiError("The audio format is not supported.", 415, { code: "unsupported_audio" });
  if (audio.size === 0) throw new PublicApiError("The audio recording is empty.", 400, { code: "empty_audio" });
  if (audio.size > maxClinicalAskAudioBytes)
    throw new PublicApiError("The audio recording exceeds 10 MiB.", 413, { code: "audio_too_large" });
  const rawDuration = formData.get("durationMs");
  const durationMs = rawDuration === null || rawDuration === "" ? null : Number(rawDuration);
  if (
    durationMs !== null &&
    (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > maxClinicalAskRecordingMs)
  )
    throw new PublicApiError("The recording duration is invalid.", 400, { code: "invalid_audio_duration" });
  return { audio, durationMs };
}
