import { api } from "@/lib/api-client";
import type {
  Ticket,
  TicketLog,
  KYCSubmission,
  PaginatedResponse,
} from "@/types";

export interface DashboardStats {
  pendingTickets: number;
  activeKyc: number;
  highRiskEntities: number;
  completedThisMonth: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [ticketsResponse, kycResponse] = await Promise.all([
    api.get<PaginatedResponse<Ticket>>("/workflow/tickets/"),
    api.get<PaginatedResponse<KYCSubmission>>("/compliance/kyc/"),
  ]);

  const tickets = ticketsResponse.results;
  const kycSubmissions = kycResponse.results;

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingTickets = tickets.filter(
    (t) => !t.current_state.is_final
  ).length;

  const activeKyc = kycSubmissions.filter(
    (k) => k.status === "submitted" || k.status === "under_review"
  ).length;

  const highRiskEntities = 0; // Will be fetched from risk assessment endpoint in future

  const completedThisMonth = tickets.filter(
    (t) =>
      t.current_state.is_final &&
      new Date(t.updated_at) >= firstDayOfMonth
  ).length;

  return {
    pendingTickets,
    activeKyc,
    highRiskEntities,
    completedThisMonth,
  };
}

export async function getRecentActivity(): Promise<TicketLog[]> {
  // Fetch recent ticket logs - uses the first page with a small page size
  const response = await api.get<PaginatedResponse<TicketLog>>(
    "/workflow/tickets/",
    { per_page: "1" }
  );

  if (response.results.length === 0) {
    return [];
  }

  // Get logs from the most recent tickets
  const recentTickets = await api.get<PaginatedResponse<Ticket>>(
    "/workflow/tickets/",
    { per_page: "5", sort_by: "Modified_Time", sort_order: "desc" }
  );

  const logPromises = recentTickets.results.map((ticket) =>
    api
      .get<PaginatedResponse<TicketLog>>(
        `/workflow/tickets/${ticket.id}/logs/`,
        { per_page: "2" }
      )
      .then((res) => res.results)
      .catch(() => [] as TicketLog[])
  );

  const allLogs = (await Promise.all(logPromises)).flat();

  return allLogs
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 5);
}
