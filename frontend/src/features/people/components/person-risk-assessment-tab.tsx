import { useTranslation } from "react-i18next";
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  usePersonRiskAssessment,
  usePersonRiskHistory,
  useCalculatePersonRisk,
  useExportRiskPDF,
} from "@/features/compliance/api/risk-matrix-api";
import {
  ScoreGauge,
  TriggeredRulesBox,
  BreakdownTable,
  RiskHistoryTimeline,
} from "@/features/compliance/components/risk-display";

interface PersonRiskAssessmentTabProps {
  personId: string;
}

export function PersonRiskAssessmentTab({ personId }: PersonRiskAssessmentTabProps) {
  const { t } = useTranslation();
  const riskQuery = usePersonRiskAssessment(personId);
  const historyQuery = usePersonRiskHistory(personId);
  const calculateMutation = useCalculatePersonRisk();
  const exportMutation = useExportRiskPDF();

  const assessment = riskQuery.data;
  const history = historyQuery.data?.results ?? [];

  const handleCalculate = () => {
    calculateMutation.mutate(personId);
  };

  const handleExportPDF = (assessmentId: string) => {
    exportMutation.mutate(assessmentId, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `risk-assessment-${assessmentId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  if (riskQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleCalculate}
          loading={calculateMutation.isPending}
          size="sm"
        >
          <ArrowPathIcon className="mr-1 h-4 w-4" />
          {t("riskMatrix.recalculate")}
        </Button>
        {assessment && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExportPDF(assessment.id)}
            loading={exportMutation.isPending}
          >
            <ArrowDownTrayIcon className="mr-1 h-4 w-4" />
            {t("riskMatrix.exportPDF")}
          </Button>
        )}
      </div>

      {/* Current Assessment */}
      {assessment ? (
        <Card>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                {t("riskMatrix.currentAssessment")}
              </h3>
              <ScoreGauge assessment={assessment} />
              <p className="mt-2 text-xs text-gray-500">
                {t("riskMatrix.assessedAt")}: {new Date(assessment.assessed_at).toLocaleString()}
                {" | "}
                {t("riskMatrix.trigger")}: {assessment.trigger}
              </p>
            </div>

            <TriggeredRulesBox rules={assessment.triggered_rules} />
            <BreakdownTable breakdown={assessment.breakdown_json} />
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-500">{t("riskMatrix.noAssessment")}</p>
          <p className="mt-1 text-sm text-gray-400">
            {t("riskMatrix.noAssessmentHint")}
          </p>
        </Card>
      )}

      {/* History */}
      <Card>
        <RiskHistoryTimeline
          history={history}
          onExportPDF={handleExportPDF}
          exporting={exportMutation.isPending}
        />
      </Card>
    </div>
  );
}
