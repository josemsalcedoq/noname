import { useMutation } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";

export type Lang = "en" | "es";

export interface TranslateSrtArgs {
  file: File;
  source: Lang;
  target: Lang;
}

export interface TranslateSrtResult {
  blob: Blob;
  filename: string;
}

async function translateSrt({ file, source, target }: TranslateSrtArgs): Promise<TranslateSrtResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("source", source);
  body.append("target", target);

  const response = await fetch("/api/srt-translator/translate", { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
    throw new ApiError(
      response.status,
      (payload.detail as string | undefined) ?? `HTTP ${response.status}`,
      payload.error as string | undefined,
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match?.[1] ?? `${file.name.replace(/\.srt$/i, "")}_${target}.srt`;
  const blob = await response.blob();
  return { blob, filename };
}

export function useTranslateSrt() {
  return useMutation({ mutationFn: translateSrt });
}

export function downloadResult({ blob, filename }: TranslateSrtResult) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
