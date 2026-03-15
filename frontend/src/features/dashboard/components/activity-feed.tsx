import { useTranslation } from "react-i18next";
import type { TicketLog } from "@/types";

interface ActivityFeedProps {
  logs: TicketLog[];
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  const { t } = useTranslation();

  if (logs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        {t("dashboard.noActivity")}
      </p>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-4">
        {logs.map((log, index) => {
          const isLast = index === logs.length - 1;

          return (
            <li key={log.id} className="relative pb-4">
              {/* Timeline connector line */}
              {!isLast && (
                <span
                  className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-surface-border"
                  aria-hidden="true"
                />
              )}

              <div className="relative flex items-start gap-3">
                {/* Timeline dot */}
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-white" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">
                        {log.changed_by
                          ? `${log.changed_by.first_name} ${log.changed_by.last_name}`
                          : "System"}
                      </span>
                      {log.previous_state && (
                        <>
                          {" "}
                          {t("tickets.stateChanged")}{" "}
                          <span className="font-medium">
                            {log.previous_state.name}
                          </span>{" "}
                          {t("tickets.to")}{" "}
                        </>
                      )}
                      <span className="font-medium">{log.new_state.name}</span>
                    </p>
                    <time
                      dateTime={log.timestamp}
                      className="flex-shrink-0 text-xs text-gray-400"
                    >
                      {formatTimestamp(log.timestamp)}
                    </time>
                  </div>

                  {log.comment && (
                    <p className="mt-1 text-sm text-gray-500">{log.comment}</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
