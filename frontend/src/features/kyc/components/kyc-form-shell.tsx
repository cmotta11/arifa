import { useState, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { KYCSubmission, Party } from "@/types";
import {
  useKYCDetail,
  useKYCParties,
  useKYCDocuments,
  useKYCRisk,
  useUpdateKYC,
  useSubmitKYC,
  useUploadDocument as useUploadDocumentHook,
} from "../api/kyc-api";
import { PartyList } from "./party-list";
import { ReviewSummary } from "./review-summary";

// ─── Step Definitions ───────────────────────────────────────────────────────

interface Step {
  id: string;
  labelKey: string;
}

const STEPS: Step[] = [
  { id: "entity", labelKey: "steps.entityInfo" },
  { id: "parties", labelKey: "steps.parties" },
  { id: "ubo", labelKey: "steps.uboDeclaration" },
  { id: "documents", labelKey: "steps.documents" },
  { id: "review", labelKey: "steps.review" },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface KYCFormShellProps {
  kycId: string;
  onSubmitSuccess?: () => void;
}

// ─── Step Progress Indicator ────────────────────────────────────────────────

function StepIndicator({
  steps,
  currentIndex,
  onStepClick,
}: {
  steps: Step[];
  currentIndex: number;
  onStepClick: (index: number) => void;
}) {
  const { t } = useTranslation("kyc");

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={step.id}
              className={`relative flex-1 ${
                index < steps.length - 1 ? "pr-4" : ""
              }`}
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className={`
                    relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                    text-sm font-medium transition-colors duration-150
                    ${
                      isCompleted
                        ? "bg-arifa-navy text-white"
                        : isCurrent
                          ? "border-2 border-arifa-navy bg-white text-arifa-navy"
                          : "border-2 border-gray-300 bg-white text-gray-500"
                    }
                  `}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`ml-2 hidden h-0.5 flex-1 sm:block ${
                      isCompleted ? "bg-arifa-navy" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
              <span
                className={`mt-2 hidden text-xs sm:block ${
                  isCurrent
                    ? "font-semibold text-arifa-navy"
                    : isCompleted
                      ? "text-arifa-navy"
                      : "text-gray-500"
                }`}
              >
                {t(step.labelKey)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Entity Info Step ───────────────────────────────────────────────────────

function EntityInfoStep({ kyc }: { kyc: KYCSubmission }) {
  const { t } = useTranslation("kyc");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("steps.entityInfo")}
      </h2>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.kycId")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{kyc.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.ticket")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{kyc.ticket}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.status")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{t(`status.${kyc.status}`)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.createdAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(kyc.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>
      <p className="text-sm text-gray-500">{t("entityInfoHint")}</p>
    </div>
  );
}

// ─── UBO Declaration Step ───────────────────────────────────────────────────

function UBODeclarationStep({
  parties,
  isLoading,
}: {
  parties: Party[];
  isLoading: boolean;
}) {
  const { t } = useTranslation("kyc");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const ubos = parties.filter(
    (p) => p.role === "ubo" || p.role === "shareholder"
  );
  const totalOwnership = ubos.reduce(
    (sum, p) => sum + (p.ownership_percentage ?? 0),
    0
  );
  const ownershipValid = totalOwnership === 100;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("steps.uboDeclaration")}
      </h2>

      {ubos.length === 0 ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">{t("ubo.noUbos")}</p>
        </div>
      ) : (
        <>
          {/* UBO Ownership Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-medium text-gray-700">
              {t("ubo.ownershipSummary")}
            </h3>
            <div className="space-y-3">
              {ubos.map((ubo) => (
                <div key={ubo.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {ubo.name}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      {t(`roles.${ubo.role}`)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {ubo.ownership_percentage ?? 0}%
                  </span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-gray-500">{t("ubo.totalOwnership")}</span>
                <span
                  className={`font-semibold ${
                    ownershipValid ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {totalOwnership}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    ownershipValid
                      ? "bg-green-500"
                      : totalOwnership > 100
                        ? "bg-red-500"
                        : "bg-yellow-500"
                  }`}
                  style={{ width: `${Math.min(totalOwnership, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {!ownershipValid && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                {totalOwnership > 100
                  ? t("ubo.ownershipExceeds")
                  : t("ubo.ownershipIncomplete")}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Documents Step ─────────────────────────────────────────────────────────

function DocumentsStep({ kycId }: { kycId: string }) {
  const { t } = useTranslation("kyc");
  const documentsQuery = useKYCDocuments(kycId);
  const documents = documentsQuery.data ?? [];

  const uploadMutation = useUploadDocumentHook();

  const handleFileDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        uploadMutation.mutate({
          kycId,
          file,
          documentType: "supporting_document",
        });
      }
    },
    [kycId, uploadMutation]
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("steps.documents")}
      </h2>

      {/* Upload Area */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <DocumentUploadArea
          kycId={kycId}
          onUpload={handleFileDrop}
          isUploading={uploadMutation.isPending}
        />
      </div>

      {/* Document List */}
      {documentsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">{t("documents.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {doc.document_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Separated upload area component to avoid lazy-import issues with the
 * FileDropzone. This uses a simple input fallback.
 */
function DocumentUploadArea({
  kycId,
  onUpload,
  isUploading,
}: {
  kycId: string;
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}) {
  const { t } = useTranslation("kyc");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(Array.from(files));
    }
  };

  return (
    <div className="text-center">
      <svg
        className="mx-auto h-10 w-10 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <div className="mt-3">
        <label
          htmlFor={`file-upload-${kycId}`}
          className="cursor-pointer text-sm font-medium text-arifa-navy hover:text-arifa-navy/80"
        >
          {t("documents.uploadLabel")}
          <input
            id={`file-upload-${kycId}`}
            type="file"
            className="sr-only"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleChange}
          />
        </label>
        <span className="ml-1 text-sm text-gray-500">
          {t("documents.dragHint")}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {t("documents.acceptedFormats")}
      </p>
      {isUploading && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <span className="text-sm text-gray-500">
            {t("documents.uploading")}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function KYCFormShell({ kycId, onSubmitSuccess }: KYCFormShellProps) {
  const { t } = useTranslation("kyc");
  const [currentStep, setCurrentStep] = useState(0);

  const kycQuery = useKYCDetail(kycId);
  const partiesQuery = useKYCParties(kycId);
  const riskQuery = useKYCRisk(kycId);
  const documentsQuery = useKYCDocuments(kycId);
  const updateMutation = useUpdateKYC();
  const submitMutation = useSubmitKYC();

  const kyc = kycQuery.data;
  const parties = partiesQuery.data ?? [];
  const documents = documentsQuery.data ?? [];
  const risk = riskQuery.data;

  // Auto-save on step change
  const handleStepChange = useCallback(
    (newStep: number) => {
      if (kyc && kyc.status === "draft") {
        updateMutation.mutate(
          { id: kycId, data: {} },
          { onSettled: () => setCurrentStep(newStep) }
        );
      } else {
        setCurrentStep(newStep);
      }
    },
    [kyc, kycId, updateMutation]
  );

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      handleStepChange(currentStep + 1);
    }
  }, [currentStep, handleStepChange]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      handleStepChange(currentStep - 1);
    }
  }, [currentStep, handleStepChange]);

  const handleSubmit = useCallback(() => {
    submitMutation.mutate(kycId, {
      onSuccess: () => {
        onSubmitSuccess?.();
      },
    });
  }, [kycId, submitMutation, onSubmitSuccess]);

  // Loading state
  if (kycQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (kycQuery.isError || !kyc) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
        {t("errors.loadFailed")}
      </div>
    );
  }

  // Render the active step content
  function renderStepContent(): ReactNode {
    switch (STEPS[currentStep]?.id) {
      case "entity":
        return <EntityInfoStep kyc={kyc!} />;
      case "parties":
        return (
          <PartyList
            kycId={kycId}
            parties={parties}
            isLoading={partiesQuery.isLoading}
            readonly={kyc!.status !== "draft"}
          />
        );
      case "ubo":
        return (
          <UBODeclarationStep
            parties={parties}
            isLoading={partiesQuery.isLoading}
          />
        );
      case "documents":
        return <DocumentsStep kycId={kycId} />;
      case "review":
        return (
          <ReviewSummary
            kyc={kyc!}
            parties={parties}
            documents={documents}
            risk={risk ?? null}
            onSubmit={handleSubmit}
            isSubmitting={submitMutation.isPending}
          />
        );
      default:
        return null;
    }
  }

  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator
        steps={STEPS}
        currentIndex={currentStep}
        onStepClick={handleStepChange}
      />

      {/* Step content */}
      <div className="min-h-[400px]">{renderStepContent()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <Button
          variant="ghost"
          onClick={handlePrevious}
          disabled={isFirstStep}
        >
          {t("navigation.previous")}
        </Button>

        <div className="flex items-center gap-3">
          {updateMutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Spinner size="sm" />
              {t("navigation.saving")}
            </span>
          )}

          {!isLastStep && (
            <Button variant="primary" onClick={handleNext}>
              {t("navigation.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
