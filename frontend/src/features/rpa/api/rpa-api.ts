import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RPAJobStep {
  id: string;
  step_name: string;
  order_index: number;
  action: string;
  config: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RPAJobDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string;
  step_definitions: { name: string; action: string; config: Record<string, unknown> }[];
  required_input_fields: string[];
  target_integration: string;
  is_active: boolean;
  job_count: number;
  created_at: string;
  updated_at: string;
}

export interface RPAJob {
  id: string;
  definition_id: string;
  definition_name: string;
  ticket: string | null;
  ticket_title: string | null;
  entity: string | null;
  entity_name: string | null;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message: string;
  celery_task_id: string;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_by_email: string | null;
  steps: RPAJobStep[];
  progress: { total: number; completed: number };
  created_at: string;
  updated_at: string;
}

export interface RPAJobListItem {
  id: string;
  definition_name: string;
  ticket: string | null;
  ticket_title: string | null;
  entity: string | null;
  entity_name: string | null;
  status: RPAJob["status"];
  error_message: string;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  progress: { total: number; completed: number };
  created_at: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function getJobDefinitions(): Promise<RPAJobDefinition[]> {
  const response = await api.get<
    RPAJobDefinition[] | PaginatedResponse<RPAJobDefinition>
  >("/rpa/definitions/");
  if (Array.isArray(response)) return response;
  return response.results;
}

async function getJobs(params?: Record<string, string>): Promise<RPAJobListItem[]> {
  const response = await api.get<PaginatedResponse<RPAJobListItem>>(
    "/rpa/jobs/",
    params,
  );
  return response.results;
}

async function getJob(id: string): Promise<RPAJob> {
  return api.get<RPAJob>(`/rpa/jobs/${id}/`);
}

async function createJob(data: {
  definition_id: string;
  input_data: Record<string, unknown>;
  ticket_id?: string | null;
  entity_id?: string | null;
}): Promise<RPAJob> {
  return api.post<RPAJob>("/rpa/jobs/", data);
}

async function jobAction(id: string, action: "pause" | "resume" | "retry" | "cancel"): Promise<RPAJob> {
  return api.post<RPAJob>(`/rpa/jobs/${id}/${action}/`, {});
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useRPAJobDefinitions() {
  return useQuery({
    queryKey: ["rpa", "definitions"],
    queryFn: getJobDefinitions,
  });
}

export function useRPAJobs(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["rpa", "jobs", params],
    queryFn: () => getJobs(params),
    refetchInterval: 10000, // Poll every 10s for status updates
  });
}

export function useRPAJob(id: string) {
  return useQuery({
    queryKey: ["rpa", "jobs", id],
    queryFn: () => getJob(id),
    refetchInterval: 5000, // Poll more frequently for detail view
    enabled: !!id,
  });
}

export function useCreateRPAJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rpa", "jobs"] });
    },
  });
}

export function useRPAJobAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "retry" | "cancel" }) =>
      jobAction(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rpa", "jobs"] });
    },
  });
}
