import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setGuestToken } from "@/lib/api-client";
import { useValidateGuestLink } from "@/features/guest-intake/api/guest-api";
import { GuestLayout } from "@/features/guest-intake/components/guest-layout";
import { MethodSelector } from "../components/method-selector";
import { FormTypeSelector } from "../components/form-type-selector";
import { UploadForm } from "../components/upload-form";
import { NoOperationsForm } from "../components/no-operations-form";
import { PanamaAssetsForm } from "../components/panama-assets-form";
import { BalanceGeneralForm } from "../components/balance-general-form";
import { ExemptForm } from "../components/exempt-form";
import { SignaturePad } from "../components/signature-pad";
import { AccountingDocUploader } from "../components/accounting-doc-uploader";
import { SubmissionSuccess } from "../components/submission-success";
import {
  useGuestAccountingRecord,
  useSaveAccountingDraft,
  useSubmitAccountingRecord,
} from "../api/registros-contables-api";
import { HelpButton } from "@/components/feedback/help-button";

export default function RegistrosContablesGuestPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();

  const {
    data: linkData,
    isLoading: linkLoading,
    isError: linkError,
  } = useValidateGuestLink(token);

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
  const recordId = linkData?.accounting_record;

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

  if (!isValid || !recordId) {
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
            {t("registrosContables.guest.title")}
          </h1>
          {linkData.entity_name && (
            <p className="mt-1 text-sm text-gray-500">{linkData.entity_name}</p>
          )}
        </div>
        <AccountingGuestForm recordId={recordId} guestToken={token} />
      </div>
      <HelpButton module="accounting_records" currentPage="registros-guest" />
    </GuestLayout>
  );
}

// ─── Enhanced Guest Form with Method Selector ───────────────────────────────

type FormStep = "method" | "select" | "upload" | "form";

function AccountingGuestForm({ recordId, guestToken }: { recordId: string; guestToken?: string }) {
  const { t } = useTranslation();
  const { data: record, isLoading, refetch } = useGuestAccountingRecord(recordId);
  const saveDraft = useSaveAccountingDraft();
  const submitRecord = useSubmitAccountingRecord();

  const [step, setStep] = useState<FormStep>("method");
  const [completionMethod, setCompletionMethod] = useState<"upload_information" | "seven_steps" | "">("");
  const [formType, setFormType] = useState("");
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [filePassword, setFilePassword] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerIdentification, setSignerIdentification] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // Sync from server on first load only
  useEffect(() => {
    if (record && !initializedRef.current) {
      initializedRef.current = true;
      if (record.status === "submitted" || record.status === "approved") {
        setSubmitted(true);
      }
      // If form_type already set, skip method & select steps
      if (record.form_type) {
        setFormType(record.form_type);
        setCompletionMethod("seven_steps");
        setStep("form");
      }
      if (record.form_data && Object.keys(record.form_data).length > 0) {
        setFormData(record.form_data);
      }
      if (record.signature_data) setSignatureData(record.signature_data);
      if (record.signer_name) setSignerName(record.signer_name);
      if (record.signer_identification) setSignerIdentification(record.signer_identification);
    }
  }, [record]);

  // Auto-save debounce
  const autoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraftRef.current.mutate({
        id: recordId,
        data: {
          form_type: formType || undefined,
          form_data: formData,
          signature_data: signatureData || undefined,
          signer_name: signerName || undefined,
          signer_identification: signerIdentification || undefined,
        },
      });
    }, 1500);
  }, [recordId, formType, formData, signatureData, signerName, signerIdentification]);

  // Trigger auto-save on changes
  useEffect(() => {
    if (formType || completionMethod === "upload_information") autoSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formType, formData, signatureData, signerName, signerIdentification, autoSave, completionMethod]);

  const handleSelectMethod = (method: "upload_information" | "seven_steps") => {
    setCompletionMethod(method);
    if (method === "upload_information") {
      setStep("upload");
      setFormType("");
    } else {
      setStep("select");
    }
  };

  const handleSelectFormType = (type: string) => {
    setFormType(type);
    setFormData({});
    setStep("form");
  };

  const canSubmit =
    (completionMethod === "upload_information" || formType) &&
    signatureData &&
    signerName.trim() &&
    signerIdentification.trim() &&
    agreed;

  const handleSubmit = async () => {
    setSubmitError("");
    try {
      await saveDraft.mutateAsync({
        id: recordId,
        data: {
          form_type: formType || undefined,
          form_data: formData,
          signature_data: signatureData,
          signer_name: signerName,
          signer_identification: signerIdentification,
        },
      });
      await submitRecord.mutateAsync(recordId);
      await refetch();
      setSubmitted(true);
    } catch {
      setSubmitError(t("registrosContables.guest.submitError"));
    }
  };

  const handleSaveForLater = () => {
    saveDraft.mutate({
      id: recordId,
      data: {
        form_type: formType || undefined,
        form_data: formData,
        signature_data: signatureData || undefined,
        signer_name: signerName || undefined,
        signer_identification: signerIdentification || undefined,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (submitted && record) {
    return (
      <SubmissionSuccess
        entityName={record.entity_name}
        submittedAt={record.submitted_at || new Date().toISOString()}
        recordId={recordId}
        guestToken={guestToken}
      />
    );
  }

  // Rejection notice
  const isRejected = record?.status === "rejected";
  const rejectionBanner = isRejected && record?.review_notes ? (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-800">
        {t("registrosContables.guest.rejectionNotice")}
      </p>
      <p className="mt-1 text-sm text-red-700">{record.review_notes}</p>
    </div>
  ) : null;

  // Step: Method Selection
  if (step === "method") {
    return (
      <>
        {rejectionBanner}
        <Card>
          <MethodSelector selected={completionMethod} onSelect={handleSelectMethod} />
        </Card>
      </>
    );
  }

  // Step: Form Type Selection (seven_steps path)
  if (step === "select") {
    return (
      <>
        {rejectionBanner}
        <button
          type="button"
          onClick={() => setStep("method")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back")}
        </button>
        <Card>
          <FormTypeSelector selected={formType} onSelect={handleSelectFormType} />
        </Card>
      </>
    );
  }

  // Step: Upload path
  if (step === "upload") {
    return (
      <div className="space-y-6">
        {rejectionBanner}
        <button
          type="button"
          onClick={() => setStep("method")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back")}
        </button>

        {/* Auto-save indicator */}
        {saveDraft.isPending && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Spinner size="sm" />
            {t("registrosContables.guest.saving")}
          </div>
        )}

        <Card>
          <UploadForm
            recordId={recordId}
            filePassword={filePassword}
            onPasswordChange={setFilePassword}
          />
        </Card>

        {/* Signer info */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("registrosContables.guest.signerInfo")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="signer-name"
                label={`${t("registrosContables.guest.signerName")} *`}
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
              <Input
                id="signer-id"
                label={`${t("registrosContables.guest.signerIdentification")} *`}
                type="text"
                value={signerIdentification}
                onChange={(e) => setSignerIdentification(e.target.value)}
                placeholder={t("registrosContables.guest.signerIdentificationPlaceholder")}
              />
            </div>
          </div>
        </Card>

        {/* Signature */}
        <Card>
          <SignaturePad value={signatureData} onChange={setSignatureData} />
        </Card>

        {/* Declaration + Submit + Save for later */}
        <Card>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                {t("registrosContables.guest.declaration")}
              </span>
            </label>

            {submitError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleSaveForLater}
                loading={saveDraft.isPending}
              >
                {t("registrosContables.guest.saveForLater")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                loading={submitRecord.isPending || saveDraft.isPending}
                className="flex-1"
              >
                {t("registrosContables.guest.submit")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Step: Seven Steps form
  return (
    <div className="space-y-6">
      {rejectionBanner}

      {/* Back to form type */}
      <button
        type="button"
        onClick={() => setStep("select")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("registrosContables.guest.changeFormType")}
      </button>

      {/* Auto-save indicator */}
      {saveDraft.isPending && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Spinner size="sm" />
          {t("registrosContables.guest.saving")}
        </div>
      )}

      {/* Form-specific content */}
      <Card>
        {formType === "no_operations" && <NoOperationsForm />}
        {formType === "panama_assets" && (
          <PanamaAssetsForm
            formData={formData}
            onChange={setFormData}
            entityName={record?.entity_name}
          />
        )}
        {formType === "balance_general" && (
          <BalanceGeneralForm formData={formData} onChange={setFormData} />
        )}
        {formType === "exempt_license" && (
          <ExemptForm formData={formData} onChange={setFormData} />
        )}
      </Card>

      {/* Document upload */}
      <Card>
        <AccountingDocUploader recordId={recordId} />
      </Card>

      {/* Signer info */}
      <Card>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("registrosContables.guest.signerInfo")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="signer-name-form"
              label={`${t("registrosContables.guest.signerName")} *`}
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
            <Input
              id="signer-id-form"
              label={`${t("registrosContables.guest.signerIdentification")} *`}
              type="text"
              value={signerIdentification}
              onChange={(e) => setSignerIdentification(e.target.value)}
              placeholder={t("registrosContables.guest.signerIdentificationPlaceholder")}
            />
          </div>
        </div>
      </Card>

      {/* Signature */}
      <Card>
        <SignaturePad value={signatureData} onChange={setSignatureData} />
      </Card>

      {/* Declaration + Submit + Save for later */}
      <Card>
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">
              {t("registrosContables.guest.declaration")}
            </span>
          </label>

          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleSaveForLater}
              loading={saveDraft.isPending}
            >
              {t("registrosContables.guest.saveForLater")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={submitRecord.isPending || saveDraft.isPending}
              className="flex-1"
            >
              {t("registrosContables.guest.submit")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
