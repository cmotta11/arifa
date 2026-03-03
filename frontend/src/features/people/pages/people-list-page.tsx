import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { ROUTES } from "@/config/routes";
import { usePeople, useCreatePerson } from "../api/people-api";
import { useJurisdictionRisks } from "@/features/admin/api/admin-api";
import { PersonDocumentScan, type PersonFormData } from "../components/person-document-scan";
import type { Person } from "@/types";

const emptyForm = {
  full_name: "",
  person_type: "natural",
  nationality_id: "",
  country_of_residence_id: "",
  identification_number: "",
  identification_type: "",
  pep_status: "false",
};

export default function PeopleListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [pepFilter, setPepFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (search) f.search = search;
    if (typeFilter) f.person_type = typeFilter;
    if (pepFilter) f.pep_status = pepFilter;
    return f;
  }, [search, typeFilter, pepFilter]);

  const { data, isLoading } = usePeople(filters);
  const createMutation = useCreatePerson();
  const { data: jurisdictions } = useJurisdictionRisks();

  const jurisdictionOptions = useMemo(
    () => [
      { value: "", label: "—" },
      ...(jurisdictions ?? []).map((j) => ({
        value: j.id,
        label: `${j.country_name} (${j.country_code})`,
      })),
    ],
    [jurisdictions],
  );

  const handleScanApply = (data: PersonFormData) => {
    setForm((p) => ({
      ...p,
      ...(data.full_name && { full_name: data.full_name }),
      ...(data.nationality_id && { nationality_id: data.nationality_id }),
      ...(data.country_of_residence_id && { country_of_residence_id: data.country_of_residence_id }),
      ...(data.identification_number && { identification_number: data.identification_number }),
      ...(data.identification_type && { identification_type: data.identification_type }),
    }));
  };

  const handleCreate = () => {
    if (!form.full_name.trim()) return;
    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      person_type: form.person_type,
      pep_status: form.pep_status === "true",
    };
    if (form.nationality_id) payload.nationality_id = form.nationality_id;
    else payload.nationality_id = null;
    if (form.country_of_residence_id) payload.country_of_residence_id = form.country_of_residence_id;
    else payload.country_of_residence_id = null;
    if (form.identification_number) payload.identification_number = form.identification_number;
    if (form.identification_type) payload.identification_type = form.identification_type;
    createMutation.mutate(payload, {
      onSuccess: (newPerson) => {
        setShowCreate(false);
        setForm(emptyForm);
        navigate(ROUTES.PERSON_DETAIL.replace(":id", newPerson.id));
      },
    });
  };

  const typeOptions = [
    { value: "", label: t("people.filters.allTypes") },
    { value: "natural", label: t("people.form.natural") },
    { value: "corporate", label: t("people.form.corporate") },
  ];

  const pepOptions = [
    { value: "", label: t("people.filters.allPep") },
    { value: "true", label: t("people.filters.pepYes") },
    { value: "false", label: t("people.filters.pepNo") },
  ];

  const columns = useMemo(
    () => [
      {
        key: "full_name",
        header: t("people.columns.fullName"),
        render: (row: Person) => (
          <span className="font-medium text-gray-900">{row.full_name}</span>
        ),
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
        render: (row: Person) => row.nationality?.country_name || "—",
      },
      {
        key: "identification_number",
        header: t("people.columns.idNumber"),
        render: (row: Person) => (
          <span className="font-mono text-sm">{row.identification_number || "—"}</span>
        ),
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
      {
        key: "client",
        header: t("people.columns.client"),
        render: (row: Person) => row.client?.name ?? "—",
      },
    ],
    [t],
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("people.title")}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {t("people.create")}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder={t("people.filters.search")}
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
            options={pepOptions}
            value={pepFilter}
            onChange={(e) => setPepFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={(data?.results ?? []) as (Person & Record<string, unknown>)[]}
          loading={isLoading}
          emptyMessage={t("people.noPeople")}
          onRowClick={(row) => navigate(ROUTES.PERSON_DETAIL.replace(":id", row.id as string))}
          keyExtractor={(row) => row.id as string}
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("people.create")}
      >
        <div className="space-y-4">
          <Input
            label={t("people.form.fullName")}
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            autoFocus
          />
          <Select
            label={t("people.form.personType")}
            value={form.person_type}
            onChange={(e) => setForm((p) => ({ ...p, person_type: e.target.value }))}
            options={[
              { value: "natural", label: t("people.form.natural") },
              { value: "corporate", label: t("people.form.corporate") },
            ]}
          />
          {form.person_type === "natural" && (
            <PersonDocumentScan
              jurisdictions={jurisdictions}
              onApply={handleScanApply}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <SearchableSelect
              label={t("people.form.nationality")}
              value={form.nationality_id}
              onChange={(val) => setForm((p) => ({ ...p, nationality_id: val }))}
              options={jurisdictionOptions}
            />
            <SearchableSelect
              label={t("people.form.countryOfResidence")}
              value={form.country_of_residence_id}
              onChange={(val) => setForm((p) => ({ ...p, country_of_residence_id: val }))}
              options={jurisdictionOptions}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("people.form.idNumber")}
              value={form.identification_number}
              onChange={(e) =>
                setForm((p) => ({ ...p, identification_number: e.target.value }))
              }
            />
            <Select
              label={t("people.form.idType")}
              value={form.identification_type}
              onChange={(e) =>
                setForm((p) => ({ ...p, identification_type: e.target.value }))
              }
              options={[
                { value: "", label: "—" },
                { value: "passport", label: "Passport" },
                { value: "cedula", label: "Cedula" },
                { value: "corporate_registry", label: "Corporate Registry" },
              ]}
            />
          </div>
          <Select
            label={t("people.form.pepStatus")}
            value={form.pep_status}
            onChange={(e) => setForm((p) => ({ ...p, pep_status: e.target.value }))}
            options={[
              { value: "false", label: t("people.notPep") },
              { value: "true", label: t("people.pep") },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!form.full_name.trim()}
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
