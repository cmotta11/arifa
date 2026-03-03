import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import type {
  KYCSubmission,
  Party,
  Person,
  RiskAssessment,
  PaginatedResponse,
} from "@/types";
import type { EntitySnapshot } from "@/features/guest-intake/api/guest-api";

// ─── Query Key Factories ────────────────────────────────────────────────────

export const kycKeys = {
  all: ["kyc"] as const,
  lists: () => [...kycKeys.all, "list"] as const,
  list: (filters: KYCListFilters) => [...kycKeys.lists(), filters] as const,
  details: () => [...kycKeys.all, "detail"] as const,
  detail: (id: string) => [...kycKeys.details(), id] as const,
  parties: (kycId: string) => [...kycKeys.all, "parties", kycId] as const,
  risk: (kycId: string) => [...kycKeys.all, "risk", kycId] as const,
  documents: (kycId: string) => [...kycKeys.all, "documents", kycId] as const,
};

export const personKeys = {
  search: (query: string) => ["persons", "search", query] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KYCListFilters {
  status?: KYCSubmission["status"] | "all";
  page?: number;
  per_page?: number;
}

export interface KYCDocument {
  id: string;
  kyc_submission: string;
  file: string;
  file_name: string;
  document_type: string;
  uploaded_by: string | null;
  created_at: string;
}

// ─── Raw API Functions ──────────────────────────────────────────────────────

async function fetchKYCList(
  filters: KYCListFilters
): Promise<PaginatedResponse<KYCSubmission>> {
  const params: Record<string, string> = {};
  if (filters.status && filters.status !== "all") {
    params.status = filters.status;
  }
  if (filters.page) {
    params.page = String(filters.page);
  }
  if (filters.per_page) {
    params.per_page = String(filters.per_page);
  }
  return api.get<PaginatedResponse<KYCSubmission>>(
    "/compliance/kyc/",
    params
  );
}

async function fetchKYCDetail(id: string): Promise<KYCSubmission> {
  return api.get<KYCSubmission>(`/compliance/kyc/${id}/`);
}

async function createKYC(ticketId: string): Promise<KYCSubmission> {
  return api.post<KYCSubmission>("/compliance/kyc/", { ticket_id: ticketId });
}

async function updateKYC(
  id: string,
  data: Partial<KYCSubmission>
): Promise<KYCSubmission> {
  return api.patch<KYCSubmission>(`/compliance/kyc/${id}/`, data);
}

async function submitKYC(id: string): Promise<KYCSubmission> {
  return api.post<KYCSubmission>(`/compliance/kyc/${id}/submit/`);
}

async function fetchParties(kycId: string): Promise<Party[]> {
  const response = await api.get<PaginatedResponse<Party>>(
    `/compliance/kyc/${kycId}/parties/`
  );
  return response.results;
}

async function addParty(
  kycId: string,
  data: Omit<Party, "id" | "kyc_submission" | "person">
): Promise<Party> {
  return api.post<Party>(`/compliance/kyc/${kycId}/parties/`, data);
}

async function updateParty(
  partyId: string,
  data: Partial<Party>
): Promise<Party> {
  return api.patch<Party>(`/compliance/parties/${partyId}/`, data);
}

async function deleteParty(partyId: string): Promise<void> {
  return api.delete<void>(`/compliance/parties/${partyId}/`);
}

async function linkPersonToParty(
  partyId: string,
  personId: string
): Promise<Party> {
  return api.post<Party>(`/compliance/parties/${partyId}/link-person/`, {
    person_id: personId,
  });
}

async function searchPersons(query: string): Promise<Person[]> {
  const response = await api.get<PaginatedResponse<Person>>(
    "/core/persons/search/",
    { q: query }
  );
  return response.results;
}

async function fetchRiskAssessment(kycId: string): Promise<RiskAssessment> {
  return api.get<RiskAssessment>(`/compliance/kyc/${kycId}/risk-assessment/`);
}

async function calculateRisk(kycId: string): Promise<RiskAssessment> {
  return api.post<RiskAssessment>(`/compliance/kyc/${kycId}/calculate-risk/`);
}

async function fetchDocuments(kycId: string): Promise<KYCDocument[]> {
  const response = await api.get<PaginatedResponse<KYCDocument>>(
    `/compliance/kyc/${kycId}/documents/`
  );
  return response.results;
}

async function uploadDocument(
  kycId: string,
  file: File,
  documentType: string
): Promise<KYCDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  return api.upload<KYCDocument>(
    `/compliance/kyc/${kycId}/documents/upload/`,
    formData
  );
}

// ─── Query Hooks ────────────────────────────────────────────────────────────

export function useKYCList(filters: KYCListFilters = {}) {
  return useQuery({
    queryKey: kycKeys.list(filters),
    queryFn: () => fetchKYCList(filters),
  });
}

export function useKYCDetail(id: string | undefined) {
  return useQuery({
    queryKey: kycKeys.detail(id!),
    queryFn: () => fetchKYCDetail(id!),
    enabled: !!id,
  });
}

export function useKYCParties(kycId: string | undefined) {
  return useQuery({
    queryKey: kycKeys.parties(kycId!),
    queryFn: () => fetchParties(kycId!),
    enabled: !!kycId,
  });
}

export function useKYCRisk(kycId: string | undefined) {
  return useQuery({
    queryKey: kycKeys.risk(kycId!),
    queryFn: () => fetchRiskAssessment(kycId!),
    enabled: !!kycId,
    retry: false,
  });
}

export function useKYCDocuments(kycId: string | undefined) {
  return useQuery({
    queryKey: kycKeys.documents(kycId!),
    queryFn: () => fetchDocuments(kycId!),
    enabled: !!kycId,
  });
}

export function usePersonSearch(query: string) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: personKeys.search(debouncedQuery),
    queryFn: () => searchPersons(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export function useCreateKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => createKYC(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kycKeys.lists() });
    },
  });
}

export function useUpdateKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KYCSubmission> }) =>
      updateKYC(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.detail(variables.id),
      });
    },
  });
}

export function useSubmitKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => submitKYC(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: kycKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: kycKeys.lists() });
    },
  });
}

export function useAddParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kycId,
      data,
    }: {
      kycId: string;
      data: Omit<Party, "id" | "kyc_submission" | "person">;
    }) => addParty(kycId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.parties(variables.kycId),
      });
    },
  });
}

export function useUpdateParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partyId,
      data,
    }: {
      partyId: string;
      kycId: string;
      data: Partial<Party>;
    }) => updateParty(partyId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.parties(variables.kycId),
      });
    },
  });
}

export function useDeleteParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partyId,
    }: {
      partyId: string;
      kycId: string;
    }) => deleteParty(partyId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.parties(variables.kycId),
      });
    },
  });
}

export function useLinkPerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      partyId,
      personId,
    }: {
      partyId: string;
      personId: string;
      kycId: string;
    }) => linkPersonToParty(partyId, personId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.parties(variables.kycId),
      });
    },
  });
}

export function useCalculateRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (kycId: string) => calculateRisk(kycId),
    onSuccess: (_data, kycId) => {
      queryClient.invalidateQueries({ queryKey: kycKeys.risk(kycId) });
    },
  });
}

export function useUploadDocument() {
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
    }) => uploadDocument(kycId, file, documentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.documents(variables.kycId),
      });
    },
  });
}

// ─── Approval Workflow API Functions ─────────────────────────────────────────

async function fetchEntitySnapshot(kycId: string): Promise<EntitySnapshot> {
  return api.get<EntitySnapshot>(`/compliance/kyc/${kycId}/entity-snapshot/`);
}

async function approveWithChanges(
  kycId: string,
  modifiedData?: Record<string, unknown>
): Promise<KYCSubmission> {
  return api.post<KYCSubmission>(
    `/compliance/kyc/${kycId}/approve/`,
    modifiedData ? { modified_data: modifiedData } : {}
  );
}

async function sendBackKYC(
  kycId: string,
  fieldComments: Record<string, string>
): Promise<KYCSubmission> {
  return api.post<KYCSubmission>(`/compliance/kyc/${kycId}/send-back/`, {
    field_comments: fieldComments,
  });
}

// ─── Approval Workflow Hooks ─────────────────────────────────────────────────

export function useKYCEntitySnapshot(kycId: string | undefined) {
  return useQuery({
    queryKey: [...kycKeys.detail(kycId!), "entity-snapshot"],
    queryFn: () => fetchEntitySnapshot(kycId!),
    enabled: !!kycId,
  });
}

export function useApproveWithChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kycId,
      modifiedData,
    }: {
      kycId: string;
      modifiedData?: Record<string, unknown>;
    }) => approveWithChanges(kycId, modifiedData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.detail(variables.kycId),
      });
      queryClient.invalidateQueries({ queryKey: kycKeys.lists() });
    },
  });
}

export function useSendBackKYC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kycId,
      fieldComments,
    }: {
      kycId: string;
      fieldComments: Record<string, string>;
    }) => sendBackKYC(kycId, fieldComments),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: kycKeys.detail(variables.kycId),
      });
      queryClient.invalidateQueries({ queryKey: kycKeys.lists() });
    },
  });
}

// ─── Guest Link ──────────────────────────────────────────────────────────────

interface GuestLinkResponse {
  id: string;
  token: string;
  created_by: string;
  expires_at: string;
  is_active: boolean;
  ticket: string | null;
  kyc_submission: string;
}

async function createGuestLink(
  kycId: string
): Promise<GuestLinkResponse> {
  return api.post<GuestLinkResponse>("/auth/guest-links/", {
    kyc_submission: kycId,
  });
}

export function useCreateGuestLink() {
  return useMutation({
    mutationFn: (kycId: string) => createGuestLink(kycId),
  });
}
