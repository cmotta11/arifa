import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  Ticket,
  TicketLog,
  WorkflowTransition,
  PaginatedResponse,
  User,
} from "@/types";

export async function getTicket(id: string): Promise<Ticket> {
  return api.get<Ticket>(`/workflow/tickets/${id}/`);
}

export async function getTicketLogs(id: string): Promise<TicketLog[]> {
  const response = await api.get<PaginatedResponse<TicketLog>>(
    `/workflow/tickets/${id}/logs/`
  );
  return response.results;
}

export async function getAvailableTransitions(
  id: string
): Promise<WorkflowTransition[]> {
  return api.get<WorkflowTransition[]>(
    `/workflow/tickets/${id}/transitions/`
  );
}

export async function transitionTicket(
  id: string,
  newStateId: string,
  comment?: string
): Promise<Ticket> {
  return api.post<Ticket>(`/workflow/tickets/${id}/transition/`, {
    new_state_id: newStateId,
    comment: comment ?? "",
  });
}

export async function assignTicket(
  id: string,
  userId: string
): Promise<Ticket> {
  return api.post<Ticket>(`/workflow/tickets/${id}/assign/`, {
    assigned_to_id: userId,
  });
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<PaginatedResponse<User>>("/auth/users/");
  return response.results;
}

// ─── Create Ticket ─────────────────────────────────────────────────────────

export interface CreateTicketInput {
  title: string;
  client_id: string;
  entity_id?: string | null;
  workflow_definition_id?: string | null;
  priority?: string;
  due_date?: string | null;
  assigned_to_id?: string | null;
}

async function createTicket(data: CreateTicketInput): Promise<Ticket> {
  return api.post<Ticket>("/workflow/tickets/", data);
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketInput) => createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban", "tickets"] });
    },
  });
}
