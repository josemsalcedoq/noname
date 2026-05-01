import { useMutation, useQuery } from "@tanstack/react-query";

import { postJson } from "../../lib/api";

export type Mode = "video" | "audio-only";
export type JobStatus = "pending" | "running" | "done" | "error" | "cancelled";

export interface ProbeResult {
  title: string | null;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
  available_qualities: string[];
}

export interface Job {
  id: string;
  url: string;
  mode: Mode;
  quality: string;
  status: JobStatus;
  progress: number;
  file_path: string;
  error: string;
  started_at: string;
  finished_at: string | null;
}

export function useProbe() {
  return useMutation({
    mutationFn: (url: string) =>
      postJson<{ url: string }, ProbeResult>("/api/youtube-downloader/probe", { url }),
  });
}

export function useStartDownload() {
  return useMutation({
    mutationFn: (input: { url: string; mode: Mode; quality: string }) =>
      postJson<typeof input, Job>("/api/youtube-downloader/download", input),
  });
}

export function useCancel() {
  return useMutation({
    mutationFn: (jobId: string) =>
      fetch(`/api/youtube-downloader/cancel/${jobId}`, { method: "POST" }).then((res) => {
        if (!res.ok) throw new Error("Cancel failed");
        return res.json() as Promise<Job>;
      }),
  });
}

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ["youtube-job", jobId],
    queryFn: async (): Promise<Job> => {
      const res = await fetch(`/api/youtube-downloader/progress/${jobId}`);
      if (!res.ok) throw new Error("Progress fetch failed");
      return res.json();
    },
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const job = query.state.data as Job | undefined;
      if (!job) return 800;
      return ["done", "error", "cancelled"].includes(job.status) ? false : 800;
    },
  });
}
