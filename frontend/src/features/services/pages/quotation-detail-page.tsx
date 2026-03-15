import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api-client";
import type { Quotation } from "@/types";
import {
  getQuotation,
  acceptQuotation,
  rejectQuotation,
} from "../api/services-api";

const statusColors: Record<string, "gray" | "blue" | "green" | "yellow" | "red"> = {
  draft: "gray",
  sent: "blue",
  accepted: "green",
  rejected: "red",
  expired: "yellow",
};

interface QuotationLineItem {
  service_name: string;
  quantity: number;
  unit_price: string;
  discount_amount: string;
  subtotal: string;
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const quotationQuery = useQuery({
    queryKey: ["services", "quotation", id],
    queryFn: () => getQuotation(id!),
    enabled: !!id,
  });

  // Fetch the associated service request to get line items
  const serviceRequestQuery = useQuery({
    queryKey: ["services", "request", quotationQuery.data?.service_request],
    queryFn: () =>
      api.get<{ items: QuotationLineItem[] }>(
        `/services/requests/${quotationQuery.data!.service_request}/`,
      ),
    enabled: !!quotationQuery.data?.service_request,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptQuotation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["services", "quotation", id],
      });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuotation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["services", "quotation", id],
      });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  const lineItems = serviceRequestQuery.data?.items ?? [];

  const lineItemColumns = useMemo(
    () => [
      {
        key: "service_name",
        header: t("services.quotation.serviceName"),
        render: (row: QuotationLineItem) => (
          <span className="font-medium text-gray-900">
            {row.service_name}
          </span>
        ),
      },
      {
        key: "quantity",
        header: t("services.quotation.qty"),
      },
      {
        key: "unit_price",
        header: t("services.quotation.unitPrice"),
        render: (row: QuotationLineItem) =>
          parseFloat(row.unit_price).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          }),
      },
      {
        key: "discount_amount",
        header: t("services.quotation.discount"),
        render: (row: QuotationLineItem) => {
          const val = parseFloat(row.discount_amount);
          return val > 0
            ? `-${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            : "\u2014";
        },
      },
      {
        key: "subtotal",
        header: t("services.quotation.subtotal"),
        render: (row: QuotationLineItem) => (
          <span className="font-medium">
            {parseFloat(row.subtotal).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
        ),
      },
    ],
    [t],
  );

  const handleDownloadPdf = async () => {
    if (!id) return;
    try {
      const blob = await api.blob(`/services/quotations/${id}/pdf/`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quotation-${quotation?.quotation_number ?? id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert(t("common.error"));
    }
  };

  if (quotationQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (quotationQuery.isError || !quotationQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const quotation: Quotation = quotationQuery.data;
  const isClient = user?.role === "client";
  const canRespond =
    isClient &&
    (quotation.status === "sent" || quotation.status === "draft");

  return (
    <div className="flex h-full flex-col p-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t("services.title"), href: ROUTES.SERVICE_REQUESTS },
          { label: t("services.quotation.title") },
          { label: quotation.quotation_number },
        ]}
        className="mb-4"
      />

      {/* Back + Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.SERVICE_REQUESTS)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {quotation.quotation_number}
              </h1>
              <Badge color={statusColors[quotation.status] ?? "gray"}>
                {t(`services.quotation.status.${quotation.status}`)}
              </Badge>
            </div>
            {quotation.valid_until && (
              <p className="mt-1 text-sm text-gray-500">
                {t("services.quotation.validUntil")}:{" "}
                {new Date(quotation.valid_until).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleDownloadPdf}>
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t("services.quotation.downloadPdf")}
          </Button>
          {canRespond && (
            <>
              <Button
                variant="primary"
                loading={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
              >
                <CheckIcon className="h-4 w-4" />
                {t("services.quotation.accept")}
              </Button>
              <Button
                variant="danger"
                loading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                <XMarkIcon className="h-4 w-4" />
                {t("services.quotation.reject")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dates info */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {t("services.quotation.created")}
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {new Date(quotation.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {t("services.quotation.currency")}
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {quotation.currency}
          </p>
        </div>
        {quotation.accepted_at && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("services.quotation.acceptedAt")}
            </p>
            <p className="mt-1 text-sm font-medium text-green-700">
              {new Date(quotation.accepted_at).toLocaleDateString()}
            </p>
          </div>
        )}
        {quotation.rejected_at && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("services.quotation.rejectedAt")}
            </p>
            <p className="mt-1 text-sm font-medium text-red-700">
              {new Date(quotation.rejected_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="mb-6 overflow-auto rounded-lg border border-gray-200 bg-white">
        <DataTable
          columns={lineItemColumns}
          data={lineItems}
          loading={serviceRequestQuery.isLoading}
          emptyMessage={t("services.quotation.noItems")}
          keyExtractor={(_: unknown, i: number) => String(i)}
        />
      </div>

      {/* Totals */}
      <div className="ml-auto w-80 rounded-lg border border-gray-200 bg-white p-5">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              {t("services.quotation.subtotalLabel")}
            </span>
            <span className="text-gray-900">
              {quotation.currency}{" "}
              {parseFloat(quotation.subtotal).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          {parseFloat(quotation.discount_total) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600">
                {t("services.quotation.discountLabel")}
              </span>
              <span className="text-green-600">
                -{quotation.currency}{" "}
                {parseFloat(quotation.discount_total).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          {parseFloat(quotation.tax_amount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {t("services.quotation.taxLabel")}
              </span>
              <span className="text-gray-900">
                {quotation.currency}{" "}
                {parseFloat(quotation.tax_amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-3 text-lg font-bold">
            <span className="text-gray-900">
              {t("services.quotation.totalLabel")}
            </span>
            <span className="text-gray-900">
              {quotation.currency}{" "}
              {parseFloat(quotation.total).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-2 text-sm font-medium text-gray-900">
            {t("services.quotation.notes")}
          </h3>
          <p className="text-sm text-gray-600">{quotation.notes}</p>
        </div>
      )}
    </div>
  );
}
