import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";

export interface CatalogSkill {
  name: string;
  description: string;
  license: string;
  html_url: string;
  skill_md_url: string;
  installed: boolean;
  install_path: string | null;
}

export interface InstallSteps {
  name: string;
  steps: string[];
  oneliner: string;
}

const CATALOG_URL = "/api/skills/catalog";
const INSTALLED_URL = "/api/skills/installed";
const STEPS_URL = "/api/skills/install-steps";

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

export function useCatalog() {
  return useQuery({
    queryKey: ["skills-catalog"],
    queryFn: () => fetchJson<{ skills: CatalogSkill[] }>(CATALOG_URL),
    staleTime: 5 * 60_000,
  });
}

export function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson<{ skills: CatalogSkill[] }>(`${CATALOG_URL}?refresh=true`),
    onSuccess: (data) => queryClient.setQueryData(["skills-catalog"], data),
  });
}

export function useInstallSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<{ name: string; install_path: string }>(`${INSTALLED_URL}/${name}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skills-catalog"] }),
  });
}

export function useUninstallSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => fetchJson<void>(`${INSTALLED_URL}/${name}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skills-catalog"] }),
  });
}

export function useInstallSteps(name: string | null) {
  return useQuery({
    queryKey: ["skills-install-steps", name],
    queryFn: () => fetchJson<InstallSteps>(`${STEPS_URL}/${name}`),
    enabled: name !== null,
    staleTime: Infinity,
  });
}
