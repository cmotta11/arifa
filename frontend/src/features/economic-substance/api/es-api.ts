import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse, EconomicSubstanceSubmission } from "@/types";

export type { EconomicSubstanceSubmission };

export interface AdvanceStepInput {
  step_key: string;
  answer: unknown;
}

export interface RejectInput {
  field_comments?: Record<string, unknown>;
}

// ─── Query Key Factories ────────────────────────────────────────────────────

export const esKeys = {
  all: ["economicSubstance"] as const,
  list: (params?: Record<string, string>) =>
    [...esKeys.all, "list", params] as const,
  detail: (id: string) => [...esKeys.all, "detail", id] as const,
  guest: (id: string) => [...esKeys.all, "guest", id] as const,
};

// ─── Raw API Functions ──────────────────────────────────────────────────────

async function fetchESList(
  params?: Record<string, string>,
): Promise<PaginatedResponse<EconomicSubstanceSubmission>> {
  return api.get<PaginatedResponse<EconomicSubstanceSubmission>>(
    "/compliance/es-submissions/",
    params,
  );
}

async function fetchESDetail(
  id: string,
): Promise<EconomicSubstanceSubmission> {
  return api.get<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/`,
  );
}

async function createES(body: {
  entity: string;
  fiscal_year: number;
}): Promise<EconomicSubstanceSubmission> {
  return api.post<EconomicSubstanceSubmission>(
    "/compliance/es-submissions/",
    body,
  );
}

async function updateES(
  id: string,
  body: Partial<EconomicSubstanceSubmission>,
): Promise<EconomicSubstanceSubmission> {
  return api.patch<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/`,
    body,
  );
}

async function advanceESStep(
  id: string,
  body: AdvanceStepInput,
): Promise<EconomicSubstanceSubmission> {
  return api.post<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/advance-step/`,
    body,
  );
}

async function submitES(id: string): Promise<EconomicSubstanceSubmission> {
  return api.post<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/submit/`,
  );
}

async function approveES(id: string): Promise<EconomicSubstanceSubmission> {
  return api.post<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/approve/`,
  );
}

async function rejectES(
  id: string,
  body?: RejectInput,
): Promise<EconomicSubstanceSubmission> {
  return api.post<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/reject/`,
    body,
  );
}

async function bulkCreateES(body: {
  fiscal_year: number;
}): Promise<EconomicSubstanceSubmission[]> {
  return api.post<EconomicSubstanceSubmission[]>(
    "/compliance/es-submissions/bulk-create/",
    body,
  );
}

// Guest API functions

async function fetchGuestESDetail(
  id: string,
): Promise<EconomicSubstanceSubmission> {
  return api.get<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/guest/`,
  );
}

async function saveGuestESDraft(
  id: string,
  body: Partial<EconomicSubstanceSubmission>,
): Promise<EconomicSubstanceSubmission> {
  return api.patch<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/guest/`,
    body,
  );
}

async function submitGuestES(
  id: string,
): Promise<EconomicSubstanceSubmission> {
  return api.post<EconomicSubstanceSubmission>(
    `/compliance/es-submissions/${id}/guest/submit/`,
  );
}

// ─── Staff Query Hooks ──────────────────────────────────────────────────────

export function useESSubmissions(filters?: Record<string, string>) {
  return useQuery({
    queryKey: esKeys.list(filters),
    queryFn: () => fetchESList(filters),
  });
}

export function useESDetail(id: string | undefined) {
  return useQuery({
    queryKey: esKeys.detail(id!),
    queryFn: () => fetchESDetail(id!),
    enabled: !!id,
  });
}

export function useCreateES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { entity: string; fiscal_year: number }) =>
      createES(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: esKeys.all });
    },
  });
}

export function useUpdateES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<EconomicSubstanceSubmission>;
    }) => updateES(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: esKeys.detail(variables.id),
      });
    },
  });
}

export function useAdvanceESStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & AdvanceStepInput) =>
      advanceESStep(id, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: esKeys.detail(variables.id),
      });
    },
  });
}

export function useSubmitES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => submitES(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: esKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: esKeys.all });
    },
  });
}

export function useApproveES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveES(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: esKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: esKeys.all });
    },
  });
}

export function useRejectES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      field_comments,
    }: {
      id: string;
      field_comments?: Record<string, unknown>;
    }) => rejectES(id, { field_comments }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: esKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: esKeys.all });
    },
  });
}

export function useBulkCreateES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fiscalYear: number) =>
      bulkCreateES({ fiscal_year: fiscalYear }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: esKeys.all });
    },
  });
}

// ─── Guest Query Hooks ──────────────────────────────────────────────────────

export function useGuestESDetail(id: string | undefined) {
  return useQuery({
    queryKey: esKeys.guest(id!),
    queryFn: () => fetchGuestESDetail(id!),
    enabled: !!id,
  });
}

export function useSaveGuestESDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<EconomicSubstanceSubmission>;
    }) => saveGuestESDraft(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: esKeys.guest(variables.id),
      });
    },
  });
}

export function useSubmitGuestES() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => submitGuestES(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: esKeys.guest(id) });
    },
  });
}
