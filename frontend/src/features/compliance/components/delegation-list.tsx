import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useDelegations,
  useRevokeDelegation,
  useAcceptDelegation,
} from "../api/delegation-api";
import type { ComplianceDelegation } from "../api/delegation-api";

const statusColors: Record<string, "green" | "yellow" | "red" | "gray"> = {
  accepted: "green",
  pending: "yellow",
  revoked: "red",
};

interface DelegationListProps {
  entityId: string;
  showActions?: boolean;
  currentUserEmail?: string;
}

export function DelegationList({ entityId, showActions = true, currentUserEmail }: DelegationListProps) {
  const { t } = useTranslation();
  const { data: delegations, isLoading } = useDelegations({ entity: entityId });
  const revokeDelegation = useRevokeDelegation();
  const acceptDelegation = useAcceptDelegation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (!delegations?.length) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        {t("delegation.empty")}
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {delegations.map((d: ComplianceDelegation) => (
        <div key={d.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {d.delegate_email}
            </p>
            <p className="text-xs text-gray-500">
              {d.module_display} &middot; FY{d.fiscal_year} &middot;{" "}
              {t("delegation.by")} {d.delegated_by_email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={statusColors[d.status] || "gray"}>
              {d.status_display}
            </Badge>
            {showActions && d.status === "pending" && (
              <>
                {currentUserEmail?.toLowerCase() === d.delegate_email.toLowerCase() && (
                  <Button
                    size="sm"
                    onClick={() => acceptDelegation.mutate(d.id)}
                    disabled={acceptDelegation.isPending}
                  >
                    {t("delegation.accept")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => revokeDelegation.mutate(d.id)}
                  disabled={revokeDelegation.isPending}
                >
                  {t("delegation.revoke")}
                </Button>
              </>
            )}
            {showActions && d.status === "accepted" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => revokeDelegation.mutate(d.id)}
                disabled={revokeDelegation.isPending}
              >
                {t("delegation.revoke")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
