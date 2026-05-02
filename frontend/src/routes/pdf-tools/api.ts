import { useMutation } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";

export interface ExtractTextResult {
  pages: string[];
  text: string;
  page_count: number;
  languages?: string;
}

async function postMultipart<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(path, { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
    throw new ApiError(
      response.status,
      (payload.detail as string | undefined) ?? `HTTP ${response.status}`,
      payload.error as string | undefined,
    );
  }
  return (await response.json()) as T;
}

async function postMultipartBlob(path: string, body: FormData): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(path, { method: "POST", body });
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
  const filename = match?.[1] ?? "result";
  return { blob: await response.blob(), filename };
}

export function useMergePdfs() {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      return postMultipartBlob("/api/pdf-tools/merge", body);
    },
  });
}

export function useSplitPdf() {
  return useMutation({
    mutationFn: async (input: { file: File; ranges: string }) => {
      const body = new FormData();
      body.append("file", input.file);
      body.append("ranges", input.ranges);
      return postMultipartBlob("/api/pdf-tools/split", body);
    },
  });
}

export function useExtractText() {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return postMultipart<ExtractTextResult>("/api/pdf-tools/extract-text", body);
    },
  });
}

export interface ThumbnailsResult {
  page_count: number;
  thumbnails: string[];
}

export type PageOperation =
  | { source: number; rotation: 0 | 90 | 180 | 270 }
  | { blank: true; width?: number; height?: number };

export function useThumbnails() {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return postMultipart<ThumbnailsResult>("/api/pdf-tools/thumbnails", body);
    },
  });
}

export function useManipulate() {
  return useMutation({
    mutationFn: async (input: { file: File; operations: PageOperation[] }) => {
      const body = new FormData();
      body.append("file", input.file);
      body.append("operations", JSON.stringify(input.operations));
      return postMultipartBlob("/api/pdf-tools/manipulate", body);
    },
  });
}

export interface FormField {
  name: string;
  kind: string;
  value: string;
}

export function useDiscoverFields() {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return postMultipart<{ fields: FormField[] }>("/api/pdf-tools/form/fields", body);
    },
  });
}

export function useFillForm() {
  return useMutation({
    mutationFn: async (input: { file: File; values: Record<string, string> }) => {
      const body = new FormData();
      body.append("file", input.file);
      body.append("values", JSON.stringify(input.values));
      return postMultipartBlob("/api/pdf-tools/form/fill", body);
    },
  });
}

export interface PdfAnnotation {
  page: number;
  x: number;
  y: number;
  text: string;
  color?: "yellow" | "red" | "blue";
}

export function useAnnotate() {
  return useMutation({
    mutationFn: async (input: { file: File; annotations: PdfAnnotation[] }) => {
      const body = new FormData();
      body.append("file", input.file);
      body.append("annotations", JSON.stringify(input.annotations));
      return postMultipartBlob("/api/pdf-tools/annotate", body);
    },
  });
}

export function useMakeSearchable() {
  return useMutation({
    mutationFn: async (input: { file: File; languages: string }) => {
      const body = new FormData();
      body.append("file", input.file);
      body.append("languages", input.languages);
      return postMultipartBlob("/api/pdf-tools/searchable", body);
    },
  });
}

export function useOcrPdf() {
  return useMutation({
    mutationFn: async (input: { file: File; languages: string }) => {
      const body = new FormData();
      body.append("file", input.file);
      body.append("languages", input.languages);
      return postMultipart<ExtractTextResult>("/api/pdf-tools/ocr", body);
    },
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
