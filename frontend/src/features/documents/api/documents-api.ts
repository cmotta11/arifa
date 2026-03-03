import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  DocumentTemplate,
  DocumentUpload,
  GeneratedDocument,
  PaginatedResponse,
} from "@/types";

// ─── Query Key Factories ────────────────────────────────────────────────────

export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  listByKYC: (kycId: string) => [...documentKeys.lists(), "kyc", kycId] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  extraction: (taskId: string) => [...documentKeys.all, "extraction", taskId] as const,
};

export const templateKeys = {
  all: ["templates"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  list: (filters?: TemplateFilters) => [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, "detail"] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

export const generatedKeys = {
  all: ["generated-documents"] as const,
  lists: () => [...generatedKeys.all, "list"] as const,
  list: (ticketId?: string) => [...generatedKeys.lists(), ticketId] as const,
  details: () => [...generatedKeys.all, "detail"] as const,
  detail: (id: string) => [...generatedKeys.details(), id] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UploadDocumentParams {
  kycId: string;
  file: File;
  documentType: DocumentUpload["document_type"];
  partyId?: string;
}

export interface ExtractDocumentParams {
  file: File;
  documentType: DocumentUpload["document_type"];
}

export interface ExtractDocumentResponse {
  task_id: string;
  status: "processing";
}

export interface DeleteDocumentParams {
  documentId: string;
  kycId: string;
}

export interface TemplateFilters {
  entity_type?: string;
  jurisdiction?: string;
  is_active?: string;
}

export interface GenerateDocumentParams {
  ticket_id: string;
  template_id: string;
  context_data?: Record<string, string>;
}

// ─── Raw API Functions ──────────────────────────────────────────────────────

export async function fetchKYCDocuments(
  kycId: string,
): Promise<DocumentUpload[]> {
  const response = await api.get<PaginatedResponse<DocumentUpload>>(
    `/compliance/kyc/${kycId}/documents/`,
  );
  return response.results;
}

export async function uploadDocument(
  params: UploadDocumentParams,
): Promise<DocumentUpload> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("document_type", params.documentType);
  if (params.partyId) {
    formData.append("party_id", params.partyId);
  }
  return api.upload<DocumentUpload>(
    `/compliance/kyc/${params.kycId}/documents/upload/`,
    formData,
  );
}

export async function extractDocument(
  params: ExtractDocumentParams,
): Promise<ExtractDocumentResponse> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("document_type", params.documentType);
  return api.upload<ExtractDocumentResponse>(
    "/compliance/extract-document/",
    formData,
  );
}

export async function deleteDocument(documentId: string): Promise<void> {
  return api.delete<void>(`/compliance/documents/${documentId}/`);
}

// ─── Query Hooks ────────────────────────────────────────────────────────────

export function useKYCDocuments(kycId: string | undefined) {
  return useQuery({
    queryKey: documentKeys.listByKYC(kycId!),
    queryFn: () => fetchKYCDocuments(kycId!),
    enabled: !!kycId,
  });
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UploadDocumentParams) => uploadDocument(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByKYC(variables.kycId),
      });
    },
  });
}

export function useExtractDocument() {
  return useMutation({
    mutationFn: (params: ExtractDocumentParams) => extractDocument(params),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: DeleteDocumentParams) =>
      deleteDocument(params.documentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByKYC(variables.kycId),
      });
    },
  });
}

// ─── Template Raw API Functions ────────────────────────────────────────────

async function fetchTemplates(
  filters?: TemplateFilters,
): Promise<DocumentTemplate[]> {
  const params: Record<string, string> = {};
  if (filters?.entity_type) params.entity_type = filters.entity_type;
  if (filters?.jurisdiction) params.jurisdiction = filters.jurisdiction;
  if (filters?.is_active) params.is_active = filters.is_active;

  const response = await api.get<PaginatedResponse<DocumentTemplate>>(
    "/documents/templates/",
    params,
  );
  return response.results;
}

async function createTemplate(params: {
  name: string;
  file: File;
  entity_type: string;
  jurisdiction: string;
}): Promise<DocumentTemplate> {
  const formData = new FormData();
  formData.append("name", params.name);
  formData.append("file", params.file);
  if (params.entity_type) formData.append("entity_type", params.entity_type);
  if (params.jurisdiction) formData.append("jurisdiction", params.jurisdiction);
  return api.upload<DocumentTemplate>("/documents/templates/", formData);
}

async function toggleTemplate(id: string): Promise<DocumentTemplate> {
  return api.post<DocumentTemplate>(`/documents/templates/${id}/toggle-active/`);
}

async function generateDocument(
  params: GenerateDocumentParams,
): Promise<GeneratedDocument> {
  return api.post<GeneratedDocument>("/documents/generate/", params);
}

async function fetchGeneratedDocuments(
  ticketId?: string,
): Promise<GeneratedDocument[]> {
  const params: Record<string, string> = {};
  if (ticketId) params.ticket_id = ticketId;

  const response = await api.get<PaginatedResponse<GeneratedDocument>>(
    "/documents/generated/",
    params,
  );
  return response.results;
}

async function fetchGeneratedDocument(
  id: string,
): Promise<GeneratedDocument> {
  return api.get<GeneratedDocument>(`/documents/generated/${id}/`);
}

async function convertToPDF(id: string): Promise<{ task_id: string }> {
  return api.post<{ task_id: string }>(`/documents/generated/${id}/convert-pdf/`);
}

// ─── Template Query Hooks ──────────────────────────────────────────────────

export function useTemplates(filters?: TemplateFilters) {
  return useQuery({
    queryKey: templateKeys.list(filters),
    queryFn: () => fetchTemplates(filters),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

export function useToggleTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => toggleTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

// ─── Generated Document Query Hooks ────────────────────────────────────────

export function useGenerateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: generatedKeys.lists() });
    },
  });
}

export function useGeneratedDocuments(ticketId?: string) {
  return useQuery({
    queryKey: generatedKeys.list(ticketId),
    queryFn: () => fetchGeneratedDocuments(ticketId),
  });
}

export function useGeneratedDocument(id: string | undefined) {
  return useQuery({
    queryKey: generatedKeys.detail(id!),
    queryFn: () => fetchGeneratedDocument(id!),
    enabled: !!id,
  });
}

export function useConvertToPDF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => convertToPDF(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: generatedKeys.lists() });
    },
  });
}
