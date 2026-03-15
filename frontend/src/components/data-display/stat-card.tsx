import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/layout/card";

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, trend, icon, className = "" }: StatCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        {icon && (
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {trend.direction === "up" ? (
            <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowTrendingDownIcon className="h-4 w-4 text-red-600" />
          )}
          <span
            className={`text-sm font-medium ${
              trend.direction === "up" ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend.value}%
          </span>
        </div>
      )}
    </Card>
  );
}
