import { api } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  pending_invoices: number;
  pending_amount: number;
  by_jurisdiction: Array<{
    jurisdiction: string;
    revenue: number;
    expenses: number;
  }>;
  by_month: Array<{ month: string; revenue: number; expenses: number }>;
}

export interface UserActivityUser {
  id: string;
  name: string;
  role: string;
  tickets_completed: number;
  avg_processing_days: number | null;
  last_active: string | null;
}

export interface UserActivityReport {
  users: UserActivityUser[];
  total_active_users: number;
  by_role: Record<string, number>;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getFinancialSummary(
  params?: { period?: string; jurisdiction?: string; date_from?: string },
): Promise<FinancialSummary> {
  const queryParams: Record<string, string> = {};
  if (params?.period) queryParams.period = params.period;
  if (params?.jurisdiction) queryParams.jurisdiction = params.jurisdiction;
  if (params?.date_from) queryParams.date_from = params.date_from;
  return api.get<FinancialSummary>("/core/reports/financial/", queryParams);
}

export async function getUserActivityReport(
  params?: { date_from?: string; date_to?: string },
): Promise<UserActivityReport> {
  const queryParams: Record<string, string> = {};
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;
  return api.get<UserActivityReport>(
    "/core/reports/user-activity/",
    queryParams,
  );
}
