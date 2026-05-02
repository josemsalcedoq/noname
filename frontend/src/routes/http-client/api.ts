import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, postJson } from "../../lib/api";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type BodyType = "none" | "raw" | "json" | "urlencoded";

export interface KeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface Collection {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  collection: number;
  parent: number | null;
  name: string;
  position: number;
}

export interface RequestNode {
  id: number;
  collection: number;
  folder: number | null;
  name: string;
  method: Method;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  body_type: BodyType;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentRecord {
  id: number;
  name: string;
  variables: KeyValue[];
}

export interface TreeFolder {
  id: number;
  name: string;
  kind: "folder";
  position: number;
  children: TreeNode[];
}

export interface TreeRequest {
  id: number;
  name: string;
  kind: "request";
  method: Method;
  position: number;
}

export type TreeNode = TreeFolder | TreeRequest;

export interface CollectionTree {
  id: number;
  name: string;
  items: TreeNode[];
}

export interface SendResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  duration_ms: number;
  size_bytes: number;
  truncated: boolean;
  resolved_url: string;
  unknown_vars: string[];
}

const ROOT = "/api/http-client";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
    throw new ApiError(
      response.status,
      (payload.detail as string | undefined) ?? `HTTP ${response.status}`,
      payload.error as string | undefined,
    );
  }
  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

async function patchJson<T>(url: string, body: object): Promise<T> {
  return fetchJson<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteResource(url: string): Promise<void> {
  await fetchJson<void>(url, { method: "DELETE" });
}

export function useCollections() {
  return useQuery({
    queryKey: ["http-client", "collections"],
    queryFn: () => fetchJson<Collection[]>(`${ROOT}/collections`),
  });
}

export function useCollectionTree(collectionId: number | null) {
  return useQuery({
    queryKey: ["http-client", "tree", collectionId],
    queryFn: () => fetchJson<CollectionTree>(`${ROOT}/collections/${collectionId}/tree`),
    enabled: collectionId !== null,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      postJson<typeof input, Collection>(`${ROOT}/collections`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["http-client", "collections"] }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteResource(`${ROOT}/collections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["http-client"] }),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { collection: number; parent: number | null; name: string }) =>
      postJson<typeof input, Folder>(`${ROOT}/folders`, input),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["http-client", "tree", vars.collection] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteResource(`${ROOT}/folders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["http-client"] }),
  });
}

export function useRequest(requestId: number | null) {
  return useQuery({
    queryKey: ["http-client", "request", requestId],
    queryFn: () => fetchJson<RequestNode>(`${ROOT}/requests/${requestId}`),
    enabled: requestId !== null,
  });
}

interface CreateRequestInput {
  collection: number;
  folder: number | null;
  name: string;
  method: Method;
  url: string;
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequestInput) =>
      postJson<
        CreateRequestInput & { headers: KeyValue[]; params: KeyValue[]; body: string; body_type: BodyType },
        RequestNode
      >(`${ROOT}/requests`, { ...input, headers: [], params: [], body: "", body_type: "none" }),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["http-client", "tree", vars.collection] }),
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<RequestNode>) =>
      patchJson<RequestNode>(`${ROOT}/requests/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["http-client", "tree", data.collection] });
      qc.setQueryData(["http-client", "request", data.id], data);
    },
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteResource(`${ROOT}/requests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["http-client"] }),
  });
}

export function useEnvironments() {
  return useQuery({
    queryKey: ["http-client", "environments"],
    queryFn: () => fetchJson<EnvironmentRecord[]>(`${ROOT}/environments`),
  });
}

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; variables: KeyValue[] }) =>
      postJson<typeof input, EnvironmentRecord>(`${ROOT}/environments`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["http-client", "environments"] }),
  });
}

export interface SendInput {
  method: Method;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  body_type: BodyType;
  environment_id?: number | null;
}

export function useSend() {
  return useMutation({
    mutationFn: (input: SendInput) => postJson<SendInput, SendResponse>(`${ROOT}/send`, input),
  });
}

export function useImportPostman() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${ROOT}/collections/import`, { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
        throw new ApiError(
          response.status,
          (payload.detail as string | undefined) ?? `HTTP ${response.status}`,
          payload.error as string | undefined,
        );
      }
      return (await response.json()) as Collection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["http-client", "collections"] }),
  });
}
