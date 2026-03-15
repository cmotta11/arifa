import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/overlay/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCreateDelegation } from "../api/delegation-api";

interface DelegationModalProps {
  entityId: string;
  open: boolean;
  onClose: () => void;
}

const MODULE_KEYS = [
  { value: "accounting_records", labelKey: "delegation.modules.accounting_records" },
  { value: "economic_substance", labelKey: "delegation.modules.economic_substance" },
  { value: "kyc", labelKey: "delegation.modules.kyc" },
] as const;

export function DelegationModal({ entityId, open, onClose }: DelegationModalProps) {
  const { t } = useTranslation();
  const createDelegation = useCreateDelegation();

  const [module, setModule] = useState("accounting_records");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
  const [delegateEmail, setDelegateEmail] = useState("");

  const handleSubmit = () => {
    createDelegation.mutate(
      {
        entity_id: entityId,
        module,
        fiscal_year: fiscalYear,
        delegate_email: delegateEmail,
      },
      {
        onSuccess: () => {
          setDelegateEmail("");
          onClose();
        },
      },
    );
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={t("delegation.createTitle")}>
      <div className="space-y-4">
        <Select
          label={t("delegation.module")}
          value={module}
          onChange={(e) => setModule(e.target.value)}
          options={MODULE_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        />

        <Input
          label={t("delegation.fiscalYear")}
          type="number"
          value={String(fiscalYear)}
          onChange={(e) => setFiscalYear(Number(e.target.value))}
        />

        <Input
          label={t("delegation.delegateEmail")}
          type="email"
          value={delegateEmail}
          onChange={(e) => setDelegateEmail(e.target.value)}
          placeholder="delegate@example.com"
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!delegateEmail || createDelegation.isPending}
          >
            {createDelegation.isPending
              ? t("common.saving")
              : t("delegation.delegate")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
