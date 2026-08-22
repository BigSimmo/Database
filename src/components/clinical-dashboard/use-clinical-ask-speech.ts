"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clinicalAskAudioMimeTypes,
  maxClinicalAskAudioBytes,
  maxClinicalAskRecordingMs,
} from "@/lib/validation/speech-transcription-request";

export type ClinicalAskSpeechState =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "stopping"
  | "transcribing"
  | "ready_to_review"
  | "permission_denied"
  | "unsupported"
  | "failed"
  | "cancelled";

export function useClinicalAskSpeech() {
  const [state, setState] = useState<ClinicalAskSpeechState>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const retryBlob = useRef<Blob | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const cancelled = useRef(false);

  const dispose = useCallback((dropBlob = true) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
    chunks.current = [];
    if (dropBlob) retryBlob.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    if (!blob.size || blob.size > maxClinicalAskAudioBytes) {
      retryBlob.current = null;
      setCanRetry(false);
      setError(blob.size ? "The recording is too large." : "No audio was recorded.");
      setState("failed");
      return;
    }
    retryBlob.current = blob;
    controller.current?.abort();
    controller.current = new AbortController();
    setState("transcribing");
    try {
      const form = new FormData();
      form.set("audio", new File([blob], "recording", { type: blob.type }));
      form.set("durationMs", String(Math.min(maxClinicalAskRecordingMs, Date.now() - startedAt.current)));
      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: form,
        signal: controller.current.signal,
      });
      if (!response.ok) throw new Error("failed");
      const payload = (await response.json()) as { transcript?: unknown };
      if (typeof payload.transcript !== "string") throw new Error("failed");
      setTranscript(payload.transcript);
      setError(null);
      setState("ready_to_review");
      retryBlob.current = null;
      setCanRetry(false);
    } catch (cause) {
      if ((cause as { name?: string }).name === "AbortError") return;
      setError("Transcription failed. You can retry.");
      setCanRetry(true);
      setState("failed");
    }
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    setState("stopping");
    recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setState("unsupported");
    setError(null);
    setCanRetry(false);
    cancelled.current = false;
    setState("requesting_permission");
    try {
      const mime = [...clinicalAskAudioMimeTypes].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      if (!mime) return setState("unsupported");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const active = new MediaRecorder(stream.current, { mimeType: mime });
      recorder.current = active;
      chunks.current = [];
      startedAt.current = Date.now();
      setElapsedMs(0);
      active.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
        if (chunks.current.reduce((total, chunk) => total + chunk.size, 0) > maxClinicalAskAudioBytes) stop();
      };
      active.onstop = () => {
        const blob = new Blob(chunks.current, { type: mime });
        dispose(false);
        if (!cancelled.current) void transcribe(blob);
      };
      active.start();
      setState("listening");
      timer.current = setInterval(() => {
        const elapsed = Date.now() - startedAt.current;
        setElapsedMs(Math.min(elapsed, maxClinicalAskRecordingMs));
        if (elapsed >= maxClinicalAskRecordingMs) stop();
      }, 250);
    } catch (cause) {
      dispose();
      setState((cause as { name?: string }).name === "NotAllowedError" ? "permission_denied" : "failed");
    }
  }, [dispose, stop, transcribe]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    controller.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    dispose();
    setCanRetry(false);
    setState("cancelled");
  }, [dispose]);
  const reset = useCallback(() => {
    controller.current?.abort();
    dispose();
    setTranscript("");
    setElapsedMs(0);
    setError(null);
    setCanRetry(false);
    setState("idle");
  }, [dispose]);
  const retryTranscription = useCallback(() => {
    if (retryBlob.current) void transcribe(retryBlob.current);
  }, [transcribe]);
  useEffect(
    () => () => {
      cancelled.current = true;
      controller.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      dispose();
    },
    [dispose],
  );
  return {
    state,
    transcript,
    setTranscript,
    elapsedMs,
    error,
    canRetry: state === "failed" && canRetry,
    start,
    stop,
    retryTranscription,
    cancel,
    reset,
  };
}
