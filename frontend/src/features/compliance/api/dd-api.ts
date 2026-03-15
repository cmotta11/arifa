import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types";
import type { KYCDetail } from "./compliance-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DDChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  completed_by?: string;
  completed_at?: string;
  notes?: string;
}

export interface DDChecklist {
  id: string;
  kyc_submission: string;
  section: string;
  items: DDChecklistItem[];
  is_complete: boolean;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FieldComment {
  id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
  parent_id: string | null;
  resolved?: boolean;
}

export interface KYCQueueFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  search?: string;
}

export interface KYCQueueStats {
  total: number;
  pending_review: number;
  approved: number;
  rejected: number;
  overdue: number;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const ddKeys = {
  all: ["dueDiligence"] as const,
  checklists: (kycId: string) => [...ddKeys.all, "checklists", kycId] as const,
  kycQueue: (filters: KYCQueueFilters) => [...ddKeys.all, "kycQueue", filters] as const,
  kycStats: () => [...ddKeys.all, "kycStats"] as const,
  fieldComments: (kycId: string, fieldName: string) =>
    [...ddKeys.all, "fieldComments", kycId, fieldName] as const,
};

// ---------------------------------------------------------------------------
// Queue / Stats Queries
// ---------------------------------------------------------------------------

export function useKYCQueue(filters: KYCQueueFilters = {}) {
  return useQuery({
    queryKey: ddKeys.kycQueue(filters),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (filters.status && filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.page) params.page = String(filters.page);
      if (filters.per_page) params.per_page = String(filters.per_page);
      if (filters.search) params.search = filters.search;
      return api.get<PaginatedResponse<KYCDetail>>("/compliance/kyc/", params);
    },
  });
}

export function useKYCQueueStats() {
  return useQuery({
    queryKey: ddKeys.kycStats(),
    queryFn: async () => {
      // Fetch all KYC submissions to compute stats client-side
      const response = await api.get<PaginatedResponse<KYCDetail>>(
        "/compliance/kyc/",
        { per_page: "1000" },
      );
      const items = response.results;
      const now = new Date();
      const stats: KYCQueueStats = {
        total: response.count,
        pending_review: items.filter(
          (k) => k.status === "submitted" || k.status === "under_review",
        ).length,
        approved: items.filter((k) => k.status === "approved").length,
        rejected: items.filter((k) => k.status === "rejected").length,
        overdue: items.filter((k) => {
          if (k.status === "approved" || k.status === "rejected") return false;
          if (!k.submitted_at) return false;
          const submittedDate = new Date(k.submitted_at);
          const daysSinceSubmission =
            (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceSubmission > 30;
        }).length,
      };
      return stats;
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Due Diligence Checklists
// ---------------------------------------------------------------------------

export function useDDChecklists(kycId: string | undefined) {
  return useQuery({
    queryKey: ddKeys.checklists(kycId!),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<DDChecklist>>(
        `/compliance/kyc/${kycId}/checklists/`,
      );
      return response.results;
    },
    enabled: !!kycId,
  });
}

export function useUpdateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kycId,
      section,
      items,
    }: {
      kycId: string;
      section: string;
      items: DDChecklistItem[];
    }) =>
      api.post<DDChecklist>(`/compliance/kyc/${kycId}/checklists/`, {
        section,
        items,
      }),
    onSuccess: (_data, { kycId }) => {
      qc.invalidateQueries({ queryKey: ddKeys.checklists(kycId) });
    },
  });
}

export function useCompleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kycId,
      checklistId,
    }: {
      kycId: string;
      checklistId: string;
    }) =>
      api.post<DDChecklist>(
        `/compliance/kyc/${kycId}/checklists/${checklistId}/complete/`,
      ),
    onSuccess: (_data, { kycId }) => {
      qc.invalidateQueries({ queryKey: ddKeys.checklists(kycId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Field Comments
// ---------------------------------------------------------------------------

export function useAddFieldComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kycId,
      field_name,
      text,
      parent_id,
    }: {
      kycId: string;
      field_name: string;
      text: string;
      parent_id?: string;
    }) =>
      api.post<FieldComment>(`/compliance/kyc/${kycId}/field-comments/`, {
        field_name,
        text,
        parent_id,
      }),
    onSuccess: (_data, { kycId, field_name }) => {
      qc.invalidateQueries({
        queryKey: ddKeys.fieldComments(kycId, field_name),
      });
      qc.invalidateQueries({ queryKey: ddKeys.all });
    },
  });
}

export function useResolveFieldComments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kycId,
      field_name,
    }: {
      kycId: string;
      field_name: string;
    }) =>
      api.post(`/compliance/kyc/${kycId}/field-comments/resolve/`, {
        field_name,
      }),
    onSuccess: (_data, { kycId, field_name }) => {
      qc.invalidateQueries({
        queryKey: ddKeys.fieldComments(kycId, field_name),
      });
      qc.invalidateQueries({ queryKey: ddKeys.all });
    },
  });
}
