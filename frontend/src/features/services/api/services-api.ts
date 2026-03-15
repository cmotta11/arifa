import { api } from "@/lib/api-client";
import type {
  ServiceCatalog,
  ServiceRequest,
  Quotation,
  IncorporationData,
  ExpenseRecord,
  NotaryDeed,
  PaginatedResponse,
} from "@/types";

// Service Catalog
export async function getServiceCatalog(
  params?: Record<string, string>,
): Promise<ServiceCatalog[]> {
  const response = await api.get<PaginatedResponse<ServiceCatalog>>(
    "/services/catalog/",
    params,
  );
  return response.results;
}

// Service Requests
export async function getServiceRequests(
  params?: Record<string, string>,
): Promise<ServiceRequest[]> {
  const response = await api.get<PaginatedResponse<ServiceRequest>>(
    "/services/requests/",
    params,
  );
  return response.results;
}

export async function getServiceRequest(id: string): Promise<ServiceRequest> {
  return api.get<ServiceRequest>(`/services/requests/${id}/`);
}

export async function createServiceRequest(data: {
  client_id: string;
  jurisdiction_id?: string;
  notes?: string;
}): Promise<ServiceRequest> {
  return api.post<ServiceRequest>("/services/requests/", data);
}

export async function addServiceItem(
  requestId: string,
  data: { service_id: string; quantity?: number },
): Promise<ServiceRequest> {
  return api.post<ServiceRequest>(
    `/services/requests/${requestId}/add-item/`,
    data,
  );
}

export async function removeServiceItem(
  requestId: string,
  itemId: string,
): Promise<void> {
  return api.post(`/services/requests/${requestId}/remove-item/`, {
    item_id: itemId,
  });
}

export async function submitServiceRequest(
  requestId: string,
): Promise<ServiceRequest> {
  return api.post<ServiceRequest>(
    `/services/requests/${requestId}/submit/`,
  );
}

// Quotations
export async function getQuotations(
  params?: Record<string, string>,
): Promise<Quotation[]> {
  const response = await api.get<PaginatedResponse<Quotation>>(
    "/services/quotations/",
    params,
  );
  return response.results;
}

export async function getQuotation(id: string): Promise<Quotation> {
  return api.get<Quotation>(`/services/quotations/${id}/`);
}

export async function generateQuotation(
  requestId: string,
): Promise<Quotation> {
  return api.post<Quotation>(`/services/quotations/generate/`, {
    request_id: requestId,
  });
}

export async function acceptQuotation(
  quotationId: string,
): Promise<Quotation> {
  return api.post<Quotation>(
    `/services/quotations/${quotationId}/accept/`,
  );
}

export async function rejectQuotation(
  quotationId: string,
  notes?: string,
): Promise<Quotation> {
  return api.post<Quotation>(
    `/services/quotations/${quotationId}/reject/`,
    { notes },
  );
}

// Incorporation Data
export async function saveIncorporationData(
  requestId: string,
  data: Partial<IncorporationData>,
): Promise<IncorporationData> {
  return api.post<IncorporationData>(
    `/services/incorporation-data/${requestId}/save/`,
    data,
  );
}

// Expenses
export async function getExpenses(
  params?: Record<string, string>,
): Promise<ExpenseRecord[]> {
  const response = await api.get<PaginatedResponse<ExpenseRecord>>(
    "/services/expenses/",
    params,
  );
  return response.results;
}

export async function recordExpense(data: {
  service_request_id?: string;
  entity_id?: string;
  ticket_id?: string;
  category: string;
  description: string;
  amount: string;
  currency?: string;
}): Promise<ExpenseRecord> {
  return api.post<ExpenseRecord>("/services/expenses/", data);
}

export async function markExpensePaid(
  expenseId: string,
  data: { payment_method?: string; payment_reference?: string },
): Promise<ExpenseRecord> {
  return api.post<ExpenseRecord>(
    `/services/expenses/${expenseId}/mark-paid/`,
    data,
  );
}

// Notary Deeds
export async function getNotaryDeeds(
  params?: Record<string, string>,
): Promise<NotaryDeed[]> {
  const response = await api.get<PaginatedResponse<NotaryDeed>>(
    "/services/deeds/",
    params,
  );
  return response.results;
}
