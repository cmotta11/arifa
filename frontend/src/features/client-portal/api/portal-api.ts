import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  KYCSubmission,
  Party,
  RFI,
  PaginatedResponse,
} from "@/types";
import type { KYCDocument } from "@/features/kyc/api/kyc-api";

// ─── Portal-specific types ──────────────────────────────────────────────────

export interface PortalEntity {
  id: string;
  name: string;
  entity_type: string;
  jurisdiction: string;
  status: "pending" | "active" | "dissolved" | "struck_off";
  incorporation_date: string | null;
  current_risk_level: "low" | "medium" | "high" | null;
  kyc_status: string | null;
  es_status: string | null;
  ar_status: string | null;
  created_at: string;
}

export interface PortalEntityDetail extends PortalEntity {
  documents: PortalDocument[];
  renewals: PortalRenewal[];
}

export interface PortalDocument {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
  download_url: string | null;
}

export interface PortalRenewal {
  id: string;
  renewal_type: string;
  due_date: string;
  status: "pending" | "completed" | "overdue";
}

export interface PortalServiceRequest {
  id: string;
  service_type: string;
  status: "draft" | "submitted" | "in_progress" | "completed";
  description: string;
  current_stage: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  category: "ticket" | "kyc" | "compliance" | "document" | "system" | "reminder";
  is_read: boolean;
  created_at: string;
}

export interface PortalProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  notification_preferences: Record<string, { email: boolean; in_app: boolean }>;
}

// ─── Query Key Factories ────────────────────────────────────────────────────

export const portalKeys = {
  all: ["portal"] as const,
  kycList: () => [...portalKeys.all, "kyc-list"] as const,
  kycDetail: (id: string) => [...portalKeys.all, "kyc", id] as const,
  parties: (kycId: string) => [...portalKeys.all, "parties", kycId] as const,
  rfis: (kycId: string) => [...portalKeys.all, "rfis", kycId] as const,
  documents: (kycId: string) => [...portalKeys.all, "documents", kycId] as const,
  entities: () => [...portalKeys.all, "entities"] as const,
  entityDetail: (id: string) => [...portalKeys.all, "entity", id] as const,
  services: () => [...portalKeys.all, "services"] as const,
  notifications: () => [...portalKeys.all, "notifications"] as const,
  profile: () => [...portalKeys.all, "profile"] as const,
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

// ─── Portal Entities ────────────────────────────────────────────────────────

async function fetchPortalEntities(): Promise<PaginatedResponse<PortalEntity>> {
  return api.get<PaginatedResponse<PortalEntity>>("/core/portal/entities/");
}

async function fetchPortalEntityDetail(id: string): Promise<PortalEntityDetail> {
  return api.get<PortalEntityDetail>(`/core/portal/entities/${id}/`);
}

export function usePortalEntities() {
  return useQuery({
    queryKey: portalKeys.entities(),
    queryFn: fetchPortalEntities,
  });
}

export function usePortalEntityDetail(id: string | undefined) {
  return useQuery({
    queryKey: portalKeys.entityDetail(id!),
    queryFn: () => fetchPortalEntityDetail(id!),
    enabled: !!id,
  });
}

// ─── Portal Service Requests ────────────────────────────────────────────────

async function fetchPortalServices(): Promise<PaginatedResponse<PortalServiceRequest>> {
  return api.get<PaginatedResponse<PortalServiceRequest>>("/workflow/portal/services/");
}

export function usePortalServices() {
  return useQuery({
    queryKey: portalKeys.services(),
    queryFn: fetchPortalServices,
  });
}

// ─── Portal Notifications ───────────────────────────────────────────────────

async function fetchPortalNotifications(): Promise<PaginatedResponse<PortalNotification>> {
  return api.get<PaginatedResponse<PortalNotification>>("/notifications/portal/");
}

export function usePortalNotifications() {
  return useQuery({
    queryKey: portalKeys.notifications(),
    queryFn: fetchPortalNotifications,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/notifications/portal/${id}/read/`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: portalKeys.notifications(),
      });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post("/notifications/portal/read-all/"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: portalKeys.notifications(),
      });
    },
  });
}

// ─── Portal Profile ─────────────────────────────────────────────────────────

async function fetchPortalProfile(): Promise<PortalProfile> {
  return api.get<PortalProfile>("/auth/portal/profile/");
}

export function usePortalProfile() {
  return useQuery({
    queryKey: portalKeys.profile(),
    queryFn: fetchPortalProfile,
  });
}

export function useUpdatePortalProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      first_name: string;
      last_name: string;
      phone: string;
    }) => api.patch<PortalProfile>("/auth/portal/profile/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: portalKeys.profile(),
      });
    },
  });
}

export function useChangePortalPassword() {
  return useMutation({
    mutationFn: (data: {
      current_password: string;
      new_password: string;
    }) => api.post("/auth/portal/change-password/", data),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, { email: boolean; in_app: boolean }>) =>
      api.patch<PortalProfile>("/auth/portal/profile/", {
        notification_preferences: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: portalKeys.profile(),
      });
    },
  });
}
