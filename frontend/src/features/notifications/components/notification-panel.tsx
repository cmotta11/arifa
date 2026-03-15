import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import { BellIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "../api/notifications-api";
import { NotificationItemRow } from "./notification-item";

export function NotificationBell() {
  const { t } = useTranslation();
  const { data: unreadData } = useUnreadCount();
  const [panelOpened, setPanelOpened] = useState(false);
  const { data: notificationsData, isLoading } = useNotifications(
    { page_size: "15" },
    panelOpened,
  );
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notificationsData?.results ?? [];

  return (
    <Popover className="relative">
      <PopoverButton
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
        aria-label={t("notifications.title")}
        onClick={() => setPanelOpened(true)}
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute right-0 z-50 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-lg">
          {({ close }) => (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("notifications.title")}
                </h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead.mutate()}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    {t("notifications.markAllRead")}
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="md" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    {t("notifications.empty")}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <NotificationItemRow
                        key={notification.id}
                        notification={notification}
                        onMarkRead={(id) => markAsRead.mutate(id)}
                        onClose={close}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
