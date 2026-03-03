import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  KYCSubmission,
  Party,
  RiskAssessment,
  RFI,
  WorldCheckCase,
  PaginatedResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Types for API responses and request payloads
// ---------------------------------------------------------------------------

export interface KYCDetail extends KYCSubmission {
  ticket_detail?: {
    id: string;
    title: string;
    client: { id: string; name: string };
    entity: { id: string; name: string; jurisdiction: string } | null;
  };
}

export interface IntegrationStatus {
  worldcheck: { configured: boolean; status: string };
  email: { configured: boolean; status: string };
  [key: string]: { configured: boolean; status: string };
}

export interface KYCDocument {
  id: string;
  kyc_submission: string;
  file_name: string;
  file_url: string;
  document_type: string;
  uploaded_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const complianceKeys = {
  all: ["compliance"] as const,
  queue: (status?: string) => [...complianceKeys.all, "queue", status] as const,
  kycDetail: (id: string) => [...complianceKeys.all, "kyc", id] as const,
  parties: (kycId: string) => [...complianceKeys.all, "kyc", kycId, "parties"] as const,
  risk: (kycId: string) => [...complianceKeys.all, "kyc", kycId, "risk"] as const,
  riskHistory: (kycId: string) => [...complianceKeys.all, "kyc", kycId, "risk-history"] as const,
  rfis: (kycId: string) => [...complianceKeys.all, "kyc", kycId, "rfis"] as const,
  documents: (kycId: string) => [...complianceKeys.all, "kyc", kycId, "documents"] as const,
  worldcheck: (partyId: string) => [...complianceKeys.all, "worldcheck", partyId] as const,
  integrationStatus: () => [...complianceKeys.all, "integrations"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useComplianceQueue(status?: string) {
  return useQuery({
    queryKey: complianceKeys.queue(status),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) {
        params.status = status;
      } else {
        // Default: show submissions awaiting review
        params.status = "submitted,under_review";
      }
      const response = await api.get<PaginatedResponse<KYCDetail>>(
        "/compliance/kyc/",
        params,
      );
      return response.results;
    },
  });
}

export function useKYCDetail(id: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.kycDetail(id!),
    queryFn: () => api.get<KYCDetail>(`/compliance/kyc/${id}/`),
    enabled: !!id,
  });
}

export function useKYCParties(kycId: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.parties(kycId!),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Party>>(
        `/compliance/kyc/${kycId}/parties/`,
      );
      return response.results;
    },
    enabled: !!kycId,
  });
}

export function useKYCRisk(kycId: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.risk(kycId!),
    queryFn: () =>
      api.get<RiskAssessment>(`/compliance/kyc/${kycId}/risk-assessment/`),
    enabled: !!kycId,
  });
}

export function useKYCRiskHistory(kycId: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.riskHistory(kycId!),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<RiskAssessment>>(
        `/compliance/kyc/${kycId}/risk-history/`,
      );
      return response.results;
    },
    enabled: !!kycId,
  });
}

export function useKYCRFIs(kycId: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.rfis(kycId!),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<RFI>>(
        `/compliance/kyc/${kycId}/rfis/`,
      );
      return response.results;
    },
    enabled: !!kycId,
  });
}

export function useKYCDocuments(kycId: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.documents(kycId!),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<KYCDocument>>(
        `/compliance/kyc/${kycId}/documents/`,
      );
      return response.results;
    },
    enabled: !!kycId,
  });
}

export function useWorldCheckResults(partyId: string | undefined) {
  return useQuery({
    queryKey: complianceKeys.worldcheck(partyId!),
    queryFn: () =>
      api.get<WorldCheckCase>(`/compliance/parties/${partyId}/worldcheck/`),
    enabled: !!partyId,
  });
}

export function useIntegrationStatus() {
  return useQuery({
    queryKey: complianceKeys.integrationStatus(),
    queryFn: () => api.get<IntegrationStatus>("/auth/integrations/status/"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useApproveKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<KYCDetail>(`/compliance/kyc/${id}/approve/`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.kycDetail(id) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.queue() });
    },
  });
}

export function useRejectKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<KYCDetail>(`/compliance/kyc/${id}/reject/`, { reason }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.kycDetail(id) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.queue() });
    },
  });
}

export function useEscalateKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<KYCDetail>(`/compliance/kyc/${id}/escalate/`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.kycDetail(id) });
      queryClient.invalidateQueries({ queryKey: complianceKeys.queue() });
    },
  });
}

export function useCalculateRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (kycId: string) =>
      api.post<RiskAssessment>(`/compliance/kyc/${kycId}/calculate-risk/`),
    onSuccess: (_data, kycId) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.risk(kycId) });
      queryClient.invalidateQueries({
        queryKey: complianceKeys.riskHistory(kycId),
      });
      queryClient.invalidateQueries({ queryKey: complianceKeys.queue() });
    },
  });
}

export function useCreateRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kycId,
      requested_fields,
      notes,
    }: {
      kycId: string;
      requested_fields: string[];
      notes: string;
    }) =>
      api.post<RFI>(`/compliance/kyc/${kycId}/rfis/`, {
        requested_fields,
        notes,
      }),
    onSuccess: (_data, { kycId }) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.rfis(kycId) });
    },
  });
}

export function useRespondToRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rfiId,
      response_text,
    }: {
      rfiId: string;
      kycId: string;
      response_text: string;
    }) =>
      api.post<RFI>(`/compliance/rfis/${rfiId}/respond/`, { response_text }),
    onSuccess: (_data, { kycId }) => {
      queryClient.invalidateQueries({ queryKey: complianceKeys.rfis(kycId) });
    },
  });
}

export function useScreenParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partyId: string) =>
      api.post<WorldCheckCase>(`/compliance/parties/${partyId}/screen/`),
    onSuccess: (_data, partyId) => {
      queryClient.invalidateQueries({
        queryKey: complianceKeys.worldcheck(partyId),
      });
      // Also invalidate parties list so screening status updates
      queryClient.invalidateQueries({
        queryKey: complianceKeys.all,
      });
    },
  });
}

export function useResolveWorldCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partyId,
      resolution,
    }: {
      partyId: string;
      resolution: "false_positive" | "true_match";
    }) =>
      api.post<WorldCheckCase>(
        `/compliance/parties/${partyId}/resolve-worldcheck/`,
        { resolution },
      ),
    onSuccess: (_data, { partyId }) => {
      queryClient.invalidateQueries({
        queryKey: complianceKeys.worldcheck(partyId),
      });
      queryClient.invalidateQueries({
        queryKey: complianceKeys.all,
      });
    },
  });
}
