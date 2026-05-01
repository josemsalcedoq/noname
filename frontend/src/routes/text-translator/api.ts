import { useMutation } from "@tanstack/react-query";

import { postJson } from "../../lib/api";

export type SourceLang = "en" | "es" | "auto";
export type TargetLang = "en" | "es";

export interface TranslateRequest {
  source: SourceLang;
  target: TargetLang;
  text: string;
}

export interface TranslateResponse {
  text: string;
  detected_source?: string | null;
}

export function useTranslateText() {
  return useMutation({
    mutationFn: (request: TranslateRequest) =>
      postJson<TranslateRequest, TranslateResponse>(
        "/api/text-translator/translate",
        request,
      ),
  });
}
