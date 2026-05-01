import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, postJson } from "../../lib/api";

export interface Note {
  id: number;
  title: string;
  body: string;
  tags: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: number;
  title: string;
  body: string;
  tags: string[];
  due_at: string | null;
  remind_at: string | null;
  last_fired_at: string | null;
  completed_at: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

const NOTES_URL = "/api/personal-hub/notes";
const TODOS_URL = "/api/personal-hub/todos";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`);
  return response.json();
}

async function patchJson<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`);
  return response.json();
}

async function deleteResource(url: string): Promise<void> {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`);
}

async function postAction<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`);
  return response.json();
}

export function useNotes(params: { search?: string; archived?: boolean }) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("q", params.search);
  if (params.archived) qs.set("archived", "true");
  return useQuery({
    queryKey: ["notes", params.search ?? "", params.archived ? "archived" : "active"],
    queryFn: () => getJson<Note[]>(`${NOTES_URL}?${qs.toString()}`),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; tags: string[] }) =>
      postJson<typeof input, Note>(NOTES_URL, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useArchiveNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAction<Note>(`${NOTES_URL}/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUnarchiveNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAction<Note>(`${NOTES_URL}/${id}/unarchive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteResource(`${NOTES_URL}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number; title?: string; body?: string; tags?: string[] }) =>
      patchJson<Note>(`${NOTES_URL}/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useTodos(params: { status: "open" | "done" }) {
  const qs = new URLSearchParams({ status: params.status });
  return useQuery({
    queryKey: ["todos", params.status],
    queryFn: () => getJson<Todo[]>(`${TODOS_URL}?${qs.toString()}`),
  });
}

interface CreateTodoInput {
  title: string;
  due_at?: string | null;
  remind_at?: string | null;
}

interface CreateTodoBody extends CreateTodoInput {
  body: string;
  tags: string[];
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoInput) =>
      postJson<CreateTodoBody, Todo>(TODOS_URL, { body: "", tags: [], ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useCompleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAction<Todo>(`${TODOS_URL}/${id}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useReopenTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAction<Todo>(`${TODOS_URL}/${id}/reopen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteResource(`${TODOS_URL}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
}
