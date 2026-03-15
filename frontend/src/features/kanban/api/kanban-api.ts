import { api } from "@/lib/api-client";
import type {
  WorkflowDefinition,
  WorkflowState,
  Ticket,
  PaginatedResponse,
} from "@/types";

export async function getWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  const response = await api.get<
    WorkflowDefinition[] | PaginatedResponse<WorkflowDefinition>
  >("/workflow/definitions/");
  if (Array.isArray(response)) return response;
  return response.results;
}

export async function getWorkflowStates(
  workflowDefinitionId?: string,
): Promise<WorkflowState[]> {
  const params: Record<string, string> = {};
  if (workflowDefinitionId) {
    params.workflow_definition = workflowDefinitionId;
  }
  const response = await api.get<WorkflowState[] | PaginatedResponse<WorkflowState>>(
    "/workflow/states/",
    params,
  );
  if (Array.isArray(response)) return response;
  return response.results;
}

export type KanbanView = "all" | "my" | "gestora" | "compliance" | "registry";

export async function getTickets(
  view?: KanbanView,
  workflowDefinitionId?: string,
): Promise<Ticket[]> {
  const params: Record<string, string> = { per_page: "200" };
  if (view) {
    params.view = view;
  }
  if (workflowDefinitionId) {
    params.workflow_definition = workflowDefinitionId;
  }
  const response = await api.get<PaginatedResponse<Ticket>>(
    "/workflow/tickets/",
    params,
  );
  return response.results;
}

export async function transitionTicket(
  ticketId: string,
  newStateId: string,
  comment?: string,
): Promise<Ticket> {
  return api.post<Ticket>(`/workflow/tickets/${ticketId}/transition/`, {
    new_state_id: newStateId,
    comment: comment ?? "",
  });
}

export async function bulkTransitionTickets(
  ticketIds: string[],
  newStateId: string,
  comment?: string,
): Promise<Ticket[]> {
  return api.post<Ticket[]>("/workflow/tickets/bulk-transition/", {
    ticket_ids: ticketIds,
    new_state_id: newStateId,
    comment: comment ?? "",
  });
}
