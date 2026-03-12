import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  pending: "gray",
  draft: "yellow",
  submitted: "blue",
  approved: "green",
  rejected: "red",
};

export function AccountingStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const color = statusColors[status] ?? "gray";
  return <Badge color={color}>{t(`registrosContables.status.${status}`)}</Badge>;
}
