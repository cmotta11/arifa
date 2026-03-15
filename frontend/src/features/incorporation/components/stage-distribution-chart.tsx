import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface StageDistributionProps {
  data: Record<string, number>;
}

const STAGE_COLORS: Record<string, string> = {
  INTAKE: "#6366F1",
  KYC_REVIEW: "#8B5CF6",
  PAYMENT: "#F59E0B",
  DOC_PROCESSING: "#3B82F6",
  NOTARY: "#10B981",
  REGISTRY: "#14B8A6",
  COMPLETED: "#22C55E",
  CANCELLED: "#EF4444",
};

function getStageColor(stage: string, index: number): string {
  const fallbackColors = [
    "#6366F1", "#8B5CF6", "#F59E0B", "#3B82F6",
    "#10B981", "#14B8A6", "#22C55E", "#EF4444",
    "#EC4899", "#F97316",
  ];
  return STAGE_COLORS[stage] || fallbackColors[index % fallbackColors.length];
}

export function StageDistributionChart({ data }: StageDistributionProps) {
  const { t } = useTranslation();

  const { entries, maxCount, total } = useMemo(() => {
    const entries = Object.entries(data).filter(([, count]) => count > 0);
    const maxCount = Math.max(...entries.map(([, count]) => count), 1);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return { entries, maxCount, total };
  }, [data]);

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        {t("incorporation.chart.noData")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([stage, count], index) => {
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const color = getStageColor(stage, index);
        const sharePercent = total > 0 ? ((count / total) * 100).toFixed(1) : "0";

        return (
          <div key={stage} className="group">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{stage}</span>
              <span className="text-gray-500">
                {count} ({sharePercent}%)
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="flex h-full items-center rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(percentage, 2)}%`,
                  backgroundColor: color,
                }}
              >
                {percentage > 15 && (
                  <span className="ml-2 text-xs font-medium text-white">{count}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
