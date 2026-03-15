import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types";

export interface ComplianceDelegation {
  id: string;
  entity: string;
  entity_name: string;
  module: "accounting_records" | "economic_substance" | "kyc";
  module_display: string;
  fiscal_year: number;
  delegated_by: string;
  delegated_by_email: string;
  delegate_email: string;
  delegate_user: string | null;
  delegate_user_email: string | null;
  status: "pending" | "accepted" | "revoked";
  status_display: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

async function getDelegations(params?: Record<string, string>): Promise<ComplianceDelegation[]> {
  const response = await api.get<PaginatedResponse<ComplianceDelegation>>(
    "/compliance/delegations/",
    params,
  );
  return response.results;
}

async function createDelegation(data: {
  entity_id: string;
  module: string;
  fiscal_year: number;
  delegate_email: string;
}): Promise<ComplianceDelegation> {
  return api.post<ComplianceDelegation>("/compliance/delegations/", data);
}

async function revokeDelegation(id: string): Promise<ComplianceDelegation> {
  return api.post<ComplianceDelegation>(`/compliance/delegations/${id}/revoke/`);
}

async function acceptDelegation(id: string): Promise<ComplianceDelegation> {
  return api.post<ComplianceDelegation>(`/compliance/delegations/${id}/accept/`);
}

export function useDelegations(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["delegations", params],
    queryFn: () => getDelegations(params),
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
    },
  });
}

export function useRevokeDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
    },
  });
}

export function useAcceptDelegation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptDelegation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
    },
  });
}
