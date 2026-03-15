import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OwnershipNode {
  id: string;
  label: string;
  node_type: "entity" | "person";
  ownership_pct: number;
  nationality?: string;
  jurisdiction?: string;
  pep_status?: boolean;
  exception_type?: string;
}

export interface OwnershipEdge {
  source: string;
  target: string;
  ownership_pct: number;
}

export interface ReportableUBO {
  id: string;
  name: string;
  effective_pct: number;
  chain: string[];
}

export interface OwnershipTreeResponse {
  nodes: OwnershipNode[];
  edges: OwnershipEdge[];
  reportable_ubos: ReportableUBO[];
  warnings: string[];
}

export interface OwnershipSnapshotRecord {
  id: string;
  entity: string;
  nodes: OwnershipNode[];
  edges: OwnershipEdge[];
  reportable_ubos: ReportableUBO[];
  warnings: string[];
  saved_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const ownershipKeys = {
  all: ["ownership"] as const,
  tree: (entityId: string) => [...ownershipKeys.all, "tree", entityId] as const,
  auditLog: (entityId: string) => [...ownershipKeys.all, "audit", entityId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useOwnershipTree(entityId: string) {
  return useQuery({
    queryKey: ownershipKeys.tree(entityId),
    queryFn: () =>
      api.get<OwnershipTreeResponse>(
        `/compliance/entities/${entityId}/ownership-tree/`
      ),
    enabled: !!entityId,
  });
}

export function useSaveOwnershipTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entityId,
      nodes,
      edges,
    }: {
      entityId: string;
      nodes: OwnershipNode[];
      edges: OwnershipEdge[];
    }) =>
      api.post(`/compliance/entities/${entityId}/ownership-tree/save/`, {
        nodes,
        edges,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ownershipKeys.tree(variables.entityId) });
      qc.invalidateQueries({ queryKey: ownershipKeys.auditLog(variables.entityId) });
    },
  });
}

export function useOwnershipAuditLog(entityId: string) {
  return useQuery({
    queryKey: ownershipKeys.auditLog(entityId),
    queryFn: () =>
      api.get<OwnershipSnapshotRecord[]>(
        `/compliance/entities/${entityId}/ownership-tree/audit-log/`
      ),
    enabled: !!entityId,
  });
}
