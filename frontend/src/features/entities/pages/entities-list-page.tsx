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
import { useEntities, useCreateEntity } from "../api/entities-api";
import { useClients } from "@/features/clients/api/clients-api";
import type { Entity } from "@/types";

const jurisdictionColors: Record<string, "blue" | "green" | "yellow"> = {
  bvi: "blue",
  panama: "green",
  belize: "yellow",
};

const statusColors: Record<string, "green" | "yellow" | "gray" | "red"> = {
  active: "green",
  pending: "yellow",
  dissolved: "gray",
  struck_off: "red",
};

const emptyForm = {
  name: "",
  jurisdiction: "bvi",
  client_id: "",
  status: "pending",
  incorporation_date: "",
};

export default function EntitiesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (search) f.search = search;
    if (jurisdictionFilter) f.jurisdiction = jurisdictionFilter;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [search, jurisdictionFilter, statusFilter]);

  const { data, isLoading } = useEntities(filters);
  const createMutation = useCreateEntity();
  const clientsQuery = useClients();

  const clientOptions = useMemo(() => {
    const clients = clientsQuery.data?.results ?? [];
    return clients.map((c) => ({ value: c.id, label: c.name }));
  }, [clientsQuery.data]);

  const handleCreate = () => {
    if (!form.name.trim() || !form.client_id) return;
    const payload: Record<string, unknown> = {
      name: form.name,
      jurisdiction: form.jurisdiction,
      client_id: form.client_id,
      status: form.status,
    };
    if (form.incorporation_date) {
      payload.incorporation_date = form.incorporation_date;
    }
    createMutation.mutate(payload, {
      onSuccess: (newEntity) => {
        setShowCreate(false);
        setForm(emptyForm);
        navigate(ROUTES.ENTITY_DETAIL.replace(":id", newEntity.id));
      },
    });
  };

  const jurisdictionOptions = [
    { value: "", label: t("entities.filters.allJurisdictions") },
    { value: "bvi", label: t("entities.form.bvi") },
    { value: "panama", label: t("entities.form.panama") },
    { value: "belize", label: t("entities.form.belize") },
  ];

  const statusOptions = [
    { value: "", label: t("entities.filters.allStatuses") },
    { value: "pending", label: t("entities.form.pending") },
    { value: "active", label: t("entities.form.active") },
    { value: "dissolved", label: t("entities.form.dissolved") },
    { value: "struck_off", label: t("entities.form.struckOff") },
  ];

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: t("entities.columns.name"),
        render: (row: Entity) => (
          <span className="font-medium text-gray-900">{row.name}</span>
        ),
      },
      {
        key: "jurisdiction",
        header: t("entities.columns.jurisdiction"),
        render: (row: Entity) => (
          <Badge color={jurisdictionColors[row.jurisdiction] ?? "gray"}>
            {row.jurisdiction.toUpperCase()}
          </Badge>
        ),
      },
      {
        key: "client",
        header: t("entities.columns.client"),
        render: (row: Entity) => row.client?.name ?? "—",
      },
      {
        key: "status",
        header: t("entities.columns.status"),
        render: (row: Entity) => (
          <Badge color={statusColors[row.status] ?? "gray"}>
            {row.status}
          </Badge>
        ),
      },
      {
        key: "incorporation_date",
        header: t("entities.columns.incorporationDate"),
        render: (row: Entity) =>
          row.incorporation_date
            ? new Date(row.incorporation_date).toLocaleDateString()
            : "—",
      },
    ],
    [t],
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("entities.title")}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {t("entities.create")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder={t("entities.filters.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={jurisdictionOptions}
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
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
          data={(data?.results ?? []) as (Entity & Record<string, unknown>)[]}
          loading={isLoading}
          emptyMessage={t("entities.noEntities")}
          onRowClick={(row) => navigate(ROUTES.ENTITY_DETAIL.replace(":id", row.id as string))}
          keyExtractor={(row) => row.id as string}
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("entities.create")}
      >
        <div className="space-y-4">
          <Input
            label={t("entities.form.name")}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            autoFocus
          />
          <Select
            label={t("entities.form.jurisdiction")}
            value={form.jurisdiction}
            onChange={(e) => setForm((p) => ({ ...p, jurisdiction: e.target.value }))}
            options={[
              { value: "bvi", label: t("entities.form.bvi") },
              { value: "panama", label: t("entities.form.panama") },
              { value: "belize", label: t("entities.form.belize") },
            ]}
          />
          <Select
            label={t("entities.form.client")}
            value={form.client_id}
            onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
            options={clientOptions}
            placeholder={t("entities.form.client")}
          />
          <Input
            label={t("entities.form.incorporationDate")}
            type="date"
            value={form.incorporation_date}
            onChange={(e) => setForm((p) => ({ ...p, incorporation_date: e.target.value }))}
          />
          <Select
            label={t("entities.form.status")}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            options={[
              { value: "pending", label: t("entities.form.pending") },
              { value: "active", label: t("entities.form.active") },
              { value: "dissolved", label: t("entities.form.dissolved") },
              { value: "struck_off", label: t("entities.form.struckOff") },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!form.name.trim() || !form.client_id}
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
