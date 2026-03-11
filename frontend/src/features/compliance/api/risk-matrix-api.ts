import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { ENV } from "@/config/env";
import type {
  RiskAssessment,
  RiskMatrixConfig,
  ComplianceSnapshot,
  PaginatedResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const riskMatrixKeys = {
  all: ["riskMatrix"] as const,
  configs: () => [...riskMatrixKeys.all, "configs"] as const,
  config: (id: string) => [...riskMatrixKeys.all, "config", id] as const,
  entityRisk: (entityId: string) => [...riskMatrixKeys.all, "entityRisk", entityId] as const,
  entityRiskHistory: (entityId: string) => [...riskMatrixKeys.all, "entityRiskHistory", entityId] as const,
  personRisk: (personId: string) => [...riskMatrixKeys.all, "personRisk", personId] as const,
  personRiskHistory: (personId: string) => [...riskMatrixKeys.all, "personRiskHistory", personId] as const,
  snapshots: () => [...riskMatrixKeys.all, "snapshots"] as const,
  snapshot: (id: string) => [...riskMatrixKeys.all, "snapshot", id] as const,
  snapshotAssessments: (id: string) => [...riskMatrixKeys.all, "snapshot", id, "assessments"] as const,
  riskStats: () => [...riskMatrixKeys.all, "riskStats"] as const,
};

// ---------------------------------------------------------------------------
// Risk Matrix Configs
// ---------------------------------------------------------------------------

export function useRiskMatrixConfigs() {
  return useQuery({
    queryKey: riskMatrixKeys.configs(),
    queryFn: () =>
      api.get<PaginatedResponse<RiskMatrixConfig>>("/compliance/risk-matrix-configs/", {
        per_page: "100",
      }),
  });
}

export function useRiskMatrixConfig(id: string) {
  return useQuery({
    queryKey: riskMatrixKeys.config(id),
    queryFn: () => api.get<RiskMatrixConfig>(`/compliance/risk-matrix-configs/${id}/`),
    enabled: !!id,
  });
}

export function useCreateRiskMatrixConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<RiskMatrixConfig>("/compliance/risk-matrix-configs/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.configs() });
    },
  });
}

export function useUpdateRiskMatrixConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<RiskMatrixConfig>(`/compliance/risk-matrix-configs/${id}/`, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.config(variables.id) });
      qc.invalidateQueries({ queryKey: riskMatrixKeys.configs() });
    },
  });
}

export function useDuplicateRiskMatrixConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<RiskMatrixConfig>(`/compliance/risk-matrix-configs/${id}/duplicate/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.configs() });
    },
  });
}

export function useActivateRiskMatrixConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<RiskMatrixConfig>(`/compliance/risk-matrix-configs/${id}/activate/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.configs() });
    },
  });
}

// ---------------------------------------------------------------------------
// Entity Risk
// ---------------------------------------------------------------------------

export function useEntityRiskAssessment(entityId: string) {
  return useQuery({
    queryKey: riskMatrixKeys.entityRisk(entityId),
    queryFn: () =>
      api.get<RiskAssessment>(`/compliance/entities/${entityId}/risk-assessment/`),
    enabled: !!entityId,
  });
}

export function useEntityRiskHistory(entityId: string) {
  return useQuery({
    queryKey: riskMatrixKeys.entityRiskHistory(entityId),
    queryFn: () =>
      api.get<PaginatedResponse<RiskAssessment>>(
        `/compliance/entities/${entityId}/risk-history/`,
        { per_page: "50" },
      ),
    enabled: !!entityId,
  });
}

export function useCalculateEntityRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string) =>
      api.post<RiskAssessment>(`/compliance/entities/${entityId}/calculate-risk/`),
    onSuccess: (_data, entityId) => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.entityRisk(entityId) });
      qc.invalidateQueries({ queryKey: riskMatrixKeys.entityRiskHistory(entityId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Person Risk
// ---------------------------------------------------------------------------

export function usePersonRiskAssessment(personId: string) {
  return useQuery({
    queryKey: riskMatrixKeys.personRisk(personId),
    queryFn: () =>
      api.get<RiskAssessment>(`/compliance/persons/${personId}/risk-assessment/`),
    enabled: !!personId,
  });
}

export function usePersonRiskHistory(personId: string) {
  return useQuery({
    queryKey: riskMatrixKeys.personRiskHistory(personId),
    queryFn: () =>
      api.get<PaginatedResponse<RiskAssessment>>(
        `/compliance/persons/${personId}/risk-history/`,
        { per_page: "50" },
      ),
    enabled: !!personId,
  });
}

export function useCalculatePersonRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) =>
      api.post<RiskAssessment>(`/compliance/persons/${personId}/calculate-risk/`),
    onSuccess: (_data, personId) => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.personRisk(personId) });
      qc.invalidateQueries({ queryKey: riskMatrixKeys.personRiskHistory(personId) });
    },
  });
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

export function useExportRiskPDF() {
  return useMutation({
    mutationFn: async (assessmentId: string) => {
      const response = await fetch(
        `${ENV.API_BASE_URL}/compliance/risk-assessments/${assessmentId}/export-pdf/`,
        {
          credentials: "include",
          headers: {
            "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "",
          },
        },
      );
      if (!response.ok) throw new Error("PDF export failed");
      return response.blob();
    },
  });
}

// ---------------------------------------------------------------------------
// Compliance Snapshots
// ---------------------------------------------------------------------------

export function useComplianceSnapshots() {
  return useQuery({
    queryKey: riskMatrixKeys.snapshots(),
    queryFn: () =>
      api.get<PaginatedResponse<ComplianceSnapshot>>("/compliance/snapshots/", {
        per_page: "50",
      }),
  });
}

export function useComplianceSnapshot(id: string) {
  return useQuery({
    queryKey: riskMatrixKeys.snapshot(id),
    queryFn: () => api.get<ComplianceSnapshot>(`/compliance/snapshots/${id}/`),
    enabled: !!id,
  });
}

export function useSnapshotAssessments(id: string) {
  return useQuery({
    queryKey: riskMatrixKeys.snapshotAssessments(id),
    queryFn: () =>
      api.get<PaginatedResponse<RiskAssessment>>(
        `/compliance/snapshots/${id}/assessments/`,
        { per_page: "200" },
      ),
    enabled: !!id,
  });
}

export function useCreateComplianceSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; notes?: string }) =>
      api.post<ComplianceSnapshot>("/compliance/snapshots/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: riskMatrixKeys.snapshots() });
    },
  });
}

export function useExportSnapshotPDF() {
  return useMutation({
    mutationFn: async (snapshotId: string) => {
      const response = await fetch(
        `${ENV.API_BASE_URL}/compliance/snapshots/${snapshotId}/export-pdf/`,
        {
          credentials: "include",
          headers: {
            "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "",
          },
        },
      );
      if (!response.ok) throw new Error("Snapshot PDF export failed");
      return response.blob();
    },
  });
}

// ---------------------------------------------------------------------------
// Risk Stats
// ---------------------------------------------------------------------------

export interface RiskStats {
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
}

export function useRiskStats() {
  return useQuery({
    queryKey: riskMatrixKeys.riskStats(),
    queryFn: () => api.get<RiskStats>("/compliance/risk-stats/"),
  });
}
