import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  PlusIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/overlay/modal";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import type { ExpenseRecord } from "@/types";
import {
  getExpenses,
  recordExpense,
  markExpensePaid,
} from "../api/services-api";

const paymentStatusColors: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  pending: "yellow",
  partial: "blue",
  paid: "green",
  refunded: "red",
};

const EXPENSE_CATEGORIES = [
  "government_fees",
  "notary_fees",
  "courier",
  "translations",
  "legal_fees",
  "disbursements",
  "other",
];

export default function ExpenseTrackerPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState<string | null>(null);

  // Form state
  const [formCategory, setFormCategory] = useState("other");
  const [formDescription, setFormDescription] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");

  // Mark-paid form state
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  // Build params for query
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (categoryFilter) params.category = categoryFilter;
    if (statusFilter) params.payment_status = statusFilter;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [categoryFilter, statusFilter]);

  const expensesQuery = useQuery({
    queryKey: ["services", "expenses", categoryFilter, statusFilter],
    queryFn: () => getExpenses(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: recordExpense,
    onSuccess: () => {
      setShowCreateModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["services", "expenses"] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { payment_method?: string; payment_reference?: string } }) =>
      markExpensePaid(id, data),
    onSuccess: () => {
      setShowPaidModal(null);
      setPaymentMethod("");
      setPaymentReference("");
      queryClient.invalidateQueries({ queryKey: ["services", "expenses"] });
    },
  });

  function resetForm() {
    setFormCategory("other");
    setFormDescription("");
    setFormAmount("");
    setFormCurrency("USD");
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      category: formCategory,
      description: formDescription,
      amount: formAmount,
      currency: formCurrency,
    });
  }

  function handleMarkPaidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showPaidModal) return;
    markPaidMutation.mutate({
      id: showPaidModal,
      data: {
        payment_method: paymentMethod || undefined,
        payment_reference: paymentReference || undefined,
      },
    });
  }

  // Filter options
  const categoryOptions = [
    { value: "", label: t("services.expenses.allCategories") },
    ...EXPENSE_CATEGORIES.map((c) => ({
      value: c,
      label: t(`services.expenses.categories.${c}`),
    })),
  ];

  const statusOptions = [
    { value: "", label: t("services.expenses.allStatuses") },
    { value: "pending", label: t("services.expenses.paymentStatus.pending") },
    { value: "partial", label: t("services.expenses.paymentStatus.partial") },
    { value: "paid", label: t("services.expenses.paymentStatus.paid") },
    { value: "refunded", label: t("services.expenses.paymentStatus.refunded") },
  ];

  const currencyOptions = [
    { value: "USD", label: "USD" },
    { value: "PAB", label: "PAB" },
  ];

  const categoryFormOptions = EXPENSE_CATEGORIES.map((c) => ({
    value: c,
    label: t(`services.expenses.categories.${c}`),
  }));

  // Table columns
  const columns = useMemo(
    () => [
      {
        key: "description",
        header: t("services.expenses.columns.description"),
        render: (row: ExpenseRecord) => (
          <span className="font-medium text-gray-900">{row.description}</span>
        ),
      },
      {
        key: "category",
        header: t("services.expenses.columns.category"),
        render: (row: ExpenseRecord) => (
          <Badge color="blue">
            {t(`services.expenses.categories.${row.category}`, { defaultValue: row.category })}
          </Badge>
        ),
      },
      {
        key: "amount",
        header: t("services.expenses.columns.amount"),
        render: (row: ExpenseRecord) => (
          <span className="font-medium">
            {row.currency}{" "}
            {parseFloat(row.amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "payment_status",
        header: t("services.expenses.columns.status"),
        render: (row: ExpenseRecord) => (
          <Badge color={paymentStatusColors[row.payment_status] ?? "gray"}>
            {t(`services.expenses.paymentStatus.${row.payment_status}`)}
          </Badge>
        ),
      },
      {
        key: "paid_at",
        header: t("services.expenses.columns.paidAt"),
        render: (row: ExpenseRecord) =>
          row.paid_at
            ? new Date(row.paid_at).toLocaleDateString()
            : "\u2014",
      },
      {
        key: "actions",
        header: t("common.actions"),
        render: (row: ExpenseRecord) =>
          row.payment_status === "pending" || row.payment_status === "partial" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowPaidModal(row.id);
              }}
            >
              <CheckCircleIcon className="h-4 w-4" />
              {t("services.expenses.markPaid")}
            </Button>
          ) : null,
      },
    ],
    [t],
  );

  if (expensesQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t("services.title"), href: ROUTES.SERVICE_REQUESTS },
          { label: t("services.expenses.title") },
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("services.expenses.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("services.expenses.description")}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusIcon className="h-4 w-4" />
          {t("services.expenses.record")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select
            label={t("services.expenses.columns.category")}
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label={t("services.expenses.columns.status")}
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={expensesQuery.data ?? []}
          loading={expensesQuery.isLoading}
          emptyMessage={t("services.expenses.noExpenses")}
          keyExtractor={(row) => row.id}
        />
      </div>

      {/* Create Expense Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={t("services.expenses.record")}
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Select
            label={t("services.expenses.columns.category")}
            options={categoryFormOptions}
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
          />
          <Textarea
            label={t("services.expenses.columns.description")}
            placeholder={t("services.expenses.descriptionPlaceholder")}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            required
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label={t("services.expenses.columns.amount")}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                required
              />
            </div>
            <div className="w-28">
              <Select
                label={t("services.expenses.currencyLabel")}
                options={currencyOptions}
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending}
            >
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal
        isOpen={!!showPaidModal}
        onClose={() => {
          setShowPaidModal(null);
          setPaymentMethod("");
          setPaymentReference("");
        }}
        title={t("services.expenses.markPaid")}
        size="sm"
      >
        <form onSubmit={handleMarkPaidSubmit} className="space-y-4">
          <Input
            label={t("services.expenses.paymentMethodLabel")}
            placeholder={t("services.expenses.paymentMethodPlaceholder")}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          <Input
            label={t("services.expenses.paymentReferenceLabel")}
            placeholder={t("services.expenses.paymentReferencePlaceholder")}
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowPaidModal(null);
                setPaymentMethod("");
                setPaymentReference("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={markPaidMutation.isPending}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
