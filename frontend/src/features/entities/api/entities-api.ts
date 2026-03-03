import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  ActivityCatalog,
  Entity,
  EntityActivity,
  EntityOfficer,
  GuestLink,
  KYCSubmission,
  Matter,
  OwnershipTreeResponse,
  PaginatedResponse,
  ShareClass,
  ShareIssuance,
  SourceOfFunds,
  SourceOfFundsCatalog,
  Ticket,
} from "@/types";

// Query key factory
export const entityKeys = {
  all: ["entities"] as const,
  lists: () => [...entityKeys.all, "list"] as const,
  list: (filters: Record<string, string>) => [...entityKeys.lists(), filters] as const,
  details: () => [...entityKeys.all, "detail"] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
  matters: (entityId: string) => [...entityKeys.all, "matters", entityId] as const,
  tickets: (entityId: string) => [...entityKeys.all, "tickets", entityId] as const,
  officers: (entityId: string) => [...entityKeys.all, "officers", entityId] as const,
  shareClasses: (entityId: string) => [...entityKeys.all, "shareClasses", entityId] as const,
  ownershipTree: (entityId: string) => [...entityKeys.all, "ownershipTree", entityId] as const,
  activities: (entityId: string) => [...entityKeys.all, "activities", entityId] as const,
  activityCatalog: () => [...entityKeys.all, "activityCatalog"] as const,
  sofCatalog: () => [...entityKeys.all, "sofCatalog"] as const,
  sourcesOfFunds: (entityId: string) => [...entityKeys.all, "sourcesOfFunds", entityId] as const,
  guestLinks: (entityId: string) => [...entityKeys.all, "guestLinks", entityId] as const,
  kycSubmissions: (entityId: string) => [...entityKeys.all, "kycSubmissions", entityId] as const,
  auditLog: (entityId: string) => [...entityKeys.all, "auditLog", entityId] as const,
};

// Raw API functions
async function fetchEntities(filters: Record<string, string> = {}) {
  const params: Record<string, string> = { per_page: "100", ...filters };
  return api.get<PaginatedResponse<Entity>>("/core/entities/", params);
}

async function fetchEntity(id: string) {
  return api.get<Entity>(`/core/entities/${id}/`);
}

async function createEntity(data: Record<string, unknown>) {
  return api.post<Entity>("/core/entities/", data);
}

async function updateEntity(id: string, data: Record<string, unknown>) {
  return api.patch<Entity>(`/core/entities/${id}/`, data);
}

async function fetchEntityMatters(entityId: string) {
  return api.get<PaginatedResponse<Matter>>("/core/matters/", { entity_id: entityId, per_page: "100" });
}

async function fetchEntityTickets(entityId: string) {
  return api.get<PaginatedResponse<Ticket>>("/workflow/tickets/", { entity_id: entityId, per_page: "100" });
}

// React hooks
export function useEntities(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: entityKeys.list(filters),
    queryFn: () => fetchEntities(filters),
  });
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: () => fetchEntity(id),
    enabled: !!id,
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
}

export function useUpdateEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateEntity(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
}

export function useEntityMatters(entityId: string) {
  return useQuery({
    queryKey: entityKeys.matters(entityId),
    queryFn: () => fetchEntityMatters(entityId),
    enabled: !!entityId,
  });
}

export function useEntityTickets(entityId: string) {
  return useQuery({
    queryKey: entityKeys.tickets(entityId),
    queryFn: () => fetchEntityTickets(entityId),
    enabled: !!entityId,
  });
}

// ---------------------------------------------------------------------------
// Officers
// ---------------------------------------------------------------------------

export function useEntityOfficers(entityId: string, enabled = true) {
  return useQuery({
    queryKey: entityKeys.officers(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<EntityOfficer>>("/core/entity-officers/", {
        entity_id: entityId,
        per_page: "100",
      }),
    enabled: !!entityId && enabled,
  });
}

export function useCreateOfficer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<EntityOfficer>("/core/entity-officers/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useUpdateOfficer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<EntityOfficer>(`/core/entity-officers/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useDeleteOfficer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/entity-officers/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Share Classes
// ---------------------------------------------------------------------------

export function useShareClasses(entityId: string, enabled = true) {
  return useQuery({
    queryKey: entityKeys.shareClasses(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<ShareClass>>("/core/share-classes/", {
        entity_id: entityId,
        per_page: "100",
      }),
    enabled: !!entityId && enabled,
  });
}

export function useCreateShareClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<ShareClass>("/core/share-classes/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useUpdateShareClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<ShareClass>(`/core/share-classes/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useDeleteShareClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/share-classes/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Share Issuances
// ---------------------------------------------------------------------------

export function useCreateShareIssuance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<ShareIssuance>("/core/share-issuances/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useUpdateShareIssuance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<ShareIssuance>(`/core/share-issuances/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useDeleteShareIssuance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/share-issuances/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Ownership Tree
// ---------------------------------------------------------------------------

export function useOwnershipTree(entityId: string, enabled = true) {
  return useQuery({
    queryKey: entityKeys.ownershipTree(entityId),
    queryFn: () =>
      api.get<OwnershipTreeResponse>(`/core/entities/${entityId}/ownership-tree/`),
    enabled: !!entityId && enabled,
  });
}

// ---------------------------------------------------------------------------
// Activity Catalog & Entity Activities
// ---------------------------------------------------------------------------

export function useActivityCatalog() {
  return useQuery({
    queryKey: entityKeys.activityCatalog(),
    queryFn: () =>
      api.get<PaginatedResponse<ActivityCatalog>>("/core/activity-catalog/", {
        per_page: "100",
      }),
  });
}

export function useEntityActivities(entityId: string, enabled = true) {
  return useQuery({
    queryKey: entityKeys.activities(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<EntityActivity>>("/core/entity-activities/", {
        entity_id: entityId,
        per_page: "100",
      }),
    enabled: !!entityId && enabled,
  });
}

export function useCreateEntityActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<EntityActivity>("/core/entity-activities/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useDeleteEntityActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/entity-activities/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Source of Funds Catalog & Entity Sources of Funds
// ---------------------------------------------------------------------------

export function useSourceOfFundsCatalog() {
  return useQuery({
    queryKey: entityKeys.sofCatalog(),
    queryFn: () =>
      api.get<PaginatedResponse<SourceOfFundsCatalog>>("/core/source-of-funds-catalog/", {
        per_page: "100",
      }),
  });
}

export function useEntitySourcesOfFunds(entityId: string, enabled = true) {
  return useQuery({
    queryKey: entityKeys.sourcesOfFunds(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<SourceOfFunds>>("/core/sources-of-funds/", {
        entity_id: entityId,
        per_page: "100",
      }),
    enabled: !!entityId && enabled,
  });
}

export function useCreateSourceOfFunds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<SourceOfFunds>("/core/sources-of-funds/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

export function useDeleteSourceOfFunds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/sources-of-funds/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Guest Links & KYC Submissions (for entity access links tab)
// ---------------------------------------------------------------------------

export function useEntityGuestLinks(entityId: string) {
  return useQuery({
    queryKey: entityKeys.guestLinks(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<GuestLink>>("/auth/guest-links/", {
        entity_id: entityId,
        per_page: "100",
      }),
    enabled: !!entityId,
  });
}

export function useEntityKYCSubmissions(entityId: string) {
  return useQuery({
    queryKey: entityKeys.kycSubmissions(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<KYCSubmission>>("/compliance/kyc/", {
        entity_id: entityId,
        per_page: "100",
      }),
    enabled: !!entityId,
  });
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  entity: string;
  kyc_submission: string | null;
  model_name: string;
  record_id: string | null;
  action: "create" | "update" | "delete";
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  source: "internal" | "guest_submission" | "approval" | "send_back";
  comment: string;
  created_at: string;
}

async function fetchEntityAuditLog(
  entityId: string,
  filters: { model_name?: string; source?: string } = {}
) {
  const params: Record<string, string> = { per_page: "100" };
  if (filters.model_name) params.model_name = filters.model_name;
  if (filters.source) params.source = filters.source;
  return api.get<PaginatedResponse<AuditLogEntry>>(
    `/core/entities/${entityId}/audit-log/`,
    params
  );
}

export function useEntityAuditLog(
  entityId: string,
  filters: { model_name?: string; source?: string } = {}
) {
  return useQuery({
    queryKey: [...entityKeys.auditLog(entityId), filters],
    queryFn: () => fetchEntityAuditLog(entityId, filters),
    enabled: !!entityId,
  });
}
