import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, icon, className = "" }: StatCardProps) {
  return (
    <Card className={`flex items-start gap-4 ${className}`}>
      {icon && (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}
