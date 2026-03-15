import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EconomicSubstanceSubmission } from "../api/es-api";
import { getESFlowSteps } from "./es-flow-form";
import type { FlowStepConfig } from "./es-question-renderer";

interface ESReviewSubmitProps {
  submission: EconomicSubstanceSubmission;
  onSubmit: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function ESReviewSubmit({
  submission,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}: ESReviewSubmitProps) {
  const { t } = useTranslation();
  const ES_FLOW_STEPS = getESFlowSteps(t);
  const [agreed, setAgreed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(ES_FLOW_STEPS.map((s) => s.key)),
  );

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const answers = submission.flow_answers ?? {};

  const renderAnswerValue = (step: FlowStepConfig) => {
    const val = answers[step.key];

    if (step.type === "terminal") return null;

    if (step.type === "yes_no") {
      if (val === true) return <Badge color="green">{t("es.flow.yes")}</Badge>;
      if (val === false) return <Badge color="red">{t("es.flow.no")}</Badge>;
      return <span className="text-gray-400">--</span>;
    }

    if (step.type === "multi_select") {
      const selected = (val as string[]) ?? [];
      if (selected.length === 0) {
        return <span className="text-gray-400">--</span>;
      }
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
      return val ? (
        <Badge color="blue">{String(val)}</Badge>
      ) : (
        <span className="text-gray-400">--</span>
      );
    }

    if (step.type === "shareholders_list") {
      const shareholders = submission.shareholders_data ?? [];
      if (shareholders.length === 0) {
        return <span className="text-gray-400">--</span>;
      }
      {/* ACCEPTED EXCEPTION: small summary table for shareholders — DataTable is overkill for a compact 3-column summary display */}
      return (
        <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
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

    return val != null ? (
      <span className="text-sm text-gray-700">{String(val)}</span>
    ) : (
      <span className="text-gray-400">--</span>
    );
  };

  // Filter out terminal steps from review
  const reviewSteps = ES_FLOW_STEPS.filter((s) => s.type !== "terminal");

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {t("es.review.title")}
      </h3>
      <p className="text-sm text-gray-500">{t("es.review.description")}</p>

      {/* Collapsible sections for each answered step */}
      {reviewSteps.map((step) => {
        const isExpanded = expandedSections.has(step.key);
        const comment = submission.field_comments?.[step.key];

        return (
          <Card key={step.key} className="p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(step.key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                {step.label}
              </span>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-3">
                {comment && (
                  <div className="mb-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                    <span className="font-medium">{t("es.review.comment")}:</span>{" "}
                    {String(comment)}
                  </div>
                )}
                {renderAnswerValue(step)}
              </div>
            )}
          </Card>
        );
      })}

      {/* Declaration */}
      <Card>
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">
              {t("es.review.declaration")}
            </span>
          </label>

          <Button
            onClick={onSubmit}
            disabled={!agreed || disabled}
            loading={isSubmitting}
            className="w-full"
          >
            {t("es.review.submit")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
