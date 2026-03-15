import { useNavigate } from "react-router-dom";
import {
  BellIcon,
  TicketIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  CogIcon,
  ClockIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import type { NotificationItem as NotificationType } from "../api/notifications-api";

const categoryIcons: Record<string, typeof BellIcon> = {
  ticket: TicketIcon,
  kyc: ShieldCheckIcon,
  compliance: ShieldCheckIcon,
  rpa: CpuChipIcon,
  document: DocumentTextIcon,
  system: CogIcon,
  reminder: ClockIcon,
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "bg-blue-500",
  low: "bg-gray-400",
};

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface NotificationItemProps {
  notification: NotificationType;
  onMarkRead: (id: string) => void;
  onClose?: () => void;
}

export function NotificationItemRow({ notification, onMarkRead, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const Icon = categoryIcons[notification.category] || BellIcon;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    if (notification.action_url) {
      // Only allow relative URLs starting with "/" to prevent open-redirect attacks
      if (!notification.action_url.startsWith("/")) {
        console.warn("Blocked navigation to non-relative URL:", notification.action_url);
        return;
      }
      navigate(notification.action_url);
      onClose?.();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
        notification.is_read ? "opacity-60" : ""
      }`}
    >
      <div className="relative mt-0.5 flex-shrink-0">
        <Icon className="h-5 w-5 text-gray-500" />
        {!notification.is_read && (
          <span
            className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
              priorityColors[notification.priority] || priorityColors.normal
            }`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${notification.is_read ? "text-gray-600" : "font-medium text-gray-900"}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">{notification.body}</p>
        <p className="mt-1 text-xs text-gray-400">{timeAgo(notification.created_at)}</p>
      </div>
    </button>
  );
}
