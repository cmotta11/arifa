import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/overlay/modal";
import { ROUTES } from "@/config/routes";
import { ESFlowForm } from "../components/es-flow-form";
import { ESAttentionScreen } from "../components/es-attention-screen";
import { getESFlowSteps } from "../components/es-flow-form";
import type { FlowStepConfig } from "../components/es-question-renderer";
import {
  useESDetail,
  useUpdateES,
  useAdvanceESStep,
  useSubmitES,
  useApproveES,
  useRejectES,
  type EconomicSubstanceSubmission,
} from "../api/es-api";
import { HelpButton } from "@/components/feedback/help-button";

const STATUS_COLORS: Record<string, "gray" | "yellow" | "blue" | "green"> = {
  pending: "gray",
  in_progress: "yellow",
  in_review: "blue",
  completed: "green",
};

export default function ESDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const ES_FLOW_STEPS = getESFlowSteps(t);
  const navigate = useNavigate();

  const { data: submission, isLoading } = useESDetail(id);
  const updateMut = useUpdateES();
  const advanceMut = useAdvanceESStep();
  const submitMut = useSubmitES();
  const approveMut = useApproveES();
  const rejectMut = useRejectES();

  const [showReviewModal, setShowReviewModal] = useState<"approve" | "reject" | null>(null);
  const [rejectComments, setRejectComments] = useState("");
  const [reviewError, setReviewError] = useState("");

  if (isLoading || !submission) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const isFormMode =
    submission.status === "pending" || submission.status === "in_progress";
  const isReviewMode =
    submission.status === "in_review" || submission.status === "completed";
  const isAttentionTerminal =
    submission.current_step === "attention" ||
    submission.attention_reason !== "";

  const handleAdvanceStep = async (stepKey: string, answer: unknown) => {
    await advanceMut.mutateAsync({
      id: id!,
      step_key: stepKey,
      answer,
    });
  };

  const handleUpdateSubmission = async (
    data: Partial<EconomicSubstanceSubmission>,
  ) => {
    await updateMut.mutateAsync({ id: id!, data });
  };

  const handleSubmit = async () => {
    await submitMut.mutateAsync(id!);
  };

  const handleReview = async () => {
    if (!showReviewModal) return;
    setReviewError("");
    try {
      if (showReviewModal === "approve") {
        await approveMut.mutateAsync(id!);
      } else {
        await rejectMut.mutateAsync({
          id: id!,
          field_comments: rejectComments ? { general: rejectComments } : undefined,
        });
      }
      setShowReviewModal(null);
      setRejectComments("");
    } catch {
      setReviewError(t("common.error"));
    }
  };

  // Summary data for review mode
  const answers = submission.flow_answers ?? {};
  const reviewSteps = ES_FLOW_STEPS.filter((s) => s.type !== "terminal");

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.ECONOMIC_SUBSTANCE)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("common.back")}
      </button>

      {/* Header with sidebar info */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Main content */}
        <div className="flex-1 space-y-6">
          {/* Title */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {submission.entity_name}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t("es.detail.fiscalYear")} {submission.fiscal_year}
              </p>
            </div>
            <Badge color={STATUS_COLORS[submission.status] ?? "gray"}>
              {t(`es.status.${submission.status}`)}
            </Badge>
          </div>

          {/* Attention terminal */}
          {isAttentionTerminal && (
            <ESAttentionScreen
              attentionReason={submission.attention_reason}
              entityName={submission.entity_name}
            />
          )}

          {/* Form mode */}
          {isFormMode && !isAttentionTerminal && (
            <ESFlowForm
              submission={submission}
              onAdvanceStep={handleAdvanceStep}
              onUpdateSubmission={handleUpdateSubmission}
              onSubmit={handleSubmit}
              isSaving={updateMut.isPending}
              isSubmitting={submitMut.isPending}
            />
          )}

          {/* Review mode — summary of all answers */}
          {isReviewMode && !isAttentionTerminal && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("es.detail.summary")}
              </h2>
              {reviewSteps.map((step) => {
                const val = answers[step.key];
                const comment = submission.field_comments?.[step.key];

                return (
                  <Card key={step.key}>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">
                        {step.label}
                      </h4>
                      {comment && (
                        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                          <span className="font-medium">
                            {t("es.review.comment")}:
                          </span>{" "}
                          {String(comment)}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        {renderAnswerDisplay(step, val, submission, t)}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Approve / Reject buttons — only for in_review status */}
              {submission.status === "in_review" && (
                <div className="flex gap-3">
                  <Button onClick={() => setShowReviewModal("approve")}>
                    {t("es.detail.approve")}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setShowReviewModal("reject")}
                  >
                    {t("es.detail.reject")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar — entity info */}
        <div className="w-full space-y-4 lg:w-72">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              {t("es.detail.entityInfo")}
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-medium text-gray-500">
                  {t("es.detail.entity")}
                </dt>
                <dd className="mt-0.5 text-gray-900">
                  {submission.entity_name}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">
                  {t("es.detail.fiscalYear")}
                </dt>
                <dd className="mt-0.5 text-gray-900">
                  {submission.fiscal_year}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">
                  {t("es.detail.status")}
                </dt>
                <dd className="mt-0.5">
                  <Badge color={STATUS_COLORS[submission.status] ?? "gray"}>
                    {t(`es.status.${submission.status}`)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">
                  {t("es.detail.currentStep")}
                </dt>
                <dd className="mt-0.5 text-gray-900">
                  {submission.current_step || "--"}
                </dd>
              </div>
              {submission.submitted_at && (
                <div>
                  <dt className="font-medium text-gray-500">
                    {t("es.detail.submittedAt")}
                  </dt>
                  <dd className="mt-0.5 text-gray-900">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {submission.reviewed_at && (
                <div>
                  <dt className="font-medium text-gray-500">
                    {t("es.detail.reviewedAt")}
                  </dt>
                  <dd className="mt-0.5 text-gray-900">
                    {new Date(submission.reviewed_at).toLocaleString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-gray-500">
                  {t("es.detail.created")}
                </dt>
                <dd className="mt-0.5 text-gray-900">
                  {new Date(submission.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {/* Review modal (approve / reject) */}
      <Modal
        isOpen={showReviewModal !== null}
        onClose={() => {
          setShowReviewModal(null);
          setRejectComments("");
          setReviewError("");
        }}
        title={
          showReviewModal === "approve"
            ? t("es.detail.approveTitle")
            : t("es.detail.rejectTitle")
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {showReviewModal === "approve"
              ? t("es.detail.approveDescription")
              : t("es.detail.rejectDescription")}
          </p>

          {showReviewModal === "reject" && (
            <Textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              rows={3}
              placeholder={t("es.detail.rejectCommentsPlaceholder")}
            />
          )}

          {reviewError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {reviewError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowReviewModal(null);
                setRejectComments("");
                setReviewError("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={
                showReviewModal === "approve" ? "primary" : "danger"
              }
              onClick={handleReview}
              loading={approveMut.isPending || rejectMut.isPending}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
      <HelpButton module="economic_substance" entityId={submission?.entity} currentPage="es-detail" />
    </div>
  );
}

// ─── Helper: render answer for review display ───────────────────────────────

function renderAnswerDisplay(
  step: FlowStepConfig,
  val: unknown,
  submission: EconomicSubstanceSubmission,
  t: (key: string, fallback?: string) => string,
) {
  if (step.type === "yes_no") {
    if (val === true) return <Badge color="green">{t("es.flow.yes")}</Badge>;
    if (val === false) return <Badge color="red">{t("es.flow.no")}</Badge>;
    return "--";
  }

  if (step.type === "multi_select") {
    const selected = (val as string[]) ?? [];
    if (selected.length === 0) return "--";
    return (
      <div className="flex flex-wrap gap-1">
        {selected.map((v) => {
          const opt = step.options?.find((o) => o.value === v);
          return (
            <Badge key={v} color="blue">
              {opt?.label ?? v}
            </Badge>
          );
        })}
      </div>
    );
  }

  if (step.type === "country_select") {
    return val ? <Badge color="blue">{String(val)}</Badge> : "--";
  }

  if (step.type === "shareholders_list") {
    const shareholders = submission.shareholders_data ?? [];
    if (shareholders.length === 0) return "--";
    /* ACCEPTED EXCEPTION: small summary table — DataTable is overkill for a compact 3-column review display */
    return (
      <div className="mt-1 overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("es.shareholders.name")}
              </th>
              <th className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("es.shareholders.type")}
              </th>
              <th className="px-3 py-1.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("es.shareholders.percentage")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shareholders.map((sh, idx) => (
              <tr key={idx}>
                <td className="px-3 py-1.5 text-sm text-gray-700">{sh.name}</td>
                <td className="px-3 py-1.5 text-sm text-gray-700">{sh.type}</td>
                <td className="px-3 py-1.5 text-right text-sm text-gray-700">
                  {sh.percentage.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return val != null ? String(val) : "--";
}
