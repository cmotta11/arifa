import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Types

export interface AccountingRecord {
  id: string;
  entity: string;
  entity_name: string;
  client_name: string | null;
  fiscal_year: number;
  form_type: string;
  form_type_display: string;
  status: string;
  status_display: string;
  form_data: Record<string, unknown>;
  signature_data: string;
  signer_name: string;
  signer_identification: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  review_notes: string;
  guest_link_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountingRecordDocument {
  id: string;
  accounting_record: string;
  file_url: string | null;
  original_filename: string;
  file_size: number;
  mime_type: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface AccountingRecordSummary {
  total: number;
  pending: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
}

export interface SaveDraftInput {
  form_type?: string;
  form_data?: Record<string, unknown>;
  signature_data?: string;
  signer_name?: string;
  signer_identification?: string;
}

// Query keys

export const accountingRecordKeys = {
  all: ["accounting-records"] as const,
  list: (params?: Record<string, string>) =>
    [...accountingRecordKeys.all, "list", params] as const,
  detail: (id: string) => [...accountingRecordKeys.all, "detail", id] as const,
  summary: (fiscalYear: number) =>
    [...accountingRecordKeys.all, "summary", fiscalYear] as const,
  documents: (id: string) =>
    [...accountingRecordKeys.all, "documents", id] as const,
  guest: (id: string) =>
    [...accountingRecordKeys.all, "guest", id] as const,
  guestDocuments: (id: string) =>
    [...accountingRecordKeys.all, "guest-documents", id] as const,
};

// Staff hooks

export function useAccountingRecords(params?: Record<string, string>) {
  return useQuery({
    queryKey: accountingRecordKeys.list(params),
    queryFn: () =>
      api.get<{ results: AccountingRecord[]; count: number }>(
        "/compliance/accounting-records/",
        params,
      ),
  });
}

export function useAccountingRecord(id: string) {
  return useQuery({
    queryKey: accountingRecordKeys.detail(id),
    queryFn: () =>
      api.get<AccountingRecord>(`/compliance/accounting-records/${id}/`),
    enabled: !!id,
  });
}

export function useAccountingRecordSummary(fiscalYear: number) {
  return useQuery({
    queryKey: accountingRecordKeys.summary(fiscalYear),
    queryFn: () =>
      api.get<AccountingRecordSummary>(
        "/compliance/accounting-records/summary/",
        { fiscal_year: String(fiscalYear) },
      ),
  });
}

export function useAccountingRecordDocuments(id: string) {
  return useQuery({
    queryKey: accountingRecordKeys.documents(id),
    queryFn: () =>
      api.get<AccountingRecordDocument[]>(
        `/compliance/accounting-records/${id}/documents/`,
      ),
    enabled: !!id,
  });
}

export function useCreateAccountingRecordForEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entity_id,
      fiscal_year,
    }: {
      entity_id: string;
      fiscal_year: number;
    }) =>
      api.post<AccountingRecord>(
        "/compliance/accounting-records/create-for-entity/",
        { entity_id, fiscal_year },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingRecordKeys.all });
    },
  });
}

export function useBulkCreateAccountingRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fiscalYear: number) =>
      api.post<AccountingRecord[]>(
        "/compliance/accounting-records/bulk-create/",
        { fiscal_year: fiscalYear },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingRecordKeys.all });
    },
  });
}

export function useApproveAccountingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      review_notes,
    }: {
      id: string;
      review_notes?: string;
    }) =>
      api.post<AccountingRecord>(
        `/compliance/accounting-records/${id}/approve/`,
        { review_notes },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingRecordKeys.all });
    },
  });
}

export function useRejectAccountingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      review_notes,
    }: {
      id: string;
      review_notes?: string;
    }) =>
      api.post<AccountingRecord>(
        `/compliance/accounting-records/${id}/reject/`,
        { review_notes },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingRecordKeys.all });
    },
  });
}

// Guest hooks

export function useGuestAccountingRecord(id: string) {
  return useQuery({
    queryKey: accountingRecordKeys.guest(id),
    queryFn: () =>
      api.get<AccountingRecord>(`/compliance/accounting-records/${id}/guest/`),
    enabled: !!id,
  });
}

export function useSaveAccountingDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SaveDraftInput }) =>
      api.patch<AccountingRecord>(
        `/compliance/accounting-records/${id}/guest/`,
        data,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: accountingRecordKeys.guest(variables.id),
      });
    },
  });
}

export function useSubmitAccountingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<AccountingRecord>(
        `/compliance/accounting-records/${id}/guest/submit/`,
      ),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: accountingRecordKeys.guest(id),
      });
    },
  });
}

export function useGuestAccountingDocuments(id: string) {
  return useQuery({
    queryKey: accountingRecordKeys.guestDocuments(id),
    queryFn: () =>
      api.get<AccountingRecordDocument[]>(
        `/compliance/accounting-records/${id}/guest/documents/`,
      ),
    enabled: !!id,
  });
}

export function useUploadAccountingDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      description,
    }: {
      id: string;
      file: File;
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (description) formData.append("description", description);
      return api.upload<AccountingRecordDocument>(
        `/compliance/accounting-records/${id}/guest/documents/`,
        formData,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: accountingRecordKeys.guestDocuments(variables.id),
      });
    },
  });
}
