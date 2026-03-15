import { api } from "@/lib/api-client";
import type { Ticket, PaginatedResponse } from "@/types";

export interface IncDashboardMetrics {
  total_active: number;
  by_stage: Record<string, number>;
  avg_processing_days: number;
  completed_this_month: number;
  pending_payment: number;
  high_capital_count: number;
}

export async function getIncMetrics(): Promise<IncDashboardMetrics> {
  return api.get<IncDashboardMetrics>("/workflow/tickets/inc-metrics/");
}

export async function getIncTickets(params?: Record<string, string>): Promise<Ticket[]> {
  const response = await api.get<PaginatedResponse<Ticket>>("/workflow/tickets/", {
    ...params,
    workflow_definition_name: "INC_PANAMA,INC_BVI,INC_PANAMA_DIGITAL",
    per_page: "200",
  });
  return response.results;
}

export interface PaymentRecord {
  id: string;
  ticket: string;
  ticket_title: string;
  amount: string;
  currency: string;
  payment_method: string;
  receipt_reference: string;
  recorded_by: string;
  recorded_by_email: string;
  recorded_at: string;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
}

export async function recordPayment(ticketId: string, data: {
  amount: string;
  currency?: string;
  payment_method: string;
  receipt_reference: string;
}): Promise<PaymentRecord> {
  return api.post<PaymentRecord>("/services/requests/record-payment/", {
    ticket_id: ticketId,
    ...data,
  });
}

export async function getPaymentRecords(params?: Record<string, string>): Promise<PaymentRecord[]> {
  const response = await api.get<PaginatedResponse<PaymentRecord>>(
    "/services/requests/payments/",
    { per_page: "200", ...params },
  );
  return response.results;
}

export async function approvePayment(paymentId: string): Promise<PaymentRecord> {
  return api.post<PaymentRecord>(`/services/requests/payments/${paymentId}/approve/`);
}

export interface CommissionRecord {
  entity_name: string;
  registry_date: string;
  commission_amount: string;
  status: string;
}

export interface ExpenseRecord {
  entity_name: string;
  category: string;
  amount: string;
  status: string;
}

export async function getCommissionReport(params?: Record<string, string>): Promise<CommissionRecord[]> {
  return api.get<CommissionRecord[]>("/workflow/tickets/inc-commissions/", params);
}

export async function getExpenseReport(params?: Record<string, string>): Promise<ExpenseRecord[]> {
  return api.get<ExpenseRecord[]>("/workflow/tickets/inc-expenses/", params);
}
