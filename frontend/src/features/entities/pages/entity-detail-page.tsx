import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import {
  useEntity,
  useUpdateEntity,
  useEntityMatters,
  useEntityTickets,
} from "../api/entities-api";
import { AccessLinksTab } from "../components/access-links-tab";
import { AuditTab } from "../components/audit-tab";
import { CorporateStructureTab } from "../components/corporate-structure-tab";
import { RiskProfileTab } from "../components/risk-profile-tab";
import type { Matter, Ticket } from "@/types";

type Tab = "overview" | "corporateStructure" | "riskProfile" | "matters" | "tickets" | "accessLinks" | "audit";

const tabs: Tab[] = ["overview", "corporateStructure", "riskProfile", "matters", "tickets", "accessLinks", "audit"];

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

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: entity, isLoading } = useEntity(id!);
  const updateMutation = useUpdateEntity();
  const mattersQuery = useEntityMatters(id!);
  const ticketsQuery = useEntityTickets(id!);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t("common.noResults")}</p>
      </div>
    );
  }

  const handleEdit = () => {
    setFormData({
      name: entity.name,
      jurisdiction: entity.jurisdiction,
      status: entity.status,
      incorporation_date: entity.incorporation_date ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = { ...formData };
    if (!payload.incorporation_date) {
      payload.incorporation_date = null;
    }
    updateMutation.mutate(
      { id: id!, data: payload },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const matterColumns = [
    {
      key: "description",
      header: "Description",
      render: (row: Matter) => <span className="font-medium">{row.description}</span>,
    },
    {
      key: "status",
      header: t("tickets.status"),
      render: (row: Matter) => (
        <Badge color={row.status === "open" ? "green" : row.status === "on_hold" ? "yellow" : "gray"}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "opened_date",
      header: "Opened",
      render: (row: Matter) => new Date(row.opened_date).toLocaleDateString(),
    },
  ];

  const ticketColumns = [
    {
      key: "title",
      header: t("tickets.title"),
      render: (row: Ticket) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "current_state",
      header: t("tickets.status"),
      render: (row: Ticket) => (
        <Badge color="blue">{row.current_state?.name}</Badge>
      ),
    },
    {
      key: "priority",
      header: t("tickets.priority"),
      render: (row: Ticket) => {
        const colors: Record<string, "gray" | "green" | "yellow" | "red"> = {
          low: "gray",
          medium: "green",
          high: "yellow",
          urgent: "red",
        };
        return <Badge color={colors[row.priority] ?? "gray"}>{row.priority}</Badge>;
      },
    },
    {
      key: "assigned_to",
      header: t("tickets.assignedTo"),
      render: (row: Ticket) =>
        row.assigned_to
          ? `${row.assigned_to.first_name} ${row.assigned_to.last_name}`
          : "—",
    },
  ];

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ENTITIES)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
            <Badge color={jurisdictionColors[entity.jurisdiction] ?? "gray"}>
              {entity.jurisdiction.toUpperCase()}
            </Badge>
            <Badge color={statusColors[entity.status] ?? "gray"}>
              {entity.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} loading={updateMutation.isPending}>
                  {t("common.save")}
                </Button>
              </>
            ) : (
              activeTab === "overview" && (
                <Button variant="secondary" onClick={handleEdit}>
                  {t("common.edit")}
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium ${
                activeTab === tab
                  ? "border-arifa-navy text-arifa-navy"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t(`entities.detail.tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "overview" && (
          <Card>
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("entities.form.name")}
                  value={formData.name ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
                <Select
                  label={t("entities.form.jurisdiction")}
                  value={formData.jurisdiction ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, jurisdiction: e.target.value }))}
                  options={[
                    { value: "bvi", label: t("entities.form.bvi") },
                    { value: "panama", label: t("entities.form.panama") },
                    { value: "belize", label: t("entities.form.belize") },
                  ]}
                />
                <Input
                  label={t("entities.form.incorporationDate")}
                  type="date"
                  value={formData.incorporation_date ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, incorporation_date: e.target.value }))
                  }
                />
                <Select
                  label={t("entities.form.status")}
                  value={formData.status ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  options={[
                    { value: "pending", label: t("entities.form.pending") },
                    { value: "active", label: t("entities.form.active") },
                    { value: "dissolved", label: t("entities.form.dissolved") },
                    { value: "struck_off", label: t("entities.form.struckOff") },
                  ]}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">{t("entities.form.name")}</p>
                  <p className="font-medium">{entity.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("entities.form.jurisdiction")}</p>
                  <Badge color={jurisdictionColors[entity.jurisdiction] ?? "gray"}>
                    {entity.jurisdiction.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("entities.form.incorporationDate")}</p>
                  <p className="font-medium">
                    {entity.incorporation_date
                      ? new Date(entity.incorporation_date).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("entities.form.status")}</p>
                  <Badge color={statusColors[entity.status] ?? "gray"}>
                    {entity.status}
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        )}

        {activeTab === "corporateStructure" && (
          <CorporateStructureTab entityId={id!} />
        )}

        {activeTab === "riskProfile" && (
          <RiskProfileTab entityId={id!} />
        )}

        {activeTab === "matters" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={matterColumns}
              data={(mattersQuery.data?.results ?? []) as (Matter & Record<string, unknown>)[]}
              loading={mattersQuery.isLoading}
              emptyMessage={t("common.noResults")}
              keyExtractor={(row) => row.id as string}
            />
          </div>
        )}

        {activeTab === "tickets" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={ticketColumns}
              data={(ticketsQuery.data?.results ?? []) as (Ticket & Record<string, unknown>)[]}
              loading={ticketsQuery.isLoading}
              emptyMessage={t("tickets.noTickets")}
              onRowClick={(row) => navigate(ROUTES.TICKET_DETAIL.replace(":id", row.id as string))}
              keyExtractor={(row) => row.id as string}
            />
          </div>
        )}

        {activeTab === "accessLinks" && (
          <AccessLinksTab entityId={id!} />
        )}

        {activeTab === "audit" && (
          <AuditTab entityId={id!} />
        )}
      </div>
    </div>
  );
}
