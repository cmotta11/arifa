import { api } from "@/lib/api-client";
import type {
  WorkflowState,
  Ticket,
  PaginatedResponse,
} from "@/types";

export async function getWorkflowStates(): Promise<WorkflowState[]> {
  return api.get<WorkflowState[]>("/workflow/states/");
}

export type KanbanView = "all" | "my" | "gestora" | "compliance" | "registry";

export async function getTickets(view?: KanbanView): Promise<Ticket[]> {
  // Fetch tickets filtered by view (unpaginated for the kanban board)
  const params: Record<string, string> = { per_page: "200" };
  if (view) {
    params.view = view;
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
  comment?: string
): Promise<Ticket> {
  return api.post<Ticket>(`/workflow/tickets/${ticketId}/transition/`, {
    new_state_id: newStateId,
    comment: comment ?? "",
  });
}
