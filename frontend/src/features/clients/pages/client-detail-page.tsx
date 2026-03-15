import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import {
  useClient,
  useUpdateClient,
  useClientEntities,
  useClientMatters,
  useClientTickets,
  useClientPersons,
} from "../api/clients-api";
import { ContactsTab } from "../components/contacts-tab";
import { PortalAccessTab } from "../components/portal-access-tab";
import type { Entity, Matter, Ticket, Person } from "@/types";

type Tab = "overview" | "entities" | "matters" | "invoices" | "tickets" | "people" | "contacts" | "portalAccess";

const tabs: Tab[] = ["overview", "entities", "matters", "invoices", "tickets", "people", "contacts", "portalAccess"];

const categoryColors: Record<string, "gray" | "yellow" | "blue"> = {
  silver: "gray",
  gold: "yellow",
  platinum: "blue",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: client, isLoading } = useClient(id!);
  const updateMutation = useUpdateClient();
  const entitiesQuery = useClientEntities(id!);
  const mattersQuery = useClientMatters(id!);
  const ticketsQuery = useClientTickets(id!);
  const personsQuery = useClientPersons(id!);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t("common.noResults")}</p>
      </div>
    );
  }

  const handleEdit = () => {
    setFormData({
      name: client.name,
      client_type: client.client_type,
      category: client.category,
      status: client.status,
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(
      { id: id!, data: formData },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const jurisdictionColors: Record<string, "blue" | "green" | "yellow"> = {
    bvi: "blue",
    panama: "green",
    belize: "yellow",
  };

  const entityColumns = [
    {
      key: "name",
      header: t("entities.columns.name"),
      render: (row: Entity) => <span className="font-medium">{row.name}</span>,
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
      key: "status",
      header: t("entities.columns.status"),
      render: (row: Entity) => (
        <Badge color={row.status === "active" ? "green" : "gray"}>{row.status}</Badge>
      ),
    },
  ];

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
    {
      key: "due_date",
      header: t("tickets.dueDate"),
      render: (row: Ticket) =>
        row.due_date ? new Date(row.due_date).toLocaleDateString() : "—",
    },
  ];

  const personColumns = [
    {
      key: "full_name",
      header: t("people.columns.fullName"),
      render: (row: Person) => <span className="font-medium">{row.full_name}</span>,
    },
    {
      key: "person_type",
      header: t("people.columns.type"),
      render: (row: Person) => (
        <Badge color={row.person_type === "corporate" ? "blue" : "gray"}>
          {t(`people.form.${row.person_type}`)}
        </Badge>
      ),
    },
    {
      key: "nationality",
      header: t("people.columns.nationality"),
    },
    {
      key: "pep_status",
      header: t("people.columns.pepStatus"),
      render: (row: Person) => (
        <Badge color={row.pep_status ? "red" : "green"}>
          {row.pep_status ? t("people.pep") : t("people.notPep")}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(ROUTES.CLIENTS)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{client.name}</h1>
            <Badge color={client.client_type === "corporate" ? "blue" : "gray"}>
              {t(`clients.form.${client.client_type}`)}
            </Badge>
            <Badge color={categoryColors[client.category] ?? "gray"}>
              {t(`clients.form.${client.category}`)}
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
              <Button variant="secondary" onClick={handleEdit}>
                {t("common.edit")}
              </Button>
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
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t(`clients.detail.tabs.${tab}`)}
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
                  label={t("clients.form.name")}
                  value={formData.name ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
                <Select
                  label={t("clients.form.clientType")}
                  value={formData.client_type ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, client_type: e.target.value }))}
                  options={[
                    { value: "natural", label: t("clients.form.natural") },
                    { value: "corporate", label: t("clients.form.corporate") },
                  ]}
                />
                <Select
                  label={t("clients.form.category")}
                  value={formData.category ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  options={[
                    { value: "silver", label: t("clients.form.silver") },
                    { value: "gold", label: t("clients.form.gold") },
                    { value: "platinum", label: t("clients.form.platinum") },
                  ]}
                />
                <Select
                  label={t("clients.form.status")}
                  value={formData.status ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  options={[
                    { value: "active", label: t("clients.form.active") },
                    { value: "inactive", label: t("clients.form.inactive") },
                  ]}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">{t("clients.form.name")}</p>
                  <p className="font-medium">{client.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("clients.form.clientType")}</p>
                  <p className="font-medium">{t(`clients.form.${client.client_type}`)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("clients.form.category")}</p>
                  <p className="font-medium">{t(`clients.form.${client.category}`)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("clients.form.status")}</p>
                  <Badge color={client.status === "active" ? "green" : "gray"}>
                    {t(`clients.form.${client.status}`)}
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        )}

        {activeTab === "entities" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={entityColumns}
              data={entitiesQuery.data?.results ?? []}
              loading={entitiesQuery.isLoading}
              emptyMessage={t("entities.noEntities")}
              onRowClick={(row) => navigate(ROUTES.ENTITY_DETAIL.replace(":id", row.id as string))}
              keyExtractor={(row) => row.id as string}
            />
          </div>
        )}

        {activeTab === "matters" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={matterColumns}
              data={mattersQuery.data?.results ?? []}
              loading={mattersQuery.isLoading}
              emptyMessage={t("common.noResults")}
              keyExtractor={(row) => row.id as string}
            />
          </div>
        )}

        {activeTab === "invoices" && (
          <Card className="flex flex-col items-center justify-center py-12">
            <DocumentTextIcon className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">{t("invoices.comingSoon")}</h3>
            <p className="mt-1 text-sm text-gray-500">{t("invoices.comingSoonDesc")}</p>
          </Card>
        )}

        {activeTab === "tickets" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={ticketColumns}
              data={ticketsQuery.data?.results ?? []}
              loading={ticketsQuery.isLoading}
              emptyMessage={t("tickets.noTickets")}
              onRowClick={(row) => navigate(ROUTES.TICKET_DETAIL.replace(":id", row.id as string))}
              keyExtractor={(row) => row.id as string}
            />
          </div>
        )}

        {activeTab === "people" && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <DataTable
              columns={personColumns}
              data={personsQuery.data?.results ?? []}
              loading={personsQuery.isLoading}
              emptyMessage={t("people.noPeople")}
              onRowClick={(row) => navigate(ROUTES.PERSON_DETAIL.replace(":id", row.id as string))}
              keyExtractor={(row) => row.id as string}
            />
          </div>
        )}

        {activeTab === "contacts" && (
          <ContactsTab clientId={id!} />
        )}

        {activeTab === "portalAccess" && (
          <PortalAccessTab clientId={id!} />
        )}
      </div>
    </div>
  );
}
