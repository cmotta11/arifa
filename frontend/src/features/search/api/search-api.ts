import { api } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  type: "entity" | "person" | "client" | "ticket";
  title: string;
  subtitle: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SavedFilter {
  id: string;
  name: string;
  module: string;
  filters: Record<string, string>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export async function globalSearch(query: string): Promise<SearchResponse> {
  return api.get<SearchResponse>("/core/search/", { q: query });
}

// ---------------------------------------------------------------------------
// Saved filters CRUD
// ---------------------------------------------------------------------------

export async function getSavedFilters(module: string): Promise<SavedFilter[]> {
  const response = await api.get<{ results: SavedFilter[] }>(
    "/core/saved-filters/",
    { module },
  );
  // The endpoint returns paginated results; extract the array.
  return response.results ?? (response as unknown as SavedFilter[]);
}

export async function createSavedFilter(
  data: Omit<SavedFilter, "id" | "created_at" | "updated_at">,
): Promise<SavedFilter> {
  return api.post<SavedFilter>("/core/saved-filters/", data);
}

export async function deleteSavedFilter(id: string): Promise<void> {
  return api.delete<void>(`/core/saved-filters/${id}/`);
}
