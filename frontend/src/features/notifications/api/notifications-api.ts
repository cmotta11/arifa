import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PaginatedResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: "in_app" | "email" | "both";
  priority: "low" | "normal" | "high" | "urgent";
  category: string;
  is_read: boolean;
  read_at: string | null;
  action_url: string;
  ticket: string | null;
  entity: string | null;
  template_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  category_channels: Record<string, string>;
  daily_digest_enabled: boolean;
  digest_hour: number;
}

export interface NotificationTemplate {
  id: string;
  key: string;
  display_name: string;
  subject_template: string;
  body_template: string;
  in_app_template: string;
  category: string;
  default_channel: "in_app" | "email" | "both";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function getNotifications(params?: Record<string, string>): Promise<PaginatedResponse<NotificationItem>> {
  return api.get<PaginatedResponse<NotificationItem>>("/notifications/", params);
}

async function getUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>("/notifications/unread-count/");
}

async function markAsRead(id: string): Promise<NotificationItem> {
  return api.post<NotificationItem>(`/notifications/${id}/read/`);
}

async function markAllAsRead(): Promise<{ marked: number }> {
  return api.post<{ marked: number }>("/notifications/mark-all-read/");
}

async function getPreferences(): Promise<NotificationPreferences> {
  return api.get<NotificationPreferences>("/notifications/preferences/");
}

async function updatePreferences(data: Partial<Omit<NotificationPreferences, "id">>): Promise<NotificationPreferences> {
  return api.patch<NotificationPreferences>("/notifications/preferences/", data);
}

async function getTemplates(params?: Record<string, string>): Promise<PaginatedResponse<NotificationTemplate>> {
  return api.get<PaginatedResponse<NotificationTemplate>>("/notifications/templates/", params);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useNotifications(params?: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => getNotifications(params),
    enabled,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: getPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useNotificationTemplates(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["notifications", "templates", params],
    queryFn: () => getTemplates(params),
  });
}
