import { useMutation } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";

export type ModelSize = "tiny" | "base" | "small" | "medium";

export interface TranscribeArgs {
  file: File;
  model_size: ModelSize;
  language: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  language: string;
  duration: number;
  segments: Segment[];
  text: string;
  srt: string;
}

async function transcribe({ file, model_size, language }: TranscribeArgs): Promise<TranscriptionResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("model_size", model_size);
  body.append("language", language);

  const response = await fetch("/api/audio-transcriber/transcribe", { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
    throw new ApiError(
      response.status,
      (payload.detail as string | undefined) ?? `HTTP ${response.status}`,
      payload.error as string | undefined,
    );
  }
  return (await response.json()) as TranscriptionResult;
}

export function useTranscribe() {
  return useMutation({ mutationFn: transcribe });
}
