import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { KYCSubmission, Party, DocumentUpload, PaginatedResponse } from "@/types";

// ─── Query Key Factories ────────────────────────────────────────────────────

export const guestKeys = {
  all: ["guest"] as const,
  validate: (token: string) => [...guestKeys.all, "validate", token] as const,
  kycDetail: (kycId: string) => [...guestKeys.all, "kyc", kycId] as const,
  parties: (kycId: string) => [...guestKeys.all, "parties", kycId] as const,
  documents: (kycId: string) => [...guestKeys.all, "documents", kycId] as const,
  entitySnapshot: (kycId: string) => [...guestKeys.all, "entitySnapshot", kycId] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GuestLinkValidation {
  id: string;
  token: string;
  ticket: string | null;
  kyc_submission: string | null;
  accounting_record: string | null;
  expires_at: string;
  is_active: boolean;
  created_by: string;
  client_name?: string;
  entity_name?: string;
}

export interface GuestAutoSaveData {
  [key: string]: unknown;
}

export interface GuestAddPartyData {
  party_type: "natural" | "corporate";
  role: string;
  name: string;
  nationality: string;
  country_of_residence: string;
  pep_status: boolean;
  ownership_percentage: number | null;
  date_of_birth: string | null;
  identification_number: string;
}

export interface GuestUploadDocumentParams {
  kycId: string;
  file: File;
  documentType: DocumentUpload["document_type"];
  partyId?: string;
}

export interface SnapshotPerson {
  id: string;
  full_name: string;
  person_type: string;
}

export interface SnapshotOfficer {
  id: string;
  officer_person: SnapshotPerson | null;
  officer_entity_id: string | null;
  officer_entity_name: string | null;
  positions: string[];
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface SnapshotCountry {
  id: string;
  country_code: string;
  country_name: string;
  risk_weight: number;
}

export interface SnapshotShareIssuance {
  id: string;
  share_class_id: string;
  shareholder_person: SnapshotPerson | null;
  shareholder_entity_id: string | null;
  shareholder_entity_name: string | null;
  num_shares: number;
  issue_date: string | null;
  certificate_number: string;
  is_jtwros: boolean;
  jtwros_partner_name: string;
  is_trustee: boolean;
  trustee_for: string;
}

export interface SnapshotShareClass {
  id: string;
  name: string;
  currency: string;
  par_value: string | null;
  authorized_shares: number | null;
  voting_rights: boolean;
  issuances: SnapshotShareIssuance[];
}

export interface SnapshotActivity {
  id: string;
  activity_id: string;
  activity_name: string;
  countries: SnapshotCountry[];
  risk_level: string;
  description: string;
}

export interface SnapshotSourceOfFunds {
  id: string;
  source_id: string;
  source_name: string;
  countries: SnapshotCountry[];
  risk_level: string;
  description: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  default_risk_level: string;
}

export interface EntitySnapshot {
  general: {
    name: string;
    jurisdiction: string;
    incorporation_date: string | null;
    status: string;
    nominal_directors_requested: boolean;
  };
  officers: SnapshotOfficer[];
  share_classes: SnapshotShareClass[];
  activities: SnapshotActivity[];
  sources_of_funds: SnapshotSourceOfFunds[];
  persons: SnapshotPerson[];
  activity_catalog: CatalogItem[];
  sof_catalog: CatalogItem[];
  countries: SnapshotCountry[];
  field_comments: Record<string, string>;
  kyc_status: string;
  proposed_entity_data: Record<string, unknown>;
}

// ─── Raw API Functions ──────────────────────────────────────────────────────

async function validateGuestLink(token: string): Promise<GuestLinkValidation> {
  return api.get<GuestLinkValidation>(
    `/auth/guest-links/${token}/validate/`,
  );
}

async function fetchGuestKYCDetail(kycId: string): Promise<KYCSubmission> {
  return api.get<KYCSubmission>(`/compliance/kyc/${kycId}/`);
}

async function fetchGuestParties(kycId: string): Promise<Party[]> {
  const response = await api.get<PaginatedResponse<Party>>(
    `/compliance/kyc/${kycId}/parties/`,
  );
  return response.results;
}

async function fetchGuestDocuments(kycId: string): Promise<DocumentUpload[]> {
  const response = await api.get<PaginatedResponse<DocumentUpload>>(
    `/compliance/kyc/${kycId}/documents/`,
  );
  return response.results;
}

async function guestAutoSave(
  kycId: string,
  data: GuestAutoSaveData,
): Promise<KYCSubmission> {
  return api.patch<KYCSubmission>(`/compliance/kyc/${kycId}/`, data);
}

async function guestAddParty(
  kycId: string,
  data: GuestAddPartyData,
): Promise<Party> {
  return api.post<Party>(`/compliance/kyc/${kycId}/parties/`, data);
}

async function guestDeleteParty(partyId: string): Promise<void> {
  return api.delete<void>(`/compliance/parties/${partyId}/`);
}

async function guestUploadDocument(
  params: GuestUploadDocumentParams,
): Promise<DocumentUpload> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("document_type", params.documentType);
  if (params.partyId) {
    formData.append("party_id", params.partyId);
  }
  return api.upload<DocumentUpload>(
    `/compliance/kyc/${params.kycId}/documents/upload/`,
    formData,
  );
}

async function guestSubmitKYC(kycId: string): Promise<KYCSubmission> {
  return api.post<KYCSubmission>(`/compliance/kyc/${kycId}/submit/`);
}

async function fetchEntitySnapshot(kycId: string): Promise<EntitySnapshot> {
  return api.get<EntitySnapshot>(`/compliance/kyc/${kycId}/entity-snapshot/`);
}

async function proposeEntityChanges(
  kycId: string,
  data: Record<string, unknown>,
): Promise<KYCSubmission> {
  return api.post<KYCSubmission>(`/compliance/kyc/${kycId}/propose-changes/`, {
    proposed_entity_data: data,
  });
}

async function guestCreatePerson(
  kycId: string,
  data: Record<string, unknown>,
): Promise<SnapshotPerson> {
  return api.post<SnapshotPerson>(`/compliance/kyc/${kycId}/create-person/`, data);
}

// ─── Query Hooks ────────────────────────────────────────────────────────────

export function useValidateGuestLink(token: string | undefined) {
  return useQuery({
    queryKey: guestKeys.validate(token!),
    queryFn: () => validateGuestLink(token!),
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useGuestKYCDetail(kycId: string | undefined) {
  return useQuery({
    queryKey: guestKeys.kycDetail(kycId!),
    queryFn: () => fetchGuestKYCDetail(kycId!),
    enabled: !!kycId,
  });
}

export function useGuestParties(kycId: string | undefined) {
  return useQuery({
    queryKey: guestKeys.parties(kycId!),
    queryFn: () => fetchGuestParties(kycId!),
    enabled: !!kycId,
  });
}

export function useGuestDocuments(kycId: string | undefined) {
  return useQuery({
    queryKey: guestKeys.documents(kycId!),
    queryFn: () => fetchGuestDocuments(kycId!),
    enabled: !!kycId,
  });
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export function useGuestAutoSave(kycId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GuestAutoSaveData) =>
      guestAutoSave(kycId!, data),
    onSuccess: () => {
      if (kycId) {
        queryClient.invalidateQueries({
          queryKey: guestKeys.kycDetail(kycId),
        });
      }
    },
  });
}

export function useGuestAddParty(kycId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GuestAddPartyData) => guestAddParty(kycId!, data),
    onSuccess: () => {
      if (kycId) {
        queryClient.invalidateQueries({
          queryKey: guestKeys.parties(kycId),
        });
      }
    },
  });
}

export function useGuestDeleteParty(kycId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partyId: string) => guestDeleteParty(partyId),
    onSuccess: () => {
      if (kycId) {
        queryClient.invalidateQueries({
          queryKey: guestKeys.parties(kycId),
        });
      }
    },
  });
}

export function useGuestUploadDocument(kycId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Omit<GuestUploadDocumentParams, "kycId">) =>
      guestUploadDocument({ ...params, kycId: kycId! }),
    onSuccess: () => {
      if (kycId) {
        queryClient.invalidateQueries({
          queryKey: guestKeys.documents(kycId),
        });
      }
    },
  });
}

export function useGuestSubmitKYC() {
  return useMutation({
    mutationFn: (kycId: string) => guestSubmitKYC(kycId),
  });
}

export function useGuestEntitySnapshot(kycId: string | undefined) {
  return useQuery({
    queryKey: guestKeys.entitySnapshot(kycId!),
    queryFn: () => fetchEntitySnapshot(kycId!),
    enabled: !!kycId,
  });
}

export function useGuestCreatePerson(kycId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      guestCreatePerson(kycId!, data),
    onSuccess: () => {
      if (kycId) {
        queryClient.invalidateQueries({
          queryKey: guestKeys.entitySnapshot(kycId),
        });
      }
    },
  });
}

export function useGuestProposeChanges(kycId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      proposeEntityChanges(kycId!, data),
    onSuccess: () => {
      if (kycId) {
        queryClient.invalidateQueries({
          queryKey: guestKeys.kycDetail(kycId),
        });
      }
    },
  });
}
