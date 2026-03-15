import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/overlay/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { recordPayment } from "../api/incorporation-api";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketTitle?: string;
}

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "PAB", label: "PAB" },
];

const PAYMENT_METHOD_KEYS = [
  { value: "wire_transfer", labelKey: "incorporation.payment.methods.wire_transfer" },
  { value: "check", labelKey: "incorporation.payment.methods.check" },
  { value: "credit_card", labelKey: "incorporation.payment.methods.credit_card" },
  { value: "cash", labelKey: "incorporation.payment.methods.cash" },
] as const;

export function PaymentModal({ isOpen, onClose, ticketId, ticketTitle }: PaymentModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] = useState("wire_transfer");
  const [receiptReference, setReceiptReference] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(ticketId, {
        amount,
        currency,
        payment_method: paymentMethod,
        receipt_reference: receiptReference,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inc-payments"] });
      queryClient.invalidateQueries({ queryKey: ["inc-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["inc-metrics"] });
      resetForm();
      onClose();
    },
    onError: () => {
      setError(t("incorporation.payment.error"));
    },
  });

  const resetForm = () => {
    setAmount("");
    setCurrency("USD");
    setPaymentMethod("wire_transfer");
    setReceiptReference("");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!amount || parseFloat(amount) <= 0) {
      setError(t("incorporation.payment.amountRequired"));
      return;
    }
    if (!receiptReference.trim()) {
      setError(t("incorporation.payment.referenceRequired"));
      return;
    }

    mutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("incorporation.payment.title")}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {ticketTitle && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {t("incorporation.payment.forTicket")}: <span className="font-medium">{ticketTitle}</span>
          </div>
        )}

        <Input
          label={t("incorporation.payment.amount")}
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <Select
          label={t("incorporation.payment.currency")}
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />

        <Select
          label={t("incorporation.payment.method")}
          options={PAYMENT_METHOD_KEYS.map((o) => ({
            value: o.value,
            label: t(o.labelKey),
          }))}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        />

        <Input
          label={t("incorporation.payment.receiptReference")}
          value={receiptReference}
          onChange={(e) => setReceiptReference(e.target.value)}
          placeholder={t("incorporation.payment.referencePlaceholder")}
        />

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {t("incorporation.payment.submit")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
