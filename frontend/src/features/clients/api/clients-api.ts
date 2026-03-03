import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Client, ClientContact, Entity, GuestLink, KYCSubmission, Matter, Person, Ticket, PaginatedResponse } from "@/types";

// Query key factory
export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: (filters: Record<string, string>) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  entities: (clientId: string) => [...clientKeys.all, "entities", clientId] as const,
  matters: (clientId: string) => [...clientKeys.all, "matters", clientId] as const,
  tickets: (clientId: string) => [...clientKeys.all, "tickets", clientId] as const,
  persons: (clientId: string) => [...clientKeys.all, "persons", clientId] as const,
  contacts: (clientId: string) => [...clientKeys.all, "contacts", clientId] as const,
  guestLinks: (clientId: string) => [...clientKeys.all, "guestLinks", clientId] as const,
  kycSubmissions: (clientId: string) => [...clientKeys.all, "kycSubmissions", clientId] as const,
};

// Raw API functions
async function fetchClients(filters: Record<string, string> = {}) {
  const params: Record<string, string> = { per_page: "100", ...filters };
  return api.get<PaginatedResponse<Client>>("/core/clients/", params);
}

async function fetchClient(id: string) {
  return api.get<Client>(`/core/clients/${id}/`);
}

async function createClient(data: Partial<Client>) {
  return api.post<Client>("/core/clients/", data);
}

async function updateClient(id: string, data: Partial<Client>) {
  return api.patch<Client>(`/core/clients/${id}/`, data);
}

async function fetchClientEntities(clientId: string) {
  return api.get<PaginatedResponse<Entity>>("/core/entities/", { client_id: clientId, per_page: "100" });
}

async function fetchClientMatters(clientId: string) {
  return api.get<PaginatedResponse<Matter>>("/core/matters/", { client_id: clientId, per_page: "100" });
}

async function fetchClientTickets(clientId: string) {
  return api.get<PaginatedResponse<Ticket>>("/workflow/tickets/", { client_id: clientId, per_page: "100" });
}

async function fetchClientPersons(clientId: string) {
  return api.get<PaginatedResponse<Person>>("/core/persons/", { client_id: clientId, per_page: "100" });
}

// React hooks
export function useClients(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: clientKeys.list(filters),
    queryFn: () => fetchClients(filters),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => fetchClient(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Client>) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) => updateClient(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useClientEntities(clientId: string) {
  return useQuery({
    queryKey: clientKeys.entities(clientId),
    queryFn: () => fetchClientEntities(clientId),
    enabled: !!clientId,
  });
}

export function useClientMatters(clientId: string) {
  return useQuery({
    queryKey: clientKeys.matters(clientId),
    queryFn: () => fetchClientMatters(clientId),
    enabled: !!clientId,
  });
}

export function useClientTickets(clientId: string) {
  return useQuery({
    queryKey: clientKeys.tickets(clientId),
    queryFn: () => fetchClientTickets(clientId),
    enabled: !!clientId,
  });
}

export function useClientPersons(clientId: string) {
  return useQuery({
    queryKey: clientKeys.persons(clientId),
    queryFn: () => fetchClientPersons(clientId),
    enabled: !!clientId,
  });
}

export function useClientGuestLinks(clientId: string) {
  return useQuery({
    queryKey: clientKeys.guestLinks(clientId),
    queryFn: () =>
      api.get<PaginatedResponse<GuestLink>>("/auth/guest-links/", {
        client_id: clientId,
        per_page: "100",
      }),
    enabled: !!clientId,
  });
}

export function useClientKYCSubmissions(clientId: string) {
  return useQuery({
    queryKey: clientKeys.kycSubmissions(clientId),
    queryFn: () =>
      api.get<PaginatedResponse<KYCSubmission>>("/compliance/kyc/", {
        client_id: clientId,
        per_page: "100",
      }),
    enabled: !!clientId,
  });
}

// ---------------------------------------------------------------------------
// ClientContact hooks
// ---------------------------------------------------------------------------

export function useClientContacts(clientId: string) {
  return useQuery({
    queryKey: clientKeys.contacts(clientId),
    queryFn: () =>
      api.get<PaginatedResponse<ClientContact>>("/core/client-contacts/", {
        client_id: clientId,
        per_page: "100",
      }),
    enabled: !!clientId,
  });
}

export function useCreateClientContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ClientContact> & { client_id: string }) =>
      api.post<ClientContact>("/core/client-contacts/", data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(variables.client_id) });
    },
  });
}

export function useUpdateClientContact(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientContact> }) =>
      api.patch<ClientContact>(`/core/client-contacts/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(clientId) });
    },
  });
}

export function useDeleteClientContact(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/core/client-contacts/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(clientId) });
    },
  });
}
