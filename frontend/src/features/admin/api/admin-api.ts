import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  User,
  Role,
  WorkflowState,
  WorkflowTransition,
  PaginatedResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserFilters {
  role?: Role;
  is_active?: boolean;
}

export interface CreateUserPayload {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: Role;
  client_id?: string | null;
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  role?: Role;
  is_active?: boolean;
}

export interface AdminUser extends User {
  is_active: boolean;
  date_joined: string;
}

export interface CreateWorkflowStatePayload {
  name: string;
  order_index: number;
  is_initial: boolean;
  is_final: boolean;
}

export interface UpdateWorkflowStatePayload {
  name?: string;
  order_index?: number;
  is_initial?: boolean;
  is_final?: boolean;
}

export interface CreateWorkflowTransitionPayload {
  name: string;
  from_state: string;
  to_state: string;
  allowed_roles: Role[];
}

export interface UpdateWorkflowTransitionPayload {
  name?: string;
  from_state?: string;
  to_state?: string;
  allowed_roles?: Role[];
}

export interface JurisdictionRisk {
  id: string;
  country_code: string;
  country_name: string;
  risk_weight: number;
  risk_level: "low" | "medium" | "high";
}

export interface CreateJurisdictionRiskPayload {
  country_code: string;
  country_name: string;
  risk_weight: number;
}

export interface UpdateJurisdictionRiskPayload {
  country_code?: string;
  country_name?: string;
  risk_weight?: number;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const adminKeys = {
  all: ["admin"] as const,
  users: (filters?: UserFilters) => [...adminKeys.all, "users", filters] as const,
  user: (id: string) => [...adminKeys.all, "users", id] as const,
  workflowStates: () => [...adminKeys.all, "workflow-states"] as const,
  workflowTransitions: () => [...adminKeys.all, "workflow-transitions"] as const,
  jurisdictionRisks: () => [...adminKeys.all, "jurisdiction-risks"] as const,
};

// ---------------------------------------------------------------------------
// User Queries & Mutations
// ---------------------------------------------------------------------------

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: adminKeys.users(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.role) params.role = filters.role;
      if (filters?.is_active !== undefined) params.is_active = String(filters.is_active);
      const response = await api.get<PaginatedResponse<AdminUser>>(
        "/auth/users/",
        params,
      );
      return response.results;
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.user(id!),
    queryFn: () => api.get<AdminUser>(`/auth/users/${id}/`),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) =>
      api.post<AdminUser>("/auth/users/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateUserPayload & { id: string }) =>
      api.patch<AdminUser>(`/auth/users/${id}/`, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.user(id) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useSendMagicLink() {
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<{ message: string }>("/auth/magic-link/send/", {
        user_id: userId,
      }),
  });
}

// ---------------------------------------------------------------------------
// Workflow State Queries & Mutations
// ---------------------------------------------------------------------------

export function useWorkflowStates() {
  return useQuery({
    queryKey: adminKeys.workflowStates(),
    queryFn: async () => {
      const response = await api.get<WorkflowState[] | PaginatedResponse<WorkflowState>>(
        "/workflow/states/",
      );
      // Handle both array and paginated response
      if (Array.isArray(response)) return response;
      return response.results;
    },
  });
}

export function useCreateWorkflowState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWorkflowStatePayload) =>
      api.post<WorkflowState>("/workflow/states/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.workflowStates() });
    },
  });
}

export function useUpdateWorkflowState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateWorkflowStatePayload & { id: string }) =>
      api.patch<WorkflowState>(`/workflow/states/${id}/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.workflowStates() });
    },
  });
}

export function useDeleteWorkflowState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/workflow/states/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.workflowStates() });
    },
  });
}

// ---------------------------------------------------------------------------
// Workflow Transition Queries & Mutations
// ---------------------------------------------------------------------------

export function useWorkflowTransitions() {
  return useQuery({
    queryKey: adminKeys.workflowTransitions(),
    queryFn: async () => {
      const response = await api.get<
        WorkflowTransition[] | PaginatedResponse<WorkflowTransition>
      >("/workflow/transitions/");
      if (Array.isArray(response)) return response;
      return response.results;
    },
  });
}

export function useCreateWorkflowTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWorkflowTransitionPayload) =>
      api.post<WorkflowTransition>("/workflow/transitions/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.workflowTransitions() });
    },
  });
}

export function useUpdateWorkflowTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateWorkflowTransitionPayload & { id: string }) =>
      api.patch<WorkflowTransition>(`/workflow/transitions/${id}/`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.workflowTransitions() });
    },
  });
}

export function useDeleteWorkflowTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/workflow/transitions/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.workflowTransitions() });
    },
  });
}

// ---------------------------------------------------------------------------
// Jurisdiction Risk Queries & Mutations
// ---------------------------------------------------------------------------

export function useJurisdictionRisks() {
  return useQuery({
    queryKey: adminKeys.jurisdictionRisks(),
    queryFn: async () => {
      const response = await api.get<
        JurisdictionRisk[] | PaginatedResponse<JurisdictionRisk>
      >("/compliance/jurisdiction-risks/");
      if (Array.isArray(response)) return response;
      return response.results;
    },
  });
}

export function useCreateJurisdictionRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateJurisdictionRiskPayload) =>
      api.post<JurisdictionRisk>("/compliance/jurisdiction-risks/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jurisdictionRisks() });
    },
  });
}

export function useUpdateJurisdictionRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateJurisdictionRiskPayload & { id: string }) =>
      api.patch<JurisdictionRisk>(
        `/compliance/jurisdiction-risks/${id}/`,
        payload,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jurisdictionRisks() });
    },
  });
}

export function useDeleteJurisdictionRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/compliance/jurisdiction-risks/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.jurisdictionRisks() });
    },
  });
}
