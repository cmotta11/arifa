import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  PlusIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import { useClients } from "@/features/clients/api/clients-api";
import type { ServiceCatalog, ServiceRequest, ServiceRequestItem } from "@/types";
import {
  getServiceCatalog,
  getServiceRequests,
  createServiceRequest,
  addServiceItem,
  removeServiceItem,
  submitServiceRequest,
} from "../api/services-api";

const statusColors: Record<string, "gray" | "blue" | "green" | "yellow" | "red"> = {
  draft: "gray",
  pending_quotation: "blue",
  quoted: "blue",
  accepted: "green",
  rejected: "red",
  in_progress: "yellow",
  completed: "green",
  cancelled: "red",
};

export default function ServiceRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [jurisdictionFilter, setJurisdictionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");

  // Fetch clients for the client selector
  const clientsQuery = useClients();
  const clientOptions = useMemo(() => {
    const results = clientsQuery.data?.results ?? [];
    return results.map((c) => ({ value: c.id, label: c.name }));
  }, [clientsQuery.data]);

  // Fetch catalog
  const catalogQuery = useQuery({
    queryKey: ["services", "catalog", jurisdictionFilter],
    queryFn: () =>
      getServiceCatalog(
        jurisdictionFilter ? { jurisdiction: jurisdictionFilter } : undefined,
      ),
  });

  // Fetch existing requests
  const requestsQuery = useQuery({
    queryKey: ["services", "requests"],
    queryFn: () => getServiceRequests(),
  });

  // Active request detail (when editing a draft)
  const activeRequest = useMemo(() => {
    if (!activeRequestId || !requestsQuery.data) return null;
    return requestsQuery.data.find((r) => r.id === activeRequestId) ?? null;
  }, [activeRequestId, requestsQuery.data]);

  // Create a new service request
  const createMutation = useMutation({
    mutationFn: createServiceRequest,
    onSuccess: (data) => {
      setActiveRequestId(data.id);
      queryClient.invalidateQueries({ queryKey: ["services", "requests"] });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  // Add item to request
  const addItemMutation = useMutation({
    mutationFn: ({ serviceId }: { serviceId: string }) => {
      if (!activeRequestId) throw new Error("No active request");
      return addServiceItem(activeRequestId, { service_id: serviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", "requests"] });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  // Remove item from request
  const removeItemMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => {
      if (!activeRequestId) throw new Error("No active request");
      return removeServiceItem(activeRequestId, itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", "requests"] });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  // Submit request
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!activeRequestId) throw new Error("No active request");
      return submitServiceRequest(activeRequestId);
    },
    onSuccess: () => {
      setActiveRequestId(null);
      queryClient.invalidateQueries({ queryKey: ["services", "requests"] });
    },
    onError: () => {
      window.alert(t("common.error"));
    },
  });

  // Filter catalog
  const filteredCatalog = useMemo(() => {
    if (!catalogQuery.data) return [];
    let items = catalogQuery.data.filter((s) => s.is_active);
    if (categoryFilter) {
      items = items.filter((s) => s.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    }
    return items;
  }, [catalogQuery.data, categoryFilter, searchQuery]);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!catalogQuery.data) return [];
    const cats = new Set(catalogQuery.data.map((s) => s.category));
    return Array.from(cats).sort();
  }, [catalogQuery.data]);

  // Jurisdiction options
  const jurisdictionOptions = [
    { value: "", label: t("services.allJurisdictions") },
    { value: "panama", label: t("services.jurisdictions.panama") },
    { value: "bvi", label: t("services.jurisdictions.bvi") },
    { value: "belize", label: t("services.jurisdictions.belize") },
  ];

  // Category options
  const categoryOptions = [
    { value: "", label: t("services.allCategories") },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  // Calculate cart totals
  const cartItems = activeRequest?.items ?? [];
  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.subtotal || "0"),
    0,
  );
  const cartDiscount = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.discount_amount || "0"),
    0,
  );
  const cartTotal = cartSubtotal - cartDiscount;

  // Catalog table columns
  const catalogColumns = useMemo(
    () => [
      {
        key: "name",
        header: t("services.columns.name"),
        render: (row: ServiceCatalog) => (
          <div>
            <span className="font-medium text-gray-900">{row.name}</span>
            <p className="text-xs text-gray-500">{row.code}</p>
          </div>
        ),
      },
      {
        key: "category",
        header: t("services.columns.category"),
        render: (row: ServiceCatalog) => (
          <Badge color="blue">{row.category}</Badge>
        ),
      },
      {
        key: "base_price",
        header: t("services.columns.basePrice"),
        render: (row: ServiceCatalog) => (
          <span className="font-medium">
            {row.currency} {parseFloat(row.base_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        ),
      },
      {
        key: "estimated_days",
        header: t("services.columns.estimatedDays"),
        render: (row: ServiceCatalog) =>
          row.estimated_days ? `${row.estimated_days} ${t("services.days")}` : "\u2014",
      },
      {
        key: "actions",
        header: t("common.actions"),
        render: (row: ServiceCatalog) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={!activeRequestId || addItemMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              addItemMutation.mutate({ serviceId: row.id });
            }}
          >
            <PlusIcon className="h-4 w-4" />
            {t("services.addToRequest")}
          </Button>
        ),
      },
    ],
    [t, activeRequestId, addItemMutation],
  );

  // Request list columns
  const requestColumns = useMemo(
    () => [
      {
        key: "client_name",
        header: t("services.columns.client"),
        render: (row: ServiceRequest) => (
          <span className="font-medium text-gray-900">
            {row.client_name}
          </span>
        ),
      },
      {
        key: "status",
        header: t("services.columns.status"),
        render: (row: ServiceRequest) => (
          <Badge color={statusColors[row.status] ?? "gray"}>
            {t(`services.status.${row.status}`)}
          </Badge>
        ),
      },
      {
        key: "items",
        header: t("services.columns.items"),
        render: (row: ServiceRequest) => (
          <span>{row.items.length} {t("services.items")}</span>
        ),
      },
      {
        key: "created_at",
        header: t("services.columns.created"),
        render: (row: ServiceRequest) =>
          new Date(row.created_at).toLocaleDateString(),
      },
    ],
    [t],
  );

  if (catalogQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <Breadcrumbs
        items={[
          { label: t("services.title"), href: ROUTES.SERVICE_REQUESTS },
        ]}
        className="mb-4"
      />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("services.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("services.description")}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-64">
            <SearchableSelect
              label={t("tickets.client")}
              options={clientOptions}
              value={selectedClientId}
              onChange={setSelectedClientId}
              placeholder={t("tickets.form.selectClient")}
            />
          </div>
          <Button
            variant="primary"
            loading={createMutation.isPending}
            disabled={!selectedClientId}
            onClick={() =>
              createMutation.mutate({ client_id: selectedClientId })
            }
          >
            {t("services.newRequest")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left: Catalog + Requests */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Select
                label={t("services.jurisdiction")}
                options={jurisdictionOptions}
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                label={t("services.category")}
                options={categoryOptions}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Input
                label={t("common.search")}
                placeholder={t("services.searchCatalog")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Service Catalog */}
          <div className="mb-6 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={catalogColumns}
              data={filteredCatalog}
              loading={catalogQuery.isLoading}
              emptyMessage={t("services.noCatalogItems")}
              keyExtractor={(row) => row.id}
              stickyHeader
            />
          </div>

          {/* Existing Requests */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              {t("services.existingRequests")}
            </h2>
            <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
              <DataTable
                columns={requestColumns}
                data={requestsQuery.data ?? []}
                loading={requestsQuery.isLoading}
                emptyMessage={t("services.noRequests")}
                keyExtractor={(row) => row.id}
                onRowClick={(row) => {
                  if (row.status === "draft") {
                    setActiveRequestId(row.id);
                  } else {
                    navigate(
                      ROUTES.SERVICE_REQUEST_DETAIL.replace(":id", row.id),
                    );
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: Cart / Selected Services */}
        <div className="w-96 shrink-0 overflow-auto rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("services.cart.title")}
          </h2>

          {!activeRequestId ? (
            <p className="text-sm text-gray-500">
              {t("services.cart.empty")}
            </p>
          ) : (
            <>
              {cartItems.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {t("services.cart.noItems")}
                </p>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item: ServiceRequestItem) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-md border border-gray-100 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {item.service_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t("services.cart.qty")}: {item.quantity} &times;{" "}
                          {parseFloat(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        {parseFloat(item.discount_amount) > 0 && (
                          <p className="text-xs text-green-600">
                            -{parseFloat(item.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {t("services.cart.discount")}
                          </p>
                        )}
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {parseFloat(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() =>
                            removeItemMutation.mutate({ itemId: item.id })
                          }
                          disabled={removeItemMutation.isPending}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("services.cart.subtotal")}</span>
                  <span className="text-gray-900">
                    {cartSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {cartDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">{t("services.cart.discount")}</span>
                    <span className="text-green-600">
                      -{cartDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
                  <span className="text-gray-900">{t("services.cart.total")}</span>
                  <span className="text-gray-900">
                    {cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <div className="mt-4">
                <Button
                  variant="primary"
                  className="w-full"
                  loading={submitMutation.isPending}
                  disabled={cartItems.length === 0}
                  onClick={() => submitMutation.mutate()}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {t("services.submitRequest")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
