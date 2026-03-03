import { useTranslation } from "react-i18next";
import type { RiskLevel } from "@/types";

const riskColors: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  ultra_high: "bg-red-100 text-red-700",
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className = "" }: RiskBadgeProps) {
  const { t } = useTranslation();

  const labels: Record<RiskLevel, string> = {
    low: t("riskLevels.low"),
    medium: t("riskLevels.medium"),
    high: t("riskLevels.high"),
    ultra_high: t("riskLevels.ultraHigh"),
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${riskColors[level]} ${className}`}
    >
      {labels[level]}
    </span>
  );
}
