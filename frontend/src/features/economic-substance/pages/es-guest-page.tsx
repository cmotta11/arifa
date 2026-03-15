import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { setGuestToken } from "@/lib/api-client";
import { useValidateGuestLink } from "@/features/guest-intake/api/guest-api";
import { GuestLayout } from "@/features/guest-intake/components/guest-layout";
import { ESFlowForm } from "../components/es-flow-form";
import { ESAttentionScreen } from "../components/es-attention-screen";
import {
  useGuestESDetail,
  useSaveGuestESDraft,
  useSubmitGuestES,
  type EconomicSubstanceSubmission,
} from "../api/es-api";
import { HelpButton } from "@/components/feedback/help-button";

export default function ESGuestPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();

  const {
    data: linkData,
    isLoading: linkLoading,
    isError: linkError,
  } = useValidateGuestLink(token);

  // Set guest token in api-client
  useEffect(() => {
    if (token) setGuestToken(token);
    return () => setGuestToken(null);
  }, [token]);

  const isExpired = (() => {
    if (!linkData) return false;
    if (!linkData.is_active) return true;
    return new Date(linkData.expires_at) < new Date();
  })();

  const isValid = linkData?.is_active && !isExpired;

  // The guest link should carry an es_submission ID. We look for it in the
  // link data. The backend may store it in a generic field or a dedicated one.
  // We'll check both a potential es_submission field and fallback to a query param.
  const submissionId = (linkData as Record<string, unknown> | undefined)
    ?.es_submission as string | undefined;

  // ─── Loading state ──────────────────────────────────────────────────────

  if (linkLoading) {
    return (
      <GuestLayout>
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">{t("guest.validating")}</p>
        </div>
      </GuestLayout>
    );
  }

  // ─── Invalid token ──────────────────────────────────────────────────────

  if (!token || linkError || !linkData) {
    return (
      <GuestLayout>
        <Card className="mx-auto max-w-md text-center">
          <div className="py-8">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("guest.linkInvalid")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("guest.linkInvalidDescription")}
            </p>
          </div>
        </Card>
      </GuestLayout>
    );
  }

  // ─── Expired token ──────────────────────────────────────────────────────

  if (isExpired) {
    return (
      <GuestLayout>
        <Card className="mx-auto max-w-md text-center">
          <div className="py-8">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("guest.linkExpired")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("guest.linkExpiredDescription")}
            </p>
          </div>
        </Card>
      </GuestLayout>
    );
  }

  if (!isValid || !submissionId) {
    return (
      <GuestLayout>
        <Card className="mx-auto max-w-md text-center">
          <div className="py-8">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("guest.linkInvalid")}
            </h2>
          </div>
        </Card>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            {t("es.guest.title")}
          </h1>
          {linkData.entity_name && (
            <p className="mt-1 text-sm text-gray-500">
              {linkData.entity_name}
            </p>
          )}
        </div>
        <ESGuestForm submissionId={submissionId} />
      </div>
      <HelpButton module="economic_substance" currentPage="es-guest" />
    </GuestLayout>
  );
}

// ─── Guest Form ─────────────────────────────────────────────────────────────

function ESGuestForm({ submissionId }: { submissionId: string }) {
  const { t } = useTranslation();
  const {
    data: submission,
    isLoading,
    refetch,
  } = useGuestESDetail(submissionId);
  const saveDraft = useSaveGuestESDraft();
  const submitES = useSubmitGuestES();

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const initializedRef = useRef(false);

  // Detect if already submitted
  useEffect(() => {
    if (submission && !initializedRef.current) {
      initializedRef.current = true;
      if (
        submission.status === "in_review" ||
        submission.status === "completed"
      ) {
        setSubmitted(true);
      }
    }
  }, [submission]);

  const handleAdvanceStep = async (stepKey: string, answer: unknown) => {
    // For guest flow, we save the answer via draft save and let the backend
    // handle step advancement on submit. We use the advance-step endpoint
    // if available, but since guest may not have it, we fall back to saving
    // flow_answers directly.
    const currentAnswers = submission?.flow_answers ?? {};
    await saveDraft.mutateAsync({
      id: submissionId,
      data: {
        flow_answers: { ...currentAnswers, [stepKey]: answer },
      },
    });
  };

  const handleUpdateSubmission = async (
    data: Partial<EconomicSubstanceSubmission>,
  ) => {
    await saveDraft.mutateAsync({ id: submissionId, data });
  };

  const handleSubmit = async () => {
    setSubmitError("");
    try {
      // Final save before submit
      if (submission) {
        await saveDraft.mutateAsync({
          id: submissionId,
          data: {
            flow_answers: submission.flow_answers,
            shareholders_data: submission.shareholders_data,
          },
        });
      }
      await submitES.mutateAsync(submissionId);
      await refetch();
      setSubmitted(true);
    } catch {
      setSubmitError(t("es.guest.submitError"));
    }
  };

  if (isLoading || !submission) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Already submitted
  if (submitted) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <div className="space-y-4 py-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {t("es.guest.submitted")}
          </h2>
          <p className="text-sm text-gray-500">
            {t("es.guest.submittedDescription")}
          </p>
          {submission.submitted_at && (
            <p className="text-xs text-gray-400">
              {t("es.guest.submittedAt")}{" "}
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Attention terminal
  const isAttentionTerminal =
    submission.current_step === "attention" ||
    submission.attention_reason !== "";

  if (isAttentionTerminal) {
    return (
      <ESAttentionScreen
        attentionReason={submission.attention_reason}
        entityName={submission.entity_name}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Field comments from rejection */}
      {Object.keys(submission.field_comments ?? {}).length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            {t("es.guest.rejectionNotice")}
          </p>
        </div>
      )}

      {submitError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <ESFlowForm
        submission={submission}
        onAdvanceStep={handleAdvanceStep}
        onUpdateSubmission={handleUpdateSubmission}
        onSubmit={handleSubmit}
        isSaving={saveDraft.isPending}
        isSubmitting={submitES.isPending}
      />
    </div>
  );
}
