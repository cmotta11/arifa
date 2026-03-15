import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  usePortalNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../api/portal-api";
import type { PortalNotification } from "../api/portal-api";

const categoryColor: Record<PortalNotification["category"], "blue" | "green" | "yellow" | "red" | "gray"> = {
  ticket: "blue",
  kyc: "green",
  compliance: "yellow",
  document: "blue",
  system: "gray",
  reminder: "yellow",
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export default function PortalNotificationsPage() {
  const { t } = useTranslation();
  const notificationsQuery = usePortalNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = notificationsQuery.data?.results ?? [];
  const hasUnread = notifications.some((n) => !n.is_read);

  const handleMarkRead = (notification: PortalNotification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("portal.notifications.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("portal.notifications.description")}
          </p>
        </div>
        {hasUnread && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
          >
            {t("portal.notifications.markAllRead")}
          </Button>
        )}
      </div>

      <div className="mt-6">
        {notificationsQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {notificationsQuery.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("common.error")}
          </div>
        )}

        {notificationsQuery.data && notifications.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
            <p className="text-sm font-medium text-gray-500">
              {t("portal.notifications.empty")}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t("portal.notifications.emptyDescription")}
            </p>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  !notification.is_read
                    ? "border-l-4 border-l-primary bg-primary/5"
                    : ""
                }`}
                onClick={() => handleMarkRead(notification)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm ${
                          !notification.is_read
                            ? "font-semibold text-gray-900"
                            : "font-medium text-gray-700"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <Badge color={categoryColor[notification.category]}>
                        {t(`portal.notifications.categories.${notification.category}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {notification.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {timeAgo(notification.created_at)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
