import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { useRPAJob, useRPAJobAction } from "../api/rpa-api";
import { JobStepTimeline } from "../components/job-step-timeline";

const statusColorMap: Record<string, "gray" | "blue" | "yellow" | "green" | "red"> = {
  pending: "gray",
  running: "blue",
  paused: "yellow",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

export default function RPAJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const jobQuery = useRPAJob(id!);
  const actionMutation = useRPAJobAction();

  if (jobQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const job = jobQuery.data;

  const handleAction = (action: "pause" | "resume" | "retry" | "cancel") => {
    actionMutation.mutate({ id: job.id, action });
  };

  const canPause = job.status === "running";
  const canResume = job.status === "paused";
  const canRetry = job.status === "failed" && job.retry_count < job.max_retries;
  const canCancel = ["pending", "running", "paused"].includes(job.status);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate("/admin/rpa-jobs")}
            className="mb-2 text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; {t("rpa.backToJobs")}
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {job.definition_name}
            </h1>
            <Badge color={statusColorMap[job.status] ?? "gray"}>
              {job.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canPause && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction("pause")}
              loading={actionMutation.isPending}
            >
              {t("rpa.pause")}
            </Button>
          )}
          {canResume && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAction("resume")}
              loading={actionMutation.isPending}
            >
              {t("rpa.resume")}
            </Button>
          )}
          {canRetry && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAction("retry")}
              loading={actionMutation.isPending}
            >
              {t("rpa.retry")} ({job.retry_count}/{job.max_retries})
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction("cancel")}
              loading={actionMutation.isPending}
            >
              {t("rpa.cancel")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Step Timeline */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("rpa.steps")}
            </h2>
            <JobStepTimeline steps={job.steps ?? []} />
          </Card>
        </div>

        {/* Right: Metadata */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              {t("rpa.details")}
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">{t("rpa.entity")}</dt>
                <dd className="font-medium">{job.entity_name || "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t("rpa.ticket")}</dt>
                <dd className="font-medium">{job.ticket_title || "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t("rpa.createdBy")}</dt>
                <dd className="font-medium">{job.created_by_email || "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t("rpa.started")}</dt>
                <dd>{job.started_at ? new Date(job.started_at).toLocaleString() : "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t("rpa.completed")}</dt>
                <dd>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{t("rpa.retries")}</dt>
                <dd>{job.retry_count} / {job.max_retries}</dd>
              </div>
            </dl>
          </Card>

          {job.error_message && (
            <Card className="border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-700">
                {t("rpa.errorTitle")}
              </h3>
              <p className="text-sm text-red-600">{job.error_message}</p>
            </Card>
          )}

          {Object.keys(job.input_data).length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                {t("rpa.inputData")}
              </h3>
              <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                {JSON.stringify(job.input_data, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
