import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Person, PaginatedResponse, SourceOfWealth } from "@/types";

// Query key factory
export const personKeys = {
  all: ["people"] as const,
  lists: () => [...personKeys.all, "list"] as const,
  list: (filters: Record<string, string>) => [...personKeys.lists(), filters] as const,
  details: () => [...personKeys.all, "detail"] as const,
  detail: (id: string) => [...personKeys.details(), id] as const,
  sourcesOfWealth: (personId: string) => [...personKeys.all, "sourcesOfWealth", personId] as const,
  auditLog: (personId: string) => [...personKeys.all, "auditLog", personId] as const,
};

// Audit log types
export interface PersonAuditLogEntry {
  id: string;
  person: string;
  model_name: string;
  record_id: string | null;
  action: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  source: string;
  comment: string;
  created_at: string;
}

// Raw API functions
async function fetchPeople(filters: Record<string, string> = {}) {
  const params: Record<string, string> = { per_page: "100", ...filters };
  return api.get<PaginatedResponse<Person>>("/core/persons/", params);
}

async function fetchPerson(id: string) {
  return api.get<Person>(`/core/persons/${id}/`);
}

async function createPerson(data: Record<string, unknown>) {
  return api.post<Person>("/core/persons/", data);
}

async function updatePerson(id: string, data: Record<string, unknown>) {
  return api.patch<Person>(`/core/persons/${id}/`, data);
}

// React hooks
export function usePeople(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: personKeys.list(filters),
    queryFn: () => fetchPeople(filters),
  });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: personKeys.detail(id),
    queryFn: () => fetchPerson(id),
    enabled: !!id,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createPerson(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personKeys.lists() });
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updatePerson(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: personKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: personKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// Sources of Wealth
// ---------------------------------------------------------------------------

export function usePersonSourcesOfWealth(personId: string, enabled = true) {
  return useQuery({
    queryKey: personKeys.sourcesOfWealth(personId),
    queryFn: () =>
      api.get<PaginatedResponse<SourceOfWealth>>("/core/sources-of-wealth/", {
        person_id: personId,
        per_page: "100",
      }),
    enabled: !!personId && enabled,
  });
}

export function useCreateSourceOfWealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<SourceOfWealth>("/core/sources-of-wealth/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

export function useDeleteSourceOfWealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/sources-of-wealth/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export function usePersonAuditLog(
  personId: string,
  filters: { source?: string } = {},
) {
  const params: Record<string, string> = { per_page: "100" };
  if (filters.source) params.source = filters.source;

  return useQuery({
    queryKey: personKeys.auditLog(personId),
    queryFn: () =>
      api.get<PaginatedResponse<PersonAuditLogEntry>>(
        `/core/persons/${personId}/audit-log/`,
        params,
      ),
    enabled: !!personId,
  });
}
