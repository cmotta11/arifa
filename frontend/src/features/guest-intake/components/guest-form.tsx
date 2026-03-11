import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { FormField } from "@/components/forms/form-field";
import { FileDropzone } from "@/components/forms/file-dropzone";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  useGuestEntitySnapshot,
  useGuestProposeChanges,
  useGuestUploadDocument,
  useGuestDocuments,
  useGuestSubmitKYC,
  useGuestCreatePerson,
  type SnapshotOfficer,
  type SnapshotShareClass,
  type SnapshotShareIssuance,
  type SnapshotActivity,
  type SnapshotSourceOfFunds,
  type SnapshotPerson,
  type CatalogItem,
  type SnapshotCountry,
} from "@/features/guest-intake/api/guest-api";
import { PersonDocumentScan, type PersonFormData } from "@/features/people/components/person-document-scan";
import type { DocumentUpload } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuestFormProps {
  kycId: string;
  className?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface GeneralData {
  name: string;
  jurisdiction: string;
  incorporation_date: string;
  status: string;
}

const STEPS: { step: Step; labelKey: string }[] = [
  { step: 1, labelKey: "guest.steps.general" },
  { step: 2, labelKey: "guest.steps.officers" },
  { step: 3, labelKey: "guest.steps.shares" },
  { step: 4, labelKey: "guest.steps.riskProfile" },
  { step: 5, labelKey: "guest.steps.documentsReview" },
];

const POSITION_OPTIONS = [
  { value: "director", label: "Director" },
  { value: "president", label: "President" },
  { value: "secretary", label: "Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "registered_agent", label: "Registered Agent" },
  { value: "protector", label: "Protector" },
  { value: "authorized_signatory", label: "Authorized Signatory" },
  { value: "other", label: "Other" },
];

const DOC_TYPE_OPTIONS: Array<{
  value: DocumentUpload["document_type"];
  labelKey: string;
}> = [
  { value: "passport", labelKey: "documents.types.passport" },
  { value: "cedula", labelKey: "documents.types.cedula" },
  { value: "corporate_registry", labelKey: "documents.types.corporateRegistry" },
  { value: "proof_of_address", labelKey: "documents.types.proofOfAddress" },
  { value: "source_of_wealth", labelKey: "documents.types.sourceOfWealth" },
  { value: "other", labelKey: "documents.types.other" },
];

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CHF", label: "CHF" },
  { value: "JPY", label: "JPY" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function GuestForm({ kycId, className = "" }: GuestFormProps) {
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Entity data state
  const [general, setGeneral] = useState<GeneralData>({
    name: "",
    jurisdiction: "",
    incorporation_date: "",
    status: "",
  });
  const [nominalDirectors, setNominalDirectors] = useState(false);
  const [officers, setOfficers] = useState<SnapshotOfficer[]>([]);
  const [shareClasses, setShareClasses] = useState<SnapshotShareClass[]>([]);
  const [activities, setActivities] = useState<SnapshotActivity[]>([]);
  const [sourcesOfFunds, setSourcesOfFunds] = useState<SnapshotSourceOfFunds[]>([]);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentUpload["document_type"]>("passport");

  // Queries & mutations
  const { data: snapshot, isLoading: snapshotLoading, isError: snapshotError, refetch: refetchSnapshot } = useGuestEntitySnapshot(kycId);
  const proposeChangesMutation = useGuestProposeChanges(kycId);
  const uploadDocMutation = useGuestUploadDocument(kycId);
  const submitMutation = useGuestSubmitKYC();
  const createPersonMutation = useGuestCreatePerson(kycId);
  const { data: documents = [], isLoading: documentsLoading } = useGuestDocuments(kycId);

  // Local persons list (snapshot persons + newly created)
  const [localPersons, setLocalPersons] = useState<SnapshotPerson[]>([]);

  // Populate form from snapshot (or proposed data if sent back)
  useEffect(() => {
    if (!snapshot) return;

    // Always update persons list from snapshot
    setLocalPersons(snapshot.persons);

    const isSentBack = snapshot.kyc_status === "sent_back";
    const proposed = isSentBack && Object.keys(snapshot.proposed_entity_data).length > 0
      ? snapshot.proposed_entity_data
      : null;

    if (proposed) {
      const pg = (proposed as Record<string, unknown>).general as (GeneralData & { nominal_directors_requested?: boolean }) | undefined;
      if (pg) {
        setGeneral({ ...snapshot.general, ...pg, incorporation_date: pg.incorporation_date ?? "" });
        if (pg.nominal_directors_requested !== undefined) setNominalDirectors(pg.nominal_directors_requested);
      } else {
        setNominalDirectors(snapshot.general.nominal_directors_requested ?? false);
      }
      const po = (proposed as Record<string, unknown>).officers as SnapshotOfficer[] | undefined;
      if (po) setOfficers(po);
      else setOfficers(snapshot.officers);
      const psc = (proposed as Record<string, unknown>).share_classes as SnapshotShareClass[] | undefined;
      if (psc) setShareClasses(psc);
      else setShareClasses(snapshot.share_classes);
      const pa = (proposed as Record<string, unknown>).activities as SnapshotActivity[] | undefined;
      if (pa) setActivities(pa);
      else setActivities(snapshot.activities);
      const psof = (proposed as Record<string, unknown>).sources_of_funds as SnapshotSourceOfFunds[] | undefined;
      if (psof) setSourcesOfFunds(psof);
      else setSourcesOfFunds(snapshot.sources_of_funds);
    } else {
      setGeneral({
        name: snapshot.general.name,
        jurisdiction: snapshot.general.jurisdiction,
        incorporation_date: snapshot.general.incorporation_date ?? "",
        status: snapshot.general.status,
      });
      setNominalDirectors(snapshot.general.nominal_directors_requested ?? false);
      setOfficers(snapshot.officers);
      setShareClasses(snapshot.share_classes);
      setActivities(snapshot.activities);
      setSourcesOfFunds(snapshot.sources_of_funds);
    }
  }, [snapshot]);

  // Auto-save proposed changes
  const proposedData = useMemo(
    () => ({
      general: {
        name: general.name,
        incorporation_date: general.incorporation_date || null,
        nominal_directors_requested: nominalDirectors,
      },
      officers,
      share_classes: shareClasses,
      activities,
      sources_of_funds: sourcesOfFunds,
    }),
    [general, nominalDirectors, officers, shareClasses, activities, sourcesOfFunds],
  );

  const { isSaving, lastSavedAt } = useAutoSave({
    data: proposedData,
    onSave: (data) => proposeChangesMutation.mutate(data),
    delay: 2000,
    enabled: !!kycId && !isSubmitted,
  });

  // Handlers
  const handleUploadDocument = async () => {
    if (!selectedFile) return;
    try {
      await uploadDocMutation.mutateAsync({ file: selectedFile, documentType: docType });
      setSelectedFile(null);
    } catch {
      // Error handled via mutation state
    }
  };

  const handleSubmit = async () => {
    // Save proposed changes one final time
    await proposeChangesMutation.mutateAsync(proposedData);
    try {
      await submitMutation.mutateAsync(kycId);
      setIsSubmitted(true);
    } catch {
      // Error handled via mutation state
    }
  };

  const goToStep = (step: Step) => setCurrentStep(step);

  // Person creation handler
  const handleCreatePerson = async (data: Record<string, unknown>): Promise<SnapshotPerson | null> => {
    try {
      const created = await createPersonMutation.mutateAsync(data);
      // Add to local persons list immediately
      const newPerson: SnapshotPerson = {
        id: created.id,
        full_name: created.full_name,
        person_type: created.person_type,
      };
      setLocalPersons((prev) => [...prev, newPerson]);
      return newPerson;
    } catch {
      return null;
    }
  };

  // Loading state
  if (snapshotLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (snapshotError) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <div className="py-8">
          <svg className="mx-auto mb-4 h-16 w-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">{t("guest.error.title")}</h2>
          <p className="mb-4 text-sm text-gray-500">{t("guest.error.loadFailed")}</p>
          <Button variant="secondary" onClick={() => refetchSnapshot()}>
            {t("common.retry")}
          </Button>
        </div>
      </Card>
    );
  }

  // Submitted state
  if (isSubmitted) {
    return (
      <Card className={`mx-auto max-w-2xl text-center ${className}`}>
        <div className="py-8">
          <svg className="mx-auto mb-4 h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">{t("guest.submitted.title")}</h2>
          <p className="text-sm text-gray-500">{t("guest.submitted.description")}</p>
        </div>
      </Card>
    );
  }

  const fieldComments = snapshot?.field_comments ?? {};
  const isSentBack = snapshot?.kyc_status === "sent_back";

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sent-back banner */}
      {isSentBack && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {t("guest.sentBack")}
        </div>
      )}

      {/* Progress indicator */}
      <ProgressBar currentStep={currentStep} onStepClick={goToStep} />

      {/* Auto-save indicator */}
      <AutoSaveIndicator isSaving={isSaving} lastSavedAt={lastSavedAt} />

      {/* Step content */}
      {currentStep === 1 && (
        <StepGeneral
          general={general}
          onChange={(field, value) => setGeneral((prev) => ({ ...prev, [field]: value }))}
          fieldComments={fieldComments}
        />
      )}

      {currentStep === 2 && (
        <StepOfficers
          officers={officers}
          onChange={setOfficers}
          persons={localPersons}
          countries={snapshot?.countries ?? []}
          fieldComments={fieldComments}
          onCreatePerson={handleCreatePerson}
          isCreatingPerson={createPersonMutation.isPending}
          nominalDirectors={nominalDirectors}
          onNominalDirectorsChange={setNominalDirectors}
        />
      )}

      {currentStep === 3 && (
        <StepShares
          shareClasses={shareClasses}
          onChange={setShareClasses}
          persons={localPersons}
          fieldComments={fieldComments}
        />
      )}

      {currentStep === 4 && (
        <StepRiskProfile
          activities={activities}
          sourcesOfFunds={sourcesOfFunds}
          onActivitiesChange={setActivities}
          onSofChange={setSourcesOfFunds}
          activityCatalog={snapshot?.activity_catalog ?? []}
          sofCatalog={snapshot?.sof_catalog ?? []}
          countries={snapshot?.countries ?? []}
          fieldComments={fieldComments}
        />
      )}

      {currentStep === 5 && (
        <StepDocumentsReview
          general={general}
          officers={officers}
          shareClasses={shareClasses}
          activities={activities}
          sourcesOfFunds={sourcesOfFunds}
          nominalDirectors={nominalDirectors}
          documents={documents}
          documentsLoading={documentsLoading}
          selectedFile={selectedFile}
          docType={docType}
          onFileDrop={(files) => setSelectedFile(files[0] || null)}
          onRemoveFile={() => setSelectedFile(null)}
          onDocTypeChange={setDocType}
          onUpload={handleUploadDocument}
          uploadLoading={uploadDocMutation.isPending}
          onSubmit={handleSubmit}
          submitLoading={submitMutation.isPending}
          submitError={submitMutation.isError}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => goToStep((currentStep - 1) as Step)}
          disabled={currentStep === 1}
        >
          {t("common.back")}
        </Button>
        {currentStep < 5 && (
          <Button variant="primary" onClick={() => goToStep((currentStep + 1) as Step)}>
            {t("common.next")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ currentStep, onStepClick }: { currentStep: Step; onStepClick: (step: Step) => void }) {
  const { t } = useTranslation();

  return (
    <nav aria-label="Progress" className="mb-2">
      <ol className="flex items-center">
        {STEPS.map((s, index) => {
          const isActive = s.step === currentStep;
          const isCompleted = s.step < currentStep;

          return (
            <li key={s.step} className={`relative flex-1 ${index < STEPS.length - 1 ? "pr-4" : ""}`}>
              <button type="button" onClick={() => onStepClick(s.step)} className="group flex w-full flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150 ${
                    isCompleted
                      ? "bg-arifa-navy text-white"
                      : isActive
                        ? "border-2 border-arifa-navy bg-white text-arifa-navy"
                        : "border-2 border-gray-300 bg-white text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    s.step
                  )}
                </span>
                <span className={`mt-2 text-xs font-medium ${isActive ? "text-arifa-navy" : isCompleted ? "text-gray-700" : "text-gray-400"}`}>
                  {t(s.labelKey)}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={`absolute right-0 top-4 h-0.5 w-full -translate-y-1/2 ${isCompleted ? "bg-arifa-navy" : "bg-gray-200"}`}
                  style={{ left: "calc(50% + 16px)", width: "calc(100% - 32px)" }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Auto-save Indicator ────────────────────────────────────────────────────

function AutoSaveIndicator({ isSaving, lastSavedAt }: { isSaving: boolean; lastSavedAt: Date | null }) {
  const { t } = useTranslation();
  if (!isSaving && !lastSavedAt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-md bg-white px-4 py-2 text-xs shadow-md">
      {isSaving ? (
        <span className="flex items-center gap-2 text-gray-500">
          <Spinner size="sm" />
          {t("guest.autoSave.saving")}
        </span>
      ) : lastSavedAt ? (
        <span className="text-green-600">
          {t("guest.autoSave.saved", {
            time: lastSavedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          })}
        </span>
      ) : null}
    </div>
  );
}

// ─── Field Comment Helper ───────────────────────────────────────────────────

function FieldComment({ fieldKey, comments }: { fieldKey: string; comments: Record<string, string> }) {
  const comment = comments[fieldKey];
  if (!comment) return null;
  return (
    <div className="mt-1 rounded border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800">
      {comment}
    </div>
  );
}

// ─── Step 1: General ────────────────────────────────────────────────────────

function StepGeneral({
  general,
  onChange,
  fieldComments,
}: {
  general: GeneralData;
  onChange: (field: keyof GeneralData, value: string) => void;
  fieldComments: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.general")}</h2>
      <div className="space-y-4">
        <div>
          <Input label={t("entities.form.name")} value={general.name} onChange={(e) => onChange("name", e.target.value)} />
          <FieldComment fieldKey="general.name" comments={fieldComments} />
        </div>
        <div>
          <Input
            label={t("entities.form.incorporationDate")}
            type="date"
            value={general.incorporation_date}
            onChange={(e) => onChange("incorporation_date", e.target.value)}
          />
          <FieldComment fieldKey="general.incorporation_date" comments={fieldComments} />
        </div>
        <div>
          <Input label={t("entities.form.jurisdiction")} value={general.jurisdiction.toUpperCase()} disabled />
          <p className="mt-1 text-xs text-gray-400">{t("guest.readOnly")}</p>
        </div>
        <div>
          <Input label={t("entities.form.status")} value={general.status} disabled />
          <p className="mt-1 text-xs text-gray-400">{t("guest.readOnly")}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── Step 2: Officers & Directors ───────────────────────────────────────────

const PERSON_TYPE_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "corporate", label: "Corporate" },
];

const ID_TYPE_OPTIONS = [
  { value: "passport", label: "Passport" },
  { value: "cedula", label: "Cedula" },
  { value: "corporate_registry", label: "Corporate Registry" },
];

function StepOfficers({
  officers,
  onChange,
  persons,
  countries,
  fieldComments,
  onCreatePerson,
  isCreatingPerson,
  nominalDirectors,
  onNominalDirectorsChange,
}: {
  officers: SnapshotOfficer[];
  onChange: (officers: SnapshotOfficer[]) => void;
  persons: SnapshotPerson[];
  countries: SnapshotCountry[];
  fieldComments: Record<string, string>;
  onCreatePerson: (data: Record<string, unknown>) => Promise<SnapshotPerson | null>;
  isCreatingPerson: boolean;
  nominalDirectors: boolean;
  onNominalDirectorsChange: (val: boolean) => void;
}) {
  const { t } = useTranslation();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateForIdx, setQuickCreateForIdx] = useState<number | null>(null);
  const [personForm, setPersonForm] = useState({
    full_name: "",
    last_name: "",
    person_type: "natural",
    nationality_id: "",
    country_of_residence_id: "",
    date_of_birth: "",
    identification_number: "",
    identification_type: "",
    pep_status: false,
  });

  const countryOptions = countries.map((c) => ({
    value: c.id,
    label: c.country_name,
  }));

  const handleRemove = (idx: number) => {
    onChange(officers.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    const newOfficer: SnapshotOfficer = {
      id: "",
      officer_person: null,
      officer_entity_id: null,
      officer_entity_name: null,
      positions: ["director"],
      start_date: null,
      end_date: null,
      is_active: true,
    };
    onChange([...officers, newOfficer]);
    setEditingIdx(officers.length);
  };

  const handleUpdate = (idx: number, field: string, value: unknown) => {
    const updated = [...officers];
    if (field === "officer_person_id") {
      const person = persons.find((p) => p.id === value);
      updated[idx] = {
        ...updated[idx],
        officer_person: person ?? null,
      };
    } else if (field === "positions") {
      updated[idx] = { ...updated[idx], positions: value as string[] };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    onChange(updated);
  };

  const resetPersonForm = () => {
    setPersonForm({
      full_name: "",
      last_name: "",
      person_type: "natural",
      nationality_id: "",
      country_of_residence_id: "",
      date_of_birth: "",
      identification_number: "",
      identification_type: "",
      pep_status: false,
    });
  };

  const handleStartQuickCreate = (idx: number) => {
    setQuickCreateForIdx(idx);
    setShowQuickCreate(true);
    resetPersonForm();
  };

  const handleQuickCreatePerson = async () => {
    const currentPositions =
      quickCreateForIdx !== null ? officers[quickCreateForIdx]?.positions : ["director"];
    const data: Record<string, unknown> = {
      full_name: personForm.full_name,
      last_name: personForm.last_name,
      person_type: personForm.person_type,
      nationality_id: personForm.nationality_id || null,
      country_of_residence_id: personForm.country_of_residence_id || null,
      date_of_birth: personForm.date_of_birth || null,
      identification_number: personForm.identification_number,
      identification_type: personForm.identification_type || undefined,
      pep_status: personForm.pep_status,
      positions: currentPositions?.length ? currentPositions : ["director"],
    };
    const created = await onCreatePerson(data);
    if (created && quickCreateForIdx !== null) {
      // The backend already created the EntityOfficer record.
      // Remove the local blank row — the real officer will appear
      // when the snapshot refreshes (triggered by mutation onSuccess).
      const row = officers[quickCreateForIdx];
      if (!row.id) {
        onChange(officers.filter((_, i) => i !== quickCreateForIdx));
      }
      setShowQuickCreate(false);
      setEditingIdx(null);
      resetPersonForm();
    }
  };

  const personOptions = persons.map((p) => ({ value: p.id, label: p.full_name }));

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.officers")}</h2>

      {/* Nominal Directors Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-3 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            checked={nominalDirectors}
            onChange={(e) => onNominalDirectorsChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-arifa-navy"
          />
          {t("guest.nominalDirectors.toggle")}
        </label>
      </div>

      {nominalDirectors && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-blue-900">{t("guest.nominalDirectors.infoTitle")}</h4>
          <p className="mb-2 text-sm text-blue-800">{t("guest.nominalDirectors.infoDescription")}</p>
          <p className="text-xs text-blue-700">{t("guest.nominalDirectors.costNote")}</p>
        </div>
      )}

      <FieldComment fieldKey="officers" comments={fieldComments} />

      {!nominalDirectors && (<>
      <div className="space-y-3">
        {officers.map((officer, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            {editingIdx === idx ? (
              <div className="space-y-3">
                {showQuickCreate && quickCreateForIdx === idx ? (
                  /* ─── Inline Quick-Create Person Form ─── */
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {t("people.quickCreate.title")}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowQuickCreate(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                    <PersonDocumentScan
                      jurisdictions={countries}
                      onApply={(data: PersonFormData) => {
                        setPersonForm((f) => ({
                          ...f,
                          full_name: data.full_name ?? f.full_name,
                          last_name: data.last_name ?? f.last_name,
                          date_of_birth: data.date_of_birth ?? f.date_of_birth,
                          nationality_id: data.nationality_id ?? f.nationality_id,
                          country_of_residence_id: data.country_of_residence_id ?? f.country_of_residence_id,
                          identification_number: data.identification_number ?? f.identification_number,
                          identification_type: data.identification_type ?? f.identification_type,
                        }));
                      }}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label={t("people.form.firstName")}
                        value={personForm.full_name}
                        onChange={(e) => setPersonForm((f) => ({ ...f, full_name: e.target.value }))}
                      />
                      <Input
                        label={t("people.form.lastName")}
                        value={personForm.last_name}
                        onChange={(e) => setPersonForm((f) => ({ ...f, last_name: e.target.value }))}
                      />
                    </div>
                    <Select
                      label={t("people.form.personType")}
                      options={PERSON_TYPE_OPTIONS}
                      value={personForm.person_type}
                      onChange={(e) => setPersonForm((f) => ({ ...f, person_type: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label={t("people.form.nationality")}
                        options={[{ value: "", label: "—" }, ...countryOptions]}
                        value={personForm.nationality_id}
                        onChange={(e) => setPersonForm((f) => ({ ...f, nationality_id: e.target.value }))}
                      />
                      <Select
                        label={t("people.form.countryOfResidence")}
                        options={[{ value: "", label: "—" }, ...countryOptions]}
                        value={personForm.country_of_residence_id}
                        onChange={(e) => setPersonForm((f) => ({ ...f, country_of_residence_id: e.target.value }))}
                      />
                    </div>
                    <Input
                      label={t("people.form.dateOfBirth")}
                      type="date"
                      value={personForm.date_of_birth}
                      onChange={(e) => setPersonForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label={t("people.form.idType")}
                        options={[{ value: "", label: "—" }, ...ID_TYPE_OPTIONS]}
                        value={personForm.identification_type}
                        onChange={(e) => setPersonForm((f) => ({ ...f, identification_type: e.target.value }))}
                      />
                      <Input
                        label={t("people.form.idNumber")}
                        value={personForm.identification_number}
                        onChange={(e) => setPersonForm((f) => ({ ...f, identification_number: e.target.value }))}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={personForm.pep_status}
                        onChange={(e) => setPersonForm((f) => ({ ...f, pep_status: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-arifa-navy"
                      />
                      {t("people.form.pepStatus")}
                    </label>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={handleQuickCreatePerson}
                      loading={isCreatingPerson}
                      disabled={!personForm.full_name.trim()}
                    >
                      {t("people.quickCreate.create")}
                    </Button>
                  </div>
                ) : (
                  /* ─── Normal Officer Edit Form ─── */
                  <>
                    <div>
                      <Select
                        label={t("entities.officers.holder")}
                        options={[{ value: "", label: `— ${t("common.select")} —` }, ...personOptions]}
                        value={officer.officer_person?.id ?? ""}
                        onChange={(e) => handleUpdate(idx, "officer_person_id", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleStartQuickCreate(idx)}
                        className="mt-1 text-xs font-medium text-arifa-navy hover:underline"
                      >
                        + {t("people.quickCreate.title")}
                      </button>
                    </div>
                    <Select
                      label={t("entities.officers.position")}
                      options={POSITION_OPTIONS}
                      value={officer.positions[0] ?? "director"}
                      onChange={(e) => handleUpdate(idx, "positions", [e.target.value])}
                    />
                    <Input
                      label={t("entities.officers.startDate")}
                      type="date"
                      value={officer.start_date ?? ""}
                      onChange={(e) => handleUpdate(idx, "start_date", e.target.value || null)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingIdx(null)}>
                        {t("common.close")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {officer.officer_person?.full_name ?? officer.officer_entity_name ?? "—"}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {officer.positions.map((pos) => (
                      <Badge key={pos} color="blue">{pos}</Badge>
                    ))}
                    {!officer.is_active && <Badge color="gray">Inactive</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setEditingIdx(idx)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => handleRemove(idx)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Button variant="secondary" onClick={handleAdd} className="mt-4 w-full">
        + {t("entities.officers.add")}
      </Button>
      </>)}
    </Card>
  );
}

// ─── Step 3: Share Register ─────────────────────────────────────────────────

function StepShares({
  shareClasses,
  onChange,
  persons,
  fieldComments,
}: {
  shareClasses: SnapshotShareClass[];
  onChange: (classes: SnapshotShareClass[]) => void;
  persons: SnapshotPerson[];
  fieldComments: Record<string, string>;
}) {
  const { t } = useTranslation();

  // Share class creation form
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm] = useState({
    name: "",
    currency: "USD",
    par_value: "",
    authorized_shares: "",
    voting_rights: true,
  });

  // Issuance creation form
  const [issuanceForClassIdx, setIssuanceForClassIdx] = useState<number | null>(null);
  const [issuanceForm, setIssuanceForm] = useState({
    holder_person_id: "",
    num_shares: "",
    certificate_number: "",
    issue_date: "",
    is_jtwros: false,
    jtwros_partner_name: "",
    is_trustee: false,
    trustee_for: "",
  });

  const personOptions = persons.map((p) => ({ value: p.id, label: p.full_name }));

  const resetClassForm = () => {
    setClassForm({ name: "", currency: "USD", par_value: "", authorized_shares: "", voting_rights: true });
    setShowClassForm(false);
  };

  const handleAddClass = () => {
    if (!classForm.name.trim()) return;
    const newClass: SnapshotShareClass = {
      id: crypto.randomUUID(),
      name: classForm.name.trim(),
      currency: classForm.currency,
      par_value: classForm.par_value || null,
      authorized_shares: classForm.authorized_shares ? Number(classForm.authorized_shares) : null,
      voting_rights: classForm.voting_rights,
      issuances: [],
    };
    onChange([...shareClasses, newClass]);
    resetClassForm();
  };

  const handleDeleteClass = (idx: number) => {
    onChange(shareClasses.filter((_, i) => i !== idx));
  };

  const resetIssuanceForm = () => {
    setIssuanceForm({ holder_person_id: "", num_shares: "", certificate_number: "", issue_date: "", is_jtwros: false, jtwros_partner_name: "", is_trustee: false, trustee_for: "" });
    setIssuanceForClassIdx(null);
  };

  const handleAddIssuance = (scIdx: number) => {
    if (!issuanceForm.num_shares) return;
    const sc = shareClasses[scIdx];
    const holder = persons.find((p) => p.id === issuanceForm.holder_person_id) ?? null;
    const newIssuance: SnapshotShareIssuance = {
      id: crypto.randomUUID(),
      share_class_id: sc.id,
      shareholder_person: holder,
      shareholder_entity_id: null,
      shareholder_entity_name: null,
      num_shares: Number(issuanceForm.num_shares),
      issue_date: issuanceForm.issue_date || null,
      certificate_number: issuanceForm.certificate_number,
      is_jtwros: issuanceForm.is_jtwros,
      jtwros_partner_name: issuanceForm.jtwros_partner_name,
      is_trustee: issuanceForm.is_trustee,
      trustee_for: issuanceForm.trustee_for,
    };
    const updated = [...shareClasses];
    updated[scIdx] = { ...sc, issuances: [...sc.issuances, newIssuance] };
    onChange(updated);
    resetIssuanceForm();
  };

  const handleDeleteIssuance = (scIdx: number, issIdx: number) => {
    const sc = shareClasses[scIdx];
    const updated = [...shareClasses];
    updated[scIdx] = { ...sc, issuances: sc.issuances.filter((_, i) => i !== issIdx) };
    onChange(updated);
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t("guest.steps.shares")}</h2>
        <button
          type="button"
          onClick={() => setShowClassForm(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-arifa-navy text-white hover:bg-arifa-navy/90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
      <FieldComment fieldKey="shares" comments={fieldComments} />

      {/* Inline class creation form */}
      {showClassForm && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">{t("entities.shareRegister.addClass")}</h4>
          <Input
            label={t("entities.shareRegister.className")}
            value={classForm.name}
            onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("entities.shareRegister.currency")}
              options={CURRENCY_OPTIONS}
              value={classForm.currency}
              onChange={(e) => setClassForm((f) => ({ ...f, currency: e.target.value }))}
            />
            <Input
              label={t("entities.shareRegister.parValue")}
              value={classForm.par_value}
              onChange={(e) => setClassForm((f) => ({ ...f, par_value: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <Input
            label={t("entities.shareRegister.authorizedShares")}
            type="number"
            value={classForm.authorized_shares}
            onChange={(e) => setClassForm((f) => ({ ...f, authorized_shares: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={classForm.voting_rights}
              onChange={(e) => setClassForm((f) => ({ ...f, voting_rights: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-arifa-navy"
            />
            {t("entities.shareRegister.votingRights")}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetClassForm}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddClass} disabled={!classForm.name.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      {shareClasses.length === 0 && !showClassForm ? (
        <p className="py-4 text-center text-sm text-gray-400">{t("guest.noShareClasses")}</p>
      ) : (
        <div className="space-y-4">
          {shareClasses.map((sc, scIdx) => (
            <div key={sc.id || scIdx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">{sc.name}</h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{sc.currency}</span>
                  {sc.par_value && <span>Par: {sc.par_value}</span>}
                  {sc.authorized_shares && <span>Auth: {sc.authorized_shares}</span>}
                  {sc.voting_rights && <Badge color="blue">{t("entities.shareRegister.voting")}</Badge>}
                  <button
                    type="button"
                    onClick={() => handleDeleteClass(scIdx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Issuances */}
              {sc.issuances.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const totalIssued = sc.issuances.reduce((sum, iss) => sum + iss.num_shares, 0);
                    return sc.issuances.map((iss, issIdx) => (
                      <div key={iss.id} className="rounded border border-gray-100 bg-white px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-900">
                              {iss.shareholder_person?.full_name ?? iss.shareholder_entity_name ?? "—"}
                            </span>
                            {iss.is_jtwros && iss.jtwros_partner_name && (
                              <p className="text-xs text-gray-500">{t("entities.shareRegister.jtwrosPartner")}: {iss.jtwros_partner_name}</p>
                            )}
                            {iss.is_trustee && iss.trustee_for && (
                              <p className="text-xs text-gray-500">{t("entities.shareRegister.trusteeFor")}: {iss.trustee_for}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {iss.is_jtwros && <Badge color="blue">JTWROS</Badge>}
                            {iss.is_trustee && <Badge color="yellow">{t("entities.shareRegister.trustee")}</Badge>}
                            <span className="text-gray-500">
                              {iss.num_shares.toLocaleString()} {t("entities.shareRegister.shares").toLowerCase()}
                            </span>
                            {totalIssued > 0 && (
                              <span className="text-xs text-gray-400">
                                ({(iss.num_shares / totalIssued * 100).toFixed(1)}%)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteIssuance(scIdx, issIdx)}
                              className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-xs text-gray-400">{t("guest.noIssuances")}</p>
              )}

              {/* Inline issuance creation form */}
              {issuanceForClassIdx === scIdx ? (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
                  <h5 className="text-xs font-semibold text-gray-900">{t("entities.shareRegister.addIssuance")}</h5>
                  <Select
                    label={t("entities.shareRegister.holder")}
                    options={[{ value: "", label: `— ${t("common.select")} —` }, ...personOptions]}
                    value={issuanceForm.holder_person_id}
                    onChange={(e) => setIssuanceForm((f) => ({ ...f, holder_person_id: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t("entities.shareRegister.numShares")}
                      type="number"
                      value={issuanceForm.num_shares}
                      onChange={(e) => setIssuanceForm((f) => ({ ...f, num_shares: e.target.value }))}
                    />
                    <Input
                      label={t("entities.shareRegister.certificate")}
                      value={issuanceForm.certificate_number}
                      onChange={(e) => setIssuanceForm((f) => ({ ...f, certificate_number: e.target.value }))}
                    />
                  </div>
                  <Input
                    label={t("entities.shareRegister.issueDate")}
                    type="date"
                    value={issuanceForm.issue_date}
                    onChange={(e) => setIssuanceForm((f) => ({ ...f, issue_date: e.target.value }))}
                  />
                  <div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={issuanceForm.is_jtwros}
                        onChange={(e) => setIssuanceForm((f) => ({ ...f, is_jtwros: e.target.checked, jtwros_partner_name: e.target.checked ? f.jtwros_partner_name : "" }))}
                        className="h-4 w-4 rounded border-gray-300 text-arifa-navy"
                      />
                      {t("entities.shareRegister.isJtwros")}
                    </label>
                    <p className="mt-1 ml-6 text-xs text-gray-500">{t("entities.shareRegister.jtwrosHint")}</p>
                    {issuanceForm.is_jtwros && (
                      <div className="mt-2 ml-6">
                        <Input
                          label={t("entities.shareRegister.jtwrosPartnerName")}
                          value={issuanceForm.jtwros_partner_name}
                          onChange={(e) => setIssuanceForm((f) => ({ ...f, jtwros_partner_name: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={issuanceForm.is_trustee}
                        onChange={(e) => setIssuanceForm((f) => ({ ...f, is_trustee: e.target.checked, trustee_for: e.target.checked ? f.trustee_for : "" }))}
                        className="h-4 w-4 rounded border-gray-300 text-arifa-navy"
                      />
                      {t("entities.shareRegister.isTrustee")}
                    </label>
                    <p className="mt-1 ml-6 text-xs text-gray-500">{t("entities.shareRegister.trusteeHint")}</p>
                    {issuanceForm.is_trustee && (
                      <div className="mt-2 ml-6">
                        <Input
                          label={t("entities.shareRegister.trusteeFor")}
                          value={issuanceForm.trustee_for}
                          onChange={(e) => setIssuanceForm((f) => ({ ...f, trustee_for: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={resetIssuanceForm}>
                      {t("common.cancel")}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleAddIssuance(scIdx)} disabled={!issuanceForm.num_shares}>
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { resetIssuanceForm(); setIssuanceForClassIdx(scIdx); }}
                  className="mt-2 text-xs font-medium text-arifa-navy hover:underline"
                >
                  + {t("entities.shareRegister.addIssuance")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Step 4: Risk Profile ───────────────────────────────────────────────────

function StepRiskProfile({
  activities,
  sourcesOfFunds,
  onActivitiesChange,
  onSofChange,
  activityCatalog,
  sofCatalog,
  countries,
  fieldComments,
}: {
  activities: SnapshotActivity[];
  sourcesOfFunds: SnapshotSourceOfFunds[];
  onActivitiesChange: (a: SnapshotActivity[]) => void;
  onSofChange: (s: SnapshotSourceOfFunds[]) => void;
  activityCatalog: CatalogItem[];
  sofCatalog: CatalogItem[];
  countries: SnapshotCountry[];
  fieldComments: Record<string, string>;
}) {
  const { t } = useTranslation();

  // Activity form state
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ activity_id: "", country_ids: [] as string[], description: "" });

  // Source of funds form state
  const [showSofForm, setShowSofForm] = useState(false);
  const [sofForm, setSofForm] = useState({ source_id: "", country_ids: [] as string[], description: "" });

  const countryOptions = countries.map((c) => ({ value: c.id, label: c.country_name }));
  const activityOptions = activityCatalog.map((a) => ({ value: a.id, label: a.name }));
  const sofOptions = sofCatalog.map((s) => ({ value: s.id, label: s.name }));

  const riskBadgeColor = (level: string) => {
    if (level === "high" || level === "ultra_high") return "red" as const;
    if (level === "medium") return "yellow" as const;
    return "green" as const;
  };

  const selectedActivityCatalog = activityCatalog.find((a) => a.id === activityForm.activity_id);
  const selectedSofCatalog = sofCatalog.find((s) => s.id === sofForm.source_id);

  const resetActivityForm = () => {
    setActivityForm({ activity_id: "", country_ids: [], description: "" });
    setShowActivityForm(false);
  };

  const handleAddActivity = () => {
    if (!activityForm.activity_id) return;
    const catalog = activityCatalog.find((a) => a.id === activityForm.activity_id);
    if (!catalog) return;
    const selectedCountries = countries.filter((c) => activityForm.country_ids.includes(c.id));
    const newActivity: SnapshotActivity = {
      id: crypto.randomUUID(),
      activity_id: catalog.id,
      activity_name: catalog.name,
      countries: selectedCountries,
      risk_level: catalog.default_risk_level,
      description: activityForm.description,
    };
    onActivitiesChange([...activities, newActivity]);
    resetActivityForm();
  };

  const handleDeleteActivity = (idx: number) => {
    onActivitiesChange(activities.filter((_, i) => i !== idx));
  };

  const resetSofForm = () => {
    setSofForm({ source_id: "", country_ids: [], description: "" });
    setShowSofForm(false);
  };

  const handleAddSof = () => {
    if (!sofForm.source_id) return;
    const catalog = sofCatalog.find((s) => s.id === sofForm.source_id);
    if (!catalog) return;
    const selectedCountries = countries.filter((c) => sofForm.country_ids.includes(c.id));
    const newSof: SnapshotSourceOfFunds = {
      id: crypto.randomUUID(),
      source_id: catalog.id,
      source_name: catalog.name,
      countries: selectedCountries,
      risk_level: catalog.default_risk_level,
      description: sofForm.description,
    };
    onSofChange([...sourcesOfFunds, newSof]);
    resetSofForm();
  };

  const handleDeleteSof = (idx: number) => {
    onSofChange(sourcesOfFunds.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.riskProfile")}</h2>
      <FieldComment fieldKey="risk_profile" comments={fieldComments} />

      {/* Activities */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{t("entities.activities.title")}</h3>
          <button
            type="button"
            onClick={() => setShowActivityForm(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-arifa-navy text-white hover:bg-arifa-navy/90"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Inline activity creation form */}
        {showActivityForm && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">{t("entities.activities.add")}</h4>
            <Select
              label={t("entities.activities.activity")}
              options={[{ value: "", label: `— ${t("entities.activities.selectActivity")} —` }, ...activityOptions]}
              value={activityForm.activity_id}
              onChange={(e) => setActivityForm((f) => ({ ...f, activity_id: e.target.value }))}
            />
            {selectedActivityCatalog && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">{t("entities.activities.defaultRisk")}:</span>
                <Badge color={riskBadgeColor(selectedActivityCatalog.default_risk_level)}>
                  {selectedActivityCatalog.default_risk_level}
                </Badge>
              </div>
            )}
            <SearchableMultiSelect
              label={t("entities.activities.countries")}
              options={countryOptions}
              value={activityForm.country_ids}
              onChange={(vals) => setActivityForm((f) => ({ ...f, country_ids: vals }))}
              placeholder={t("entities.activities.selectCountries")}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("entities.activities.description")}</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-arifa-navy focus:ring-1 focus:ring-arifa-navy"
                rows={2}
                value={activityForm.description}
                onChange={(e) => setActivityForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetActivityForm}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddActivity} disabled={!activityForm.activity_id}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}

        {activities.length === 0 && !showActivityForm ? (
          <p className="py-2 text-center text-sm text-gray-400">{t("guest.noActivities")}</p>
        ) : (
          <div className="space-y-2">
            {activities.map((a, idx) => (
              <div key={a.id || idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.activity_name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.countries.map((c) => (
                      <Badge key={c.id} color="gray">{c.country_name}</Badge>
                    ))}
                  </div>
                  {a.description && <p className="mt-1 text-xs text-gray-500">{a.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={riskBadgeColor(a.risk_level)}>{a.risk_level}</Badge>
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(idx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sources of Funds */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{t("entities.sourcesOfFunds.title")}</h3>
          <button
            type="button"
            onClick={() => setShowSofForm(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-arifa-navy text-white hover:bg-arifa-navy/90"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Inline source of funds creation form */}
        {showSofForm && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">{t("entities.sourcesOfFunds.add")}</h4>
            <Select
              label={t("entities.sourcesOfFunds.source")}
              options={[{ value: "", label: `— ${t("entities.sourcesOfFunds.selectSource")} —` }, ...sofOptions]}
              value={sofForm.source_id}
              onChange={(e) => setSofForm((f) => ({ ...f, source_id: e.target.value }))}
            />
            {selectedSofCatalog && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">{t("entities.activities.defaultRisk")}:</span>
                <Badge color={riskBadgeColor(selectedSofCatalog.default_risk_level)}>
                  {selectedSofCatalog.default_risk_level}
                </Badge>
              </div>
            )}
            <SearchableMultiSelect
              label={t("entities.sourcesOfFunds.countries")}
              options={countryOptions}
              value={sofForm.country_ids}
              onChange={(vals) => setSofForm((f) => ({ ...f, country_ids: vals }))}
              placeholder={t("entities.sourcesOfFunds.selectCountries")}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("entities.sourcesOfFunds.description")}</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-arifa-navy focus:ring-1 focus:ring-arifa-navy"
                rows={2}
                value={sofForm.description}
                onChange={(e) => setSofForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetSofForm}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddSof} disabled={!sofForm.source_id}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}

        {sourcesOfFunds.length === 0 && !showSofForm ? (
          <p className="py-2 text-center text-sm text-gray-400">{t("guest.noSourcesOfFunds")}</p>
        ) : (
          <div className="space-y-2">
            {sourcesOfFunds.map((s, idx) => (
              <div key={s.id || idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.source_name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.countries.map((c) => (
                      <Badge key={c.id} color="gray">{c.country_name}</Badge>
                    ))}
                  </div>
                  {s.description && <p className="mt-1 text-xs text-gray-500">{s.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={riskBadgeColor(s.risk_level)}>{s.risk_level}</Badge>
                  <button
                    type="button"
                    onClick={() => handleDeleteSof(idx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Step 5: Documents & Review ─────────────────────────────────────────────

function StepDocumentsReview({
  general,
  officers,
  shareClasses,
  activities,
  sourcesOfFunds,
  nominalDirectors,
  documents,
  documentsLoading,
  selectedFile,
  docType,
  onFileDrop,
  onRemoveFile,
  onDocTypeChange,
  onUpload,
  uploadLoading,
  onSubmit,
  submitLoading,
  submitError,
}: {
  general: GeneralData;
  officers: SnapshotOfficer[];
  shareClasses: SnapshotShareClass[];
  activities: SnapshotActivity[];
  sourcesOfFunds: SnapshotSourceOfFunds[];
  nominalDirectors: boolean;
  documents: DocumentUpload[];
  documentsLoading: boolean;
  selectedFile: File | null;
  docType: DocumentUpload["document_type"];
  onFileDrop: (files: File[]) => void;
  onRemoveFile: () => void;
  onDocTypeChange: (type: DocumentUpload["document_type"]) => void;
  onUpload: () => void;
  uploadLoading: boolean;
  onSubmit: () => void;
  submitLoading: boolean;
  submitError: boolean;
}) {
  const { t } = useTranslation();

  const translatedDocTypeOptions = DOC_TYPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  return (
    <div className="space-y-6">
      {/* Document Upload */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.documentsReview")}</h2>

        {/* Uploaded documents */}
        {documentsLoading ? (
          <div className="flex justify-center py-4"><Spinner size="md" /></div>
        ) : documents.length > 0 ? (
          <div className="mb-4 space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                <span className="text-sm text-gray-900">{doc.original_filename}</span>
                <Badge color="green">{t("common.uploaded")}</Badge>
              </div>
            ))}
          </div>
        ) : null}

        {/* Upload form */}
        <div className="space-y-4">
          <FormField label={t("documents.type")} required>
            <Select
              options={translatedDocTypeOptions}
              value={docType}
              onChange={(e) => onDocTypeChange(e.target.value as DocumentUpload["document_type"])}
            />
          </FormField>

          {!selectedFile ? (
            <FileDropzone onDrop={onFileDrop} accept={ACCEPTED_FILE_TYPES} maxSize={MAX_FILE_SIZE} label={t("documents.upload.title")} />
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button type="button" onClick={onRemoveFile} className="rounded-md p-1 text-gray-400 hover:bg-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <Button variant="secondary" onClick={onUpload} disabled={!selectedFile || uploadLoading} loading={uploadLoading} className="w-full">
            {t("documents.upload.title")}
          </Button>
        </div>
      </Card>

      {/* Review Summary */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">{t("kyc.review.title")}</h3>

        <div className="space-y-3">
          <ReviewRow label={t("entities.form.name")} value={general.name} />
          <ReviewRow label={t("entities.form.jurisdiction")} value={general.jurisdiction.toUpperCase()} />
          <ReviewRow label={t("entities.form.incorporationDate")} value={general.incorporation_date || "—"} />
          <ReviewRow label={t("entities.officers.title")} value={nominalDirectors ? t("guest.nominalDirectors.requested") : `${officers.length}`} />
          <ReviewRow label={t("entities.shareRegister.title")} value={`${shareClasses.length} classes`} />
          <ReviewRow label={t("entities.activities.title")} value={`${activities.length}`} />
          <ReviewRow label={t("entities.sourcesOfFunds.title")} value={`${sourcesOfFunds.length}`} />
          <ReviewRow label={t("documents.title")} value={`${documents.length}`} />
        </div>
      </Card>

      {/* Submit */}
      {submitError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("common.error")}
        </div>
      )}

      <Button variant="primary" size="lg" className="w-full" onClick={onSubmit} loading={submitLoading}>
        {t("common.submit")}
      </Button>
    </div>
  );
}

// ─── Review Row Helper ──────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="ml-4 text-right text-sm font-medium text-gray-900">{value || "—"}</span>
    </div>
  );
}
