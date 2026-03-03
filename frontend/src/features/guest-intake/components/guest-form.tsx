import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { FormField } from "@/components/forms/form-field";
import { FileDropzone } from "@/components/forms/file-dropzone";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  useGuestEntitySnapshot,
  useGuestProposeChanges,
  useGuestUploadDocument,
  useGuestDocuments,
  useGuestSubmitKYC,
  type SnapshotOfficer,
  type SnapshotShareClass,
  type SnapshotActivity,
  type SnapshotSourceOfFunds,
  type SnapshotPerson,
  type CatalogItem,
  type SnapshotCountry,
} from "@/features/guest-intake/api/guest-api";
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
  const [officers, setOfficers] = useState<SnapshotOfficer[]>([]);
  const [shareClasses, setShareClasses] = useState<SnapshotShareClass[]>([]);
  const [activities, setActivities] = useState<SnapshotActivity[]>([]);
  const [sourcesOfFunds, setSourcesOfFunds] = useState<SnapshotSourceOfFunds[]>([]);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentUpload["document_type"]>("passport");

  // Queries & mutations
  const { data: snapshot, isLoading: snapshotLoading } = useGuestEntitySnapshot(kycId);
  const proposeChangesMutation = useGuestProposeChanges(kycId);
  const uploadDocMutation = useGuestUploadDocument(kycId);
  const submitMutation = useGuestSubmitKYC();
  const { data: documents = [], isLoading: documentsLoading } = useGuestDocuments(kycId);

  // Populate form from snapshot (or proposed data if sent back)
  useEffect(() => {
    if (!snapshot) return;

    const isSentBack = snapshot.kyc_status === "sent_back";
    const proposed = isSentBack && Object.keys(snapshot.proposed_entity_data).length > 0
      ? snapshot.proposed_entity_data
      : null;

    if (proposed) {
      const pg = (proposed as Record<string, unknown>).general as GeneralData | undefined;
      if (pg) setGeneral({ ...snapshot.general, ...pg, incorporation_date: pg.incorporation_date ?? "" });
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
      },
      officers,
      share_classes: shareClasses,
      activities,
      sources_of_funds: sourcesOfFunds,
    }),
    [general, officers, shareClasses, activities, sourcesOfFunds],
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

  // Loading state
  if (snapshotLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
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
          persons={snapshot?.persons ?? []}
          fieldComments={fieldComments}
        />
      )}

      {currentStep === 3 && (
        <StepShares
          shareClasses={shareClasses}
          onChange={setShareClasses}
          persons={snapshot?.persons ?? []}
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

function StepOfficers({
  officers,
  onChange,
  persons,
  fieldComments,
}: {
  officers: SnapshotOfficer[];
  onChange: (officers: SnapshotOfficer[]) => void;
  persons: SnapshotPerson[];
  fieldComments: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleRemove = (idx: number) => {
    onChange(officers.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    const newOfficer: SnapshotOfficer = {
      id: "",
      officer_person: persons[0] ?? null,
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

  const personOptions = persons.map((p) => ({ value: p.id, label: p.full_name }));

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.officers")}</h2>
      <FieldComment fieldKey="officers" comments={fieldComments} />

      <div className="space-y-3">
        {officers.map((officer, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            {editingIdx === idx ? (
              <div className="space-y-3">
                <Select
                  label={t("entities.officers.holder")}
                  options={personOptions}
                  value={officer.officer_person?.id ?? ""}
                  onChange={(e) => handleUpdate(idx, "officer_person_id", e.target.value)}
                />
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
    </Card>
  );
}

// ─── Step 3: Share Register ─────────────────────────────────────────────────

function StepShares({
  shareClasses,
  onChange: _onChange,
  persons: _persons,
  fieldComments,
}: {
  shareClasses: SnapshotShareClass[];
  onChange: (classes: SnapshotShareClass[]) => void;
  persons: SnapshotPerson[];
  fieldComments: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.shares")}</h2>
      <FieldComment fieldKey="shares" comments={fieldComments} />

      {shareClasses.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t("guest.noShareClasses")}</p>
      ) : (
        <div className="space-y-4">
          {shareClasses.map((sc, scIdx) => (
            <div key={sc.id || scIdx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">{sc.name}</h4>
                <div className="flex gap-2 text-xs text-gray-500">
                  <span>{sc.currency}</span>
                  {sc.par_value && <span>Par: {sc.par_value}</span>}
                  {sc.authorized_shares && <span>Auth: {sc.authorized_shares}</span>}
                  {sc.voting_rights && <Badge color="blue">{t("entities.shareRegister.voting")}</Badge>}
                </div>
              </div>
              {sc.issuances.length > 0 ? (
                <div className="space-y-2">
                  {sc.issuances.map((iss) => (
                    <div key={iss.id} className="flex items-center justify-between rounded border border-gray-100 bg-white px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">
                        {iss.shareholder_person?.full_name ?? iss.shareholder_entity_name ?? "—"}
                      </span>
                      <span className="text-gray-500">
                        {iss.num_shares.toLocaleString()} {t("entities.shareRegister.shares").toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">{t("guest.noIssuances")}</p>
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
  onActivitiesChange: _onActivitiesChange,
  onSofChange: _onSofChange,
  activityCatalog: _activityCatalog,
  sofCatalog: _sofCatalog,
  countries: _countries,
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

  const riskBadgeColor = (level: string) => {
    if (level === "high" || level === "ultra_high") return "red" as const;
    if (level === "medium") return "yellow" as const;
    return "green" as const;
  };

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("guest.steps.riskProfile")}</h2>
      <FieldComment fieldKey="risk_profile" comments={fieldComments} />

      {/* Activities */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("entities.activities.title")}</h3>
        {activities.length === 0 ? (
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
                </div>
                <Badge color={riskBadgeColor(a.risk_level)}>{a.risk_level}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sources of Funds */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("entities.sourcesOfFunds.title")}</h3>
        {sourcesOfFunds.length === 0 ? (
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
                </div>
                <Badge color={riskBadgeColor(s.risk_level)}>{s.risk_level}</Badge>
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
          <ReviewRow label={t("entities.officers.title")} value={`${officers.length}`} />
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
