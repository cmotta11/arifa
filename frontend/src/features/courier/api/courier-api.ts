import { api } from "@/lib/api-client";
import type { Ticket, PaginatedResponse, WorkflowState } from "@/types";

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface ArchiveQueryParams {
  page?: number;
  per_page?: number;
  view?: string;
}

export interface CourierBatchParams {
  page?: number;
  per_page?: number;
  dispatch_date_after?: string;
  dispatch_date_before?: string;
}

// ---------------------------------------------------------------------------
// Archive entries (ARCHIVE workflow)
// ---------------------------------------------------------------------------

export async function fetchArchiveEntries(
  params?: ArchiveQueryParams,
): Promise<Ticket[]> {
  const queryParams: Record<string, string> = {
    workflow_definition_name: "ARCHIVE",
    per_page: String(params?.per_page ?? 200),
  };
  if (params?.page) queryParams.page = String(params.page);
  if (params?.view) queryParams.view = params.view;

  const response = await api.get<PaginatedResponse<Ticket>>(
    "/workflow/tickets/",
    queryParams,
  );
  return response.results;
}

// ---------------------------------------------------------------------------
// Update archive entry (tracking number, dispatch date, etc.)
// ---------------------------------------------------------------------------

export async function updateArchiveEntry(
  id: string,
  data: Partial<{
    metadata: Record<string, unknown>;
    title: string;
    priority: string;
    due_date: string | null;
  }>,
): Promise<Ticket> {
  return api.patch<Ticket>(`/workflow/tickets/${id}/`, data);
}

// ---------------------------------------------------------------------------
// Courier batch - tickets in "dispatched" state
// ---------------------------------------------------------------------------

export async function fetchCourierBatch(
  params?: CourierBatchParams,
): Promise<Ticket[]> {
  const queryParams: Record<string, string> = {
    workflow_definition_name: "ARCHIVE",
    current_state_name: "dispatched",
    per_page: String(params?.per_page ?? 200),
  };
  if (params?.page) queryParams.page = String(params.page);
  if (params?.dispatch_date_after)
    queryParams.dispatch_date_after = params.dispatch_date_after;
  if (params?.dispatch_date_before)
    queryParams.dispatch_date_before = params.dispatch_date_before;

  const response = await api.get<PaginatedResponse<Ticket>>(
    "/workflow/tickets/",
    queryParams,
  );
  return response.results;
}

// ---------------------------------------------------------------------------
// Transition an archive ticket to a new state
// ---------------------------------------------------------------------------

export async function transitionArchiveTicket(
  ticketId: string,
  newStateId: string,
  comment?: string,
): Promise<Ticket> {
  return api.post<Ticket>(`/workflow/tickets/${ticketId}/transition/`, {
    new_state_id: newStateId,
    comment: comment ?? "",
  });
}

// ---------------------------------------------------------------------------
// Fetch workflow states for the ARCHIVE workflow
// ---------------------------------------------------------------------------

export async function fetchArchiveStates(
  workflowDefinitionId?: string,
): Promise<WorkflowState[]> {
  const params: Record<string, string> = {};
  if (workflowDefinitionId) {
    params.workflow_definition = workflowDefinitionId;
  }
  const response = await api.get<
    WorkflowState[] | PaginatedResponse<WorkflowState>
  >("/workflow/states/", params);
  if (Array.isArray(response)) return response;
  return response.results;
}
