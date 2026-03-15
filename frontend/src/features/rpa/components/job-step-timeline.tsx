import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { RPAJobStep } from "../api/rpa-api";

interface JobStepTimelineProps {
  steps: RPAJobStep[];
}

const statusConfig: Record<
  RPAJobStep["status"],
  { color: "gray" | "blue" | "green" | "red" | "yellow"; label: string }
> = {
  pending: { color: "gray", label: "Pending" },
  running: { color: "blue", label: "Running" },
  completed: { color: "green", label: "Completed" },
  failed: { color: "red", label: "Failed" },
  skipped: { color: "yellow", label: "Skipped" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function JobStepTimeline({ steps }: JobStepTimelineProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const config = statusConfig[step.status];
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.id} className="relative flex gap-4">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                  step.status === "completed"
                    ? "bg-green-500"
                    : step.status === "running"
                      ? "bg-blue-500 animate-pulse"
                      : step.status === "failed"
                        ? "bg-red-500"
                        : "bg-gray-300"
                }`}
              >
                {step.status === "completed" ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.status === "failed" ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 ${
                    step.status === "completed" ? "bg-green-300" : "bg-gray-200"
                  }`}
                  style={{ minHeight: "2rem" }}
                />
              )}
            </div>

            {/* Step content */}
            <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {step.step_name}
                </span>
                <Badge color={config.color}>{config.label}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {step.action}
              </p>
              <div className="mt-1 flex gap-4 text-xs text-gray-400">
                {step.started_at && (
                  <span>{t("rpa.started")}: {formatTime(step.started_at)}</span>
                )}
                {step.completed_at && (
                  <span>{t("rpa.completed")}: {formatTime(step.completed_at)}</span>
                )}
              </div>
              {step.error_message && (
                <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
                  {step.error_message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
