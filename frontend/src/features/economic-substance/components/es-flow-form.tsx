import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Stepper } from "@/components/navigation/stepper";
import {
  ESQuestionRenderer,
  type FlowStepConfig,
} from "./es-question-renderer";
import { ESReviewSubmit } from "./es-review-submit";
import type { EconomicSubstanceSubmission } from "../api/es-api";

// ─── ES Flow Step Definitions ───────────────────────────────────────────────

export function getESFlowSteps(t: (key: string, fallback?: string) => string): FlowStepConfig[] {
  return [
    {
      key: "relevant_activities",
      label: t("economicSubstance.flow.steps.relevantActivities.label", "Relevant Activities"),
      description: t(
        "economicSubstance.flow.steps.relevantActivities.description",
        "Select all relevant activities carried out by this entity during the fiscal period.",
      ),
      type: "multi_select",
      options: [
        { value: "banking", label: t("economicSubstance.flow.steps.relevantActivities.banking", "Banking business") },
        { value: "insurance", label: t("economicSubstance.flow.steps.relevantActivities.insurance", "Insurance business") },
        { value: "fund_management", label: t("economicSubstance.flow.steps.relevantActivities.fundManagement", "Fund management business") },
        { value: "financing_leasing", label: t("economicSubstance.flow.steps.relevantActivities.financingLeasing", "Financing and leasing business") },
        { value: "headquarters", label: t("economicSubstance.flow.steps.relevantActivities.headquarters", "Headquarters business") },
        { value: "shipping", label: t("economicSubstance.flow.steps.relevantActivities.shipping", "Shipping business") },
        { value: "holding", label: t("economicSubstance.flow.steps.relevantActivities.holding", "Holding company business") },
        { value: "ip", label: t("economicSubstance.flow.steps.relevantActivities.ip", "Intellectual property business") },
        { value: "distribution_service", label: t("economicSubstance.flow.steps.relevantActivities.distributionService", "Distribution and service centre business") },
      ],
      noneOption: "__none__",
    },
    {
      key: "directed_managed",
      label: t("economicSubstance.flow.steps.directedManaged.label", "Directed and Managed"),
      description: t(
        "economicSubstance.flow.steps.directedManaged.description",
        "Is the entity directed and managed in the jurisdiction of incorporation?",
      ),
      type: "yes_no",
    },
    {
      key: "ciga_in_jurisdiction",
      label: t("economicSubstance.flow.steps.cigaInJurisdiction.label", "Core Income-Generating Activities (CIGA)"),
      description: t(
        "economicSubstance.flow.steps.cigaInJurisdiction.description",
        "Are the core income-generating activities (CIGA) conducted in the jurisdiction?",
      ),
      type: "yes_no",
    },
    {
      key: "adequate_employees",
      label: t("economicSubstance.flow.steps.adequateEmployees.label", "Adequate Employees"),
      description: t(
        "economicSubstance.flow.steps.adequateEmployees.description",
        "Does the entity have an adequate number of qualified employees in the jurisdiction?",
      ),
      type: "yes_no",
    },
    {
      key: "adequate_expenditure",
      label: t("economicSubstance.flow.steps.adequateExpenditure.label", "Adequate Expenditure"),
      description: t(
        "economicSubstance.flow.steps.adequateExpenditure.description",
        "Does the entity incur adequate operating expenditure in the jurisdiction?",
      ),
      type: "yes_no",
    },
    {
      key: "physical_presence",
      label: t("economicSubstance.flow.steps.physicalPresence.label", "Physical Presence"),
      description: t(
        "economicSubstance.flow.steps.physicalPresence.description",
        "Does the entity have physical offices or premises in the jurisdiction?",
      ),
      type: "yes_no",
    },
    {
      key: "tax_residence",
      label: t("economicSubstance.flow.steps.taxResidence.label", "Tax Residence"),
      description: t(
        "economicSubstance.flow.steps.taxResidence.description",
        "Select the jurisdiction where the entity is tax resident.",
      ),
      type: "country_select",
    },
    {
      key: "shareholders",
      label: t("economicSubstance.flow.steps.shareholders.label", "Shareholders"),
      description: t(
        "economicSubstance.flow.steps.shareholders.description",
        "Provide the list of shareholders, their type, and ownership percentage.",
      ),
      type: "shareholders_list",
    },
    {
      key: "review",
      label: t("economicSubstance.flow.steps.review.label", "Review & Submit"),
      description: t("economicSubstance.flow.steps.review.description", "Review all your answers before submission."),
      type: "terminal",
      terminalType: "completed",
    },
  ];
}

// Keep a static version for index lookups that don't need translations
const ES_FLOW_STEPS_KEYS = [
  "relevant_activities",
  "directed_managed",
  "ciga_in_jurisdiction",
  "adequate_employees",
  "adequate_expenditure",
  "physical_presence",
  "tax_residence",
  "shareholders",
  "review",
];

// ─── Step index helpers ─────────────────────────────────────────────────────

function getStepIndex(stepKey: string): number {
  const idx = ES_FLOW_STEPS_KEYS.indexOf(stepKey);
  return idx >= 0 ? idx : 0;
}

// ─── Main Flow Form Component ───────────────────────────────────────────────

interface ESFlowFormProps {
  submission: EconomicSubstanceSubmission;
  onAdvanceStep: (stepKey: string, answer: unknown) => Promise<void>;
  onUpdateSubmission: (data: Partial<EconomicSubstanceSubmission>) => Promise<void>;
  onSubmit: () => Promise<void>;
  isSaving?: boolean;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function ESFlowForm({
  submission,
  onAdvanceStep,
  onUpdateSubmission,
  onSubmit,
  isSaving = false,
  isSubmitting = false,
  disabled = false,
}: ESFlowFormProps) {
  const { t } = useTranslation();
  const ES_FLOW_STEPS = getESFlowSteps(t);

  // Local step index for navigation — initialize from current_step
  const [currentIdx, setCurrentIdx] = useState(() =>
    getStepIndex(submission.current_step),
  );

  // Local answer state — seeded from submission.flow_answers
  const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>(
    () => ({ ...(submission.flow_answers ?? {}) }),
  );

  // Local shareholders data
  const [localShareholders, setLocalShareholders] = useState(
    () => [...(submission.shareholders_data ?? [])],
  );

  // Auto-save debounce
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const onUpdateRef = useRef(onUpdateSubmission);
  onUpdateRef.current = onUpdateSubmission;
  const initializedRef = useRef(false);

  // Re-sync from server only once when submission loads
  useEffect(() => {
    if (!initializedRef.current && submission) {
      initializedRef.current = true;
      setLocalAnswers({ ...(submission.flow_answers ?? {}) });
      setLocalShareholders([...(submission.shareholders_data ?? [])]);
      setCurrentIdx(getStepIndex(submission.current_step));
    }
  }, [submission]);

  // Auto-save callback
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onUpdateRef.current({
        flow_answers: localAnswers,
        shareholders_data: localShareholders,
      });
    }, 1500);
  }, [localAnswers, localShareholders]);

  // Trigger auto-save on changes
  useEffect(() => {
    if (initializedRef.current) {
      triggerAutoSave();
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [localAnswers, localShareholders, triggerAutoSave]);

  const currentStep = ES_FLOW_STEPS[currentIdx];
  const isFirstStep = currentIdx === 0;
  const isLastStep = currentIdx === ES_FLOW_STEPS.length - 1;
  const isReviewStep = currentStep?.type === "terminal" && currentStep?.terminalType === "completed";

  // Completed steps — any step with an answer
  const completedStepNumbers = ES_FLOW_STEPS.map((step, idx) => {
    if (step.type === "shareholders_list") {
      return localShareholders.length > 0 ? idx + 1 : null;
    }
    if (step.type === "terminal") return null;
    const val = localAnswers[step.key];
    if (val !== undefined && val !== null && val !== "") {
      if (Array.isArray(val) && val.length === 0) return null;
      return idx + 1;
    }
    return null;
  }).filter((n): n is number => n !== null);

  const handleAnswerChange = (value: unknown) => {
    setLocalAnswers((prev) => ({
      ...prev,
      [currentStep.key]: value,
    }));
  };

  const handleShareholdersChange = (
    data: Array<{ name: string; type: string; percentage: number }>,
  ) => {
    setLocalShareholders(data);
  };

  const handleNext = async () => {
    if (disabled) return;

    // Advance step on the backend
    try {
      const answer =
        currentStep.type === "shareholders_list"
          ? localShareholders
          : localAnswers[currentStep.key];

      await onAdvanceStep(currentStep.key, answer);
    } catch {
      // Advance failed — stay on current step
      return;
    }

    if (!isLastStep) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const canAdvance = (() => {
    if (disabled) return false;
    if (currentStep.type === "terminal") return false;
    if (currentStep.type === "yes_no") {
      return localAnswers[currentStep.key] !== undefined;
    }
    if (currentStep.type === "multi_select") {
      const val = localAnswers[currentStep.key];
      return Array.isArray(val) && val.length > 0;
    }
    if (currentStep.type === "country_select") {
      const val = localAnswers[currentStep.key];
      return !!val;
    }
    if (currentStep.type === "shareholders_list") {
      return localShareholders.length > 0;
    }
    return true;
  })();

  // Stepper data
  const stepperSteps = ES_FLOW_STEPS.map((s) => ({
    label: s.label,
  }));

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <Card>
        <Stepper
          steps={stepperSteps}
          currentStep={currentIdx + 1}
          completedSteps={completedStepNumbers}
        />
      </Card>

      {/* Auto-save indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Spinner size="sm" />
          {t("es.flow.saving")}
        </div>
      )}

      {/* Current question or review */}
      <Card>
        {isReviewStep ? (
          <ESReviewSubmit
            submission={{
              ...submission,
              flow_answers: localAnswers,
              shareholders_data: localShareholders,
            }}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            disabled={disabled}
          />
        ) : (
          <ESQuestionRenderer
            step={currentStep}
            value={localAnswers[currentStep.key]}
            onChange={handleAnswerChange}
            attentionReason={submission.attention_reason}
            entityName={submission.entity_name}
            shareholdersData={localShareholders}
            onShareholdersChange={handleShareholdersChange}
            disabled={disabled}
            fieldComment={
              submission.field_comments?.[currentStep.key]
                ? String(submission.field_comments[currentStep.key])
                : undefined
            }
          />
        )}
      </Card>

      {/* Navigation */}
      {!isReviewStep && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={isFirstStep || disabled}
          >
            {t("es.flow.back")}
          </Button>
          <Button onClick={handleNext} disabled={!canAdvance}>
            {isLastStep ? t("es.flow.goToReview") : t("es.flow.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
