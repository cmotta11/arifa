import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { ROUTES } from "@/config/routes";
import { useClients, useCreateClient } from "../api/clients-api";
import type { Client } from "@/types";

const categoryColors: Record<string, "gray" | "yellow" | "blue"> = {
  silver: "gray",
  gold: "yellow",
  platinum: "blue",
};

const statusColors: Record<string, "green" | "gray"> = {
  active: "green",
  inactive: "gray",
};

const emptyForm = {
  name: "",
  client_type: "corporate",
  category: "silver",
  status: "active",
};

export default function ClientsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (search) f.search = search;
    if (typeFilter) f.client_type = typeFilter;
    if (categoryFilter) f.category = categoryFilter;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [search, typeFilter, categoryFilter, statusFilter]);

  const { data, isLoading } = useClients(filters);
  const createMutation = useCreateClient();

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMutation.mutate(form as Partial<Client>, {
      onSuccess: (newClient) => {
        setShowCreate(false);
        setForm(emptyForm);
        navigate(ROUTES.CLIENT_DETAIL.replace(":id", newClient.id));
      },
    });
  };

  const typeOptions = [
    { value: "", label: t("clients.filters.allTypes") },
    { value: "natural", label: t("clients.form.natural") },
    { value: "corporate", label: t("clients.form.corporate") },
  ];

  const categoryOptions = [
    { value: "", label: t("clients.filters.allCategories") },
    { value: "silver", label: t("clients.form.silver") },
    { value: "gold", label: t("clients.form.gold") },
    { value: "platinum", label: t("clients.form.platinum") },
  ];

  const statusOptions = [
    { value: "", label: t("clients.filters.allStatuses") },
    { value: "active", label: t("clients.form.active") },
    { value: "inactive", label: t("clients.form.inactive") },
  ];

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: t("clients.columns.name"),
        render: (row: Client) => (
          <span className="font-medium text-gray-900">{row.name}</span>
        ),
      },
      {
        key: "client_type",
        header: t("clients.columns.type"),
        render: (row: Client) => (
          <Badge color={row.client_type === "corporate" ? "blue" : "gray"}>
            {t(`clients.form.${row.client_type}`)}
          </Badge>
        ),
      },
      {
        key: "category",
        header: t("clients.columns.category"),
        render: (row: Client) => (
          <Badge color={categoryColors[row.category] ?? "gray"}>
            {t(`clients.form.${row.category}`)}
          </Badge>
        ),
      },
      {
        key: "status",
        header: t("clients.columns.status"),
        render: (row: Client) => (
          <Badge color={statusColors[row.status] ?? "gray"}>
            {t(`clients.form.${row.status}`)}
          </Badge>
        ),
      },
      {
        key: "created_at",
        header: t("clients.columns.created"),
        render: (row: Client) =>
          new Date(row.created_at).toLocaleDateString(),
      },
    ],
    [t],
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("clients.title")}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {t("clients.create")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder={t("clients.filters.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
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
          data={data?.results ?? []}
          loading={isLoading}
          emptyMessage={t("clients.noClients")}
          onRowClick={(row) => navigate(ROUTES.CLIENT_DETAIL.replace(":id", row.id as string))}
          keyExtractor={(row) => row.id as string}
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("clients.create")}
      >
        <div className="space-y-4">
          <Input
            label={t("clients.form.name")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            autoFocus
          />
          <Select
            label={t("clients.form.clientType")}
            value={form.client_type}
            onChange={(e) => setForm((p) => ({ ...p, client_type: e.target.value }))}
            options={[
              { value: "natural", label: t("clients.form.natural") },
              { value: "corporate", label: t("clients.form.corporate") },
            ]}
          />
          <Select
            label={t("clients.form.category")}
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            options={[
              { value: "silver", label: t("clients.form.silver") },
              { value: "gold", label: t("clients.form.gold") },
              { value: "platinum", label: t("clients.form.platinum") },
            ]}
          />
          <Select
            label={t("clients.form.status")}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            options={[
              { value: "active", label: t("clients.form.active") },
              { value: "inactive", label: t("clients.form.inactive") },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!form.name.trim()}
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
