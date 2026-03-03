import { useTranslation } from "react-i18next";
import type { TicketLog } from "@/types";

interface TicketTimelineProps {
  logs: TicketLog[];
}

type ActionType = "created" | "transitioned" | "comment";

function getActionType(log: TicketLog): ActionType {
  if (!log.previous_state) return "created";
  if (log.comment && log.previous_state.id === log.new_state.id) return "comment";
  return "transitioned";
}

const actionColors: Record<ActionType, string> = {
  created: "bg-green-500",
  transitioned: "bg-arifa-navy",
  comment: "bg-gray-400",
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketTimeline({ logs }: TicketTimelineProps) {
  const { t } = useTranslation();

  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        {t("dashboard.noActivity")}
      </p>
    );
  }

  // Show logs in reverse chronological order (newest first)
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="flow-root">
      <ul className="-mb-4">
        {sortedLogs.map((log, index) => {
          const isLast = index === sortedLogs.length - 1;
          const actionType = getActionType(log);
          const userName = log.changed_by
            ? `${log.changed_by.first_name} ${log.changed_by.last_name}`
            : "System";

          return (
            <li key={log.id} className="relative pb-6">
              {/* Connector line */}
              {!isLast && (
                <span
                  className="absolute left-3.5 top-8 -ml-px h-full w-0.5 bg-surface-border"
                  aria-hidden="true"
                />
              )}

              <div className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                  <span
                    className={`h-3 w-3 rounded-full ring-4 ring-white ${actionColors[actionType]}`}
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">{userName}</span>

                      {actionType === "created" && (
                        <span className="text-gray-500">
                          {" "}created this ticket in{" "}
                          <span className="font-medium text-gray-700">
                            {log.new_state.name}
                          </span>
                        </span>
                      )}

                      {actionType === "transitioned" && (
                        <span className="text-gray-500">
                          {" "}
                          {t("tickets.stateChanged")}{" "}
                          <span className="font-medium text-gray-700">
                            {log.previous_state?.name}
                          </span>{" "}
                          {t("tickets.to")}{" "}
                          <span className="font-medium text-gray-700">
                            {log.new_state.name}
                          </span>
                        </span>
                      )}

                      {actionType === "comment" && (
                        <span className="text-gray-500">
                          {" "}added a comment
                        </span>
                      )}
                    </p>

                    <time className="text-xs text-gray-400">
                      {formatTimestamp(log.timestamp)}
                    </time>
                  </div>

                  {log.comment && (
                    <div className="mt-2 rounded-md border border-surface-border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      {log.comment}
                    </div>
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
