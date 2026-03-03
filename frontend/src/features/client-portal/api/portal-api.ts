import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  KYCSubmission,
  Party,
  RFI,
  PaginatedResponse,
} from "@/types";
import type { KYCDocument } from "@/features/kyc/api/kyc-api";

// ─── Query Key Factories ────────────────────────────────────────────────────

export const portalKeys = {
  all: ["portal"] as const,
  kycList: () => [...portalKeys.all, "kyc-list"] as const,
  kycDetail: (id: string) => [...portalKeys.all, "kyc", id] as const,
  parties: (kycId: string) => [...portalKeys.all, "parties", kycId] as const,
  rfis: (kycId: string) => [...portalKeys.all, "rfis", kycId] as const,
  documents: (kycId: string) => [...portalKeys.all, "documents", kycId] as const,
};

// ─── Raw API Functions ──────────────────────────────────────────────────────

async function fetchPortalKYCList(): Promise<PaginatedResponse<KYCSubmission>> {
  return api.get<PaginatedResponse<KYCSubmission>>("/compliance/portal/kyc/");
}

async function fetchPortalKYCDetail(id: string): Promise<KYCSubmission> {
  return api.get<KYCSubmission>(`/compliance/portal/kyc/${id}/`);
}

async function fetchPortalParties(kycId: string): Promise<Party[]> {
  const response = await api.get<PaginatedResponse<Party>>(
    `/compliance/portal/kyc/${kycId}/parties/`
  );
  return response.results;
}

async function fetchPortalRFIs(kycId: string): Promise<RFI[]> {
  const response = await api.get<PaginatedResponse<RFI>>(
    `/compliance/portal/kyc/${kycId}/rfis/`
  );
  return response.results;
}

async function respondToRFI(
  kycId: string,
  rfiId: string,
  responseText: string
): Promise<RFI> {
  return api.post<RFI>(
    `/compliance/portal/kyc/${kycId}/rfis/${rfiId}/respond/`,
    { response_text: responseText }
  );
}

async function fetchPortalDocuments(kycId: string): Promise<KYCDocument[]> {
  const response = await api.get<PaginatedResponse<KYCDocument>>(
    `/compliance/portal/kyc/${kycId}/documents/`
  );
  return response.results;
}

async function uploadPortalDocument(
  kycId: string,
  file: File,
  documentType: string
): Promise<KYCDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  return api.upload<KYCDocument>(
    `/compliance/portal/kyc/${kycId}/documents/upload/`,
    formData
  );
}

// ─── Query Hooks ────────────────────────────────────────────────────────────

export function usePortalKYCList() {
  return useQuery({
    queryKey: portalKeys.kycList(),
    queryFn: fetchPortalKYCList,
  });
}

export function usePortalKYCDetail(id: string | undefined) {
  return useQuery({
    queryKey: portalKeys.kycDetail(id!),
    queryFn: () => fetchPortalKYCDetail(id!),
    enabled: !!id,
  });
}

export function usePortalParties(kycId: string | undefined) {
  return useQuery({
    queryKey: portalKeys.parties(kycId!),
    queryFn: () => fetchPortalParties(kycId!),
    enabled: !!kycId,
  });
}

export function usePortalRFIs(kycId: string | undefined) {
  return useQuery({
    queryKey: portalKeys.rfis(kycId!),
    queryFn: () => fetchPortalRFIs(kycId!),
    enabled: !!kycId,
  });
}

export function usePortalDocuments(kycId: string | undefined) {
  return useQuery({
    queryKey: portalKeys.documents(kycId!),
    queryFn: () => fetchPortalDocuments(kycId!),
    enabled: !!kycId,
  });
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export function useRespondToRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kycId,
      rfiId,
      responseText,
    }: {
      kycId: string;
      rfiId: string;
      responseText: string;
    }) => respondToRFI(kycId, rfiId, responseText),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: portalKeys.rfis(variables.kycId),
      });
    },
  });
}

export function usePortalUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kycId,
      file,
      documentType,
    }: {
      kycId: string;
      file: File;
      documentType: string;
    }) => uploadPortalDocument(kycId, file, documentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: portalKeys.documents(variables.kycId),
      });
    },
  });
}
