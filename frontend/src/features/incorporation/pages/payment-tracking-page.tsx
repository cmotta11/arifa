import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-display/data-table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getPaymentRecords,
  getIncTickets,
  approvePayment,
  type PaymentRecord,
} from "../api/incorporation-api";
import { PaymentModal } from "../components/payment-modal";

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
];

export default function PaymentTrackingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState("");

  const paymentsQuery = useQuery({
    queryKey: ["inc-payments", statusFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter === "pending") params.approved = "false";
      if (statusFilter === "approved") params.approved = "true";
      return getPaymentRecords(params);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (paymentId: string) => approvePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inc-payments"] });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  const payments = paymentsQuery.data ?? [];

  const isDirector = user?.role === "director";

  // Fetch tickets for the ticket selector
  const ticketsQuery = useQuery({
    queryKey: ["inc-tickets-for-payments"],
    queryFn: () => getIncTickets(),
  });
  const ticketOptions = useMemo(() => {
    const tickets = ticketsQuery.data ?? [];
    return tickets.map((t) => ({
      value: t.id,
      label: t.title || t.id.slice(0, 8),
    }));
  }, [ticketsQuery.data]);

  const columns = useMemo(
    () => [
      {
        key: "ticket_title",
        header: t("incorporation.payments.columns.ticket"),
        render: (row: PaymentRecord) => (
          <span className="font-medium text-gray-900">
            {row.ticket_title || row.ticket.slice(0, 8)}
          </span>
        ),
      },
      {
        key: "amount",
        header: t("incorporation.payments.columns.amount"),
        render: (row: PaymentRecord) => (
          <span className="font-medium">
            {row.currency} {parseFloat(row.amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "payment_method",
        header: t("incorporation.payments.columns.method"),
        render: (row: PaymentRecord) =>
          t(`incorporation.payment.methods.${row.payment_method}`, row.payment_method),
      },
      {
        key: "receipt_reference",
        header: t("incorporation.payments.columns.reference"),
        render: (row: PaymentRecord) => (
          <span className="text-gray-600">{row.receipt_reference}</span>
        ),
      },
      {
        key: "recorded_by",
        header: t("incorporation.payments.columns.recordedBy"),
        render: (row: PaymentRecord) => row.recorded_by_email || row.recorded_by,
      },
      {
        key: "recorded_at",
        header: t("incorporation.payments.columns.date"),
        render: (row: PaymentRecord) =>
          new Date(row.recorded_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
      },
      {
        key: "approved",
        header: t("incorporation.payments.columns.status"),
        render: (row: PaymentRecord) =>
          row.approved ? (
            <Badge color="green">{t("incorporation.payments.approved")}</Badge>
          ) : (
            <Badge color="yellow">{t("incorporation.payments.pendingApproval")}</Badge>
          ),
      },
      {
        key: "actions",
        header: t("common.actions"),
        render: (row: PaymentRecord) =>
          !row.approved && isDirector ? (
            <Button
              variant="ghost"
              size="sm"
              loading={approveMutation.isPending && approveMutation.variables === row.id}
              onClick={(e) => {
                e.stopPropagation();
                approveMutation.mutate(row.id);
              }}
            >
              {t("incorporation.payments.approve")}
            </Button>
          ) : null,
      },
    ],
    [t, isDirector, approveMutation],
  );

  if (paymentsQuery.isLoading && !paymentsQuery.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("incorporation.payments.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("incorporation.payments.description")}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-64">
            <SearchableSelect
              label={t("incorporation.payments.columns.ticket")}
              options={ticketOptions}
              value={selectedTicketId}
              onChange={setSelectedTicketId}
              placeholder={t("tickets.form.selectClient")}
            />
          </div>
          <Button
            variant="primary"
            disabled={!selectedTicketId}
            onClick={() => setShowPaymentModal(true)}
          >
            {t("incorporation.payments.recordPayment")}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="w-48">
          <Select
            options={PAYMENT_STATUS_OPTIONS.map((o) => ({
              value: o.value,
              label: o.value
                ? t(`incorporation.payments.filter.${o.value}`, o.label)
                : t("incorporation.payments.filter.allStatuses"),
            }))}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("incorporation.payments.records")} ({payments.length})
          </CardTitle>
        </CardHeader>
        <DataTable
          columns={columns}
          data={payments}
          loading={paymentsQuery.isLoading}
          emptyMessage={t("incorporation.payments.noPayments")}
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        ticketId={selectedTicketId}
      />
    </div>
  );
}
