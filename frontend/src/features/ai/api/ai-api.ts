import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIContext {
  page?: string;
  formSection?: string;
  entityType?: string;
  jurisdiction?: string;
  language?: string;
}

export interface AIResponse {
  response: string;
  suggestions?: string[];
}

export interface SuggestionParams {
  entity_type: string;
  jurisdiction: string;
  form_section: string;
}

export interface SuggestionItem {
  field: string;
  value: string;
  confidence: number;
}

export interface SuggestionResponse {
  suggestions: SuggestionItem[];
}

export interface ExplainResponse {
  explanation: string;
  factors: Array<{ name: string; impact: string; score: number }>;
}

export interface ReviewResponse {
  summary: string;
  issues: Array<{ field: string; issue: string; severity: string }>;
  completeness: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export function chatWithAI(
  message: string,
  context: AIContext,
): Promise<AIResponse> {
  return api.post<AIResponse>("/ai/chat/", { message, context });
}

export function getSuggestions(
  params: SuggestionParams,
): Promise<SuggestionResponse> {
  return api.post<SuggestionResponse>("/ai/suggest/", params);
}

export function explainRisk(
  entityId: string,
  riskAssessmentId: string,
): Promise<ExplainResponse> {
  return api.post<ExplainResponse>("/ai/explain-risk/", {
    entity_id: entityId,
    risk_assessment_id: riskAssessmentId,
  });
}

export function reviewDocument(
  documentId: string,
): Promise<ReviewResponse> {
  return api.post<ReviewResponse>("/ai/review-doc/", {
    document_id: documentId,
  });
}

// ---------------------------------------------------------------------------
// React Query hooks
// ---------------------------------------------------------------------------

export function useAIChat() {
  return useMutation({
    mutationFn: ({ message, context }: { message: string; context: AIContext }) =>
      chatWithAI(message, context),
  });
}

export function useAISuggestions() {
  return useMutation({
    mutationFn: (params: SuggestionParams) => getSuggestions(params),
  });
}

export function useAIExplainRisk() {
  return useMutation({
    mutationFn: ({
      entityId,
      riskAssessmentId,
    }: {
      entityId: string;
      riskAssessmentId: string;
    }) => explainRisk(entityId, riskAssessmentId),
  });
}

export function useAIReviewDocument() {
  return useMutation({
    mutationFn: (documentId: string) => reviewDocument(documentId),
  });
}
