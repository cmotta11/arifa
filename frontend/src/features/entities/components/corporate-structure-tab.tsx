import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TrashIcon, PlusIcon, ArrowLeftIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DataTable } from "@/components/data-display/data-table";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import { useJurisdictionRisks } from "@/features/admin/api/admin-api";
import { CollapsibleSection } from "./collapsible-section";
import {
  useEntity,
  useEntities,
  useCreateEntity,
  useEntityOfficers,
  useCreateOfficer,
  useUpdateOfficer,
  useDeleteOfficer,
  useShareClasses,
  useCreateShareClass,
  useDeleteShareClass,
  useCreateShareIssuance,
  useUpdateShareIssuance,
  useDeleteShareIssuance,
  useOwnershipTree,
} from "../api/entities-api";
import { usePeople, useCreatePerson } from "@/features/people/api/people-api";
import { PersonDocumentScan, type PersonFormData } from "@/features/people/components/person-document-scan";
import type { EntityOfficer, ShareClass, ShareIssuance, Person, OwnershipNode, UBOEntry } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CorporateStructureTabProps {
  entityId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CHF", label: "CHF" },
  { value: "CAD", label: "CAD" },
  { value: "AUD", label: "AUD" },
  { value: "JPY", label: "JPY" },
  { value: "BZD", label: "BZD" },
  { value: "PAB", label: "PAB" },
];

// ---------------------------------------------------------------------------
// Officers Section
// ---------------------------------------------------------------------------

const POSITION_OPTIONS = [
  "director",
  "president",
  "secretary",
  "treasurer",
  "registered_agent",
  "protector",
  "authorized_signatory",
  "other",
] as const;

function OfficersSection({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [holderType, setHolderType] = useState<"person" | "entity">("person");
  const [quickCreate, setQuickCreate] = useState(false);

  const [form, setForm] = useState({
    holder_id: "",
    positions: ["director"] as string[],
    start_date: "",
    end_date: "",
  });

  // Quick-create person form
  const [personForm, setPersonForm] = useState({
    full_name: "",
    person_type: "natural" as string,
    nationality_id: "",
    country_of_residence_id: "",
    date_of_birth: "",
    identification_number: "",
    identification_type: "" as string,
    pep_status: false,
  });

  // Quick-create entity form
  const [entityForm, setEntityForm] = useState({
    name: "",
    jurisdiction: "bvi" as string,
    incorporation_date: "",
    status: "pending" as string,
  });

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

  const entityQuery = useEntity(entityId);
  const officersQuery = useEntityOfficers(entityId, expanded);
  const peopleQuery = usePeople(search && holderType === "person" ? { search } : {});
  const entitiesQuery = useEntities(search && holderType === "entity" ? { search } : {});
  const createMutation = useCreateOfficer();
  const updateOfficerMutation = useUpdateOfficer();
  const deleteMutation = useDeleteOfficer();
  const createPersonMutation = useCreatePerson();
  const createEntityMutation = useCreateEntity();

  const officers = officersQuery.data?.results ?? [];

  // Edit officer state
  const [editingOfficer, setEditingOfficer] = useState<EntityOfficer | null>(null);
  const [editOfficerForm, setEditOfficerForm] = useState({
    positions: [] as string[],
    start_date: "",
    end_date: "",
  });

  const resetModal = () => {
    setShowModal(false);
    setSearch("");
    setQuickCreate(false);
    setHolderType("person");
    setForm({ holder_id: "", positions: ["director"], start_date: "", end_date: "" });
    setPersonForm({
      full_name: "", person_type: "natural", nationality_id: "", country_of_residence_id: "",
      date_of_birth: "", identification_number: "", identification_type: "", pep_status: false,
    });
    setEntityForm({ name: "", jurisdiction: "bvi", incorporation_date: "", status: "pending" });
  };

  const handleCreate = () => {
    const data: Record<string, unknown> = {
      entity_id: entityId,
      positions: form.positions,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    if (holderType === "person") {
      data.officer_person_id = form.holder_id;
      data.officer_entity_id = null;
    } else {
      data.officer_entity_id = form.holder_id;
      data.officer_person_id = null;
    }
    createMutation.mutate(data, { onSuccess: resetModal });
  };

  const handleQuickCreatePerson = () => {
    const data: Record<string, unknown> = {
      full_name: personForm.full_name,
      person_type: personForm.person_type,
      nationality_id: personForm.nationality_id || null,
      country_of_residence_id: personForm.country_of_residence_id || null,
      date_of_birth: personForm.date_of_birth || null,
      identification_number: personForm.identification_number,
      identification_type: personForm.identification_type,
      pep_status: personForm.pep_status,
      client_id: entityQuery.data?.client?.id ?? null,
    };
    createPersonMutation.mutate(data, {
      onSuccess: (created) => {
        setForm((f) => ({ ...f, holder_id: created.id }));
        setSearch(created.full_name);
        setQuickCreate(false);
      },
    });
  };

  const handleQuickCreateEntity = () => {
    const data: Record<string, unknown> = {
      ...entityForm,
      client_id: entityQuery.data?.client?.id,
      incorporation_date: entityForm.incorporation_date || null,
    };
    createEntityMutation.mutate(data, {
      onSuccess: (created) => {
        setForm((f) => ({ ...f, holder_id: created.id }));
        setSearch(created.name);
        setQuickCreate(false);
      },
    });
  };

  const handleScanApply = (data: PersonFormData) => {
    setPersonForm((p) => ({
      ...p,
      ...(data.full_name && { full_name: data.full_name }),
      ...(data.date_of_birth && { date_of_birth: data.date_of_birth }),
      ...(data.nationality_id && { nationality_id: data.nationality_id }),
      ...(data.country_of_residence_id && { country_of_residence_id: data.country_of_residence_id }),
      ...(data.identification_number && { identification_number: data.identification_number }),
      ...(data.identification_type && { identification_type: data.identification_type }),
    }));
  };

  const handleEditOfficer = (officer: EntityOfficer) => {
    setEditOfficerForm({
      positions: [...officer.positions],
      start_date: officer.start_date ?? "",
      end_date: officer.end_date ?? "",
    });
    setEditingOfficer(officer);
  };

  const handleSaveOfficer = () => {
    if (!editingOfficer) return;
    updateOfficerMutation.mutate(
      {
        id: editingOfficer.id,
        data: {
          positions: editOfficerForm.positions,
          start_date: editOfficerForm.start_date || null,
          end_date: editOfficerForm.end_date || null,
        },
      },
      { onSuccess: () => setEditingOfficer(null) },
    );
  };

  const togglePosition = (pos: string) => {
    setForm((f) => {
      const has = f.positions.includes(pos);
      const next = has ? f.positions.filter((p) => p !== pos) : [...f.positions, pos];
      return { ...f, positions: next.length > 0 ? next : f.positions };
    });
  };

  const toggleEditPosition = (pos: string) => {
    setEditOfficerForm((f) => {
      const has = f.positions.includes(pos);
      const next = has ? f.positions.filter((p) => p !== pos) : [...f.positions, pos];
      return { ...f, positions: next.length > 0 ? next : f.positions };
    });
  };

  const columns = [
    {
      key: "holder",
      header: t("entities.officers.holder"),
      render: (row: EntityOfficer) => {
        const isEntity = !!row.officer_entity;
        const name = row.officer_person?.full_name ?? row.officer_entity?.name ?? "—";
        const route = row.officer_person
          ? ROUTES.PERSON_DETAIL.replace(":id", row.officer_person.id)
          : row.officer_entity
            ? ROUTES.ENTITY_DETAIL.replace(":id", row.officer_entity.id)
            : null;
        return (
          <span className="flex items-center gap-1">
            {route ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigate(route); }}
                className="font-medium text-arifa-navy hover:underline"
              >
                {name}
              </button>
            ) : name}
            {isEntity && <Badge color="blue">{t("entities.orgChart.entity")}</Badge>}
          </span>
        );
      },
    },
    {
      key: "positions",
      header: t("entities.officers.position"),
      render: (row: EntityOfficer) => (
        <div className="flex flex-wrap gap-1">
          {(row.positions ?? []).map((pos) => (
            <Badge key={pos} color="blue">{t(`entities.officers.positions.${pos}`)}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "start_date",
      header: t("entities.officers.startDate"),
      render: (row: EntityOfficer) =>
        row.start_date ? new Date(row.start_date).toLocaleDateString() : "—",
    },
    {
      key: "end_date",
      header: t("entities.officers.endDate"),
      render: (row: EntityOfficer) =>
        row.end_date ? new Date(row.end_date).toLocaleDateString() : "—",
    },
    {
      key: "is_active",
      header: t("entities.officers.active"),
      render: (row: EntityOfficer) => (
        <Badge color={row.is_active ? "green" : "gray"}>
          {row.is_active ? t("common.yes") : t("common.no")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row: EntityOfficer) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEditOfficer(row); }}
            className="text-gray-400 hover:text-blue-500"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(row.id); }}
            className="text-gray-400 hover:text-red-500"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <CollapsibleSection
      title={t("entities.officers.title")}
      onToggle={setExpanded}
      action={
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            setShowModal(true);
          }}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("entities.officers.add")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={officers as (EntityOfficer & Record<string, unknown>)[]}
        loading={officersQuery.isLoading}
        emptyMessage={t("common.noResults")}
        keyExtractor={(row) => row.id as string}
      />

      {/* Add Officer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.officers.add")}</h3>
            <div className="space-y-4">
              {/* Holder Type Toggle */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("entities.officers.holderType")}
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={holderType === "person" ? "primary" : "secondary"}
                    onClick={() => { setHolderType("person"); setSearch(""); setForm((f) => ({ ...f, holder_id: "" })); setQuickCreate(false); }}
                  >
                    {t("entities.shareRegister.personHolder")}
                  </Button>
                  <Button
                    size="sm"
                    variant={holderType === "entity" ? "primary" : "secondary"}
                    onClick={() => { setHolderType("entity"); setSearch(""); setForm((f) => ({ ...f, holder_id: "" })); setQuickCreate(false); }}
                  >
                    {t("entities.shareRegister.entityHolder")}
                  </Button>
                </div>
              </div>

              {/* Search or Quick-Create */}
              {!quickCreate ? (
                <>
                  <Input
                    label={holderType === "person" ? t("entities.officers.searchPerson") : t("entities.shareRegister.searchEntity")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={holderType === "person" ? t("entities.officers.searchPerson") : t("entities.shareRegister.searchEntity")}
                  />
                  {search && (
                    <div className="max-h-32 overflow-auto rounded border border-gray-200">
                      {holderType === "person" ? (
                        peopleQuery.isLoading ? (
                          <div className="flex justify-center p-2"><Spinner size="sm" /></div>
                        ) : (
                          (peopleQuery.data?.results ?? []).map((p: Person) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, holder_id: p.id })); setSearch(p.full_name); }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${form.holder_id === p.id ? "bg-blue-50 font-medium" : ""}`}
                            >
                              {p.full_name}
                            </button>
                          ))
                        )
                      ) : (
                        entitiesQuery.isLoading ? (
                          <div className="flex justify-center p-2"><Spinner size="sm" /></div>
                        ) : (
                          (entitiesQuery.data?.results ?? []).map((e: { id: string; name: string }) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, holder_id: e.id })); setSearch(e.name); }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${form.holder_id === e.id ? "bg-blue-50 font-medium" : ""}`}
                            >
                              {e.name}
                            </button>
                          ))
                        )
                      )}
                    </div>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setQuickCreate(true)}>
                    <PlusIcon className="mr-1 h-3 w-3" />
                    {holderType === "person" ? t("entities.officers.createNewPerson") : t("entities.officers.createNewEntity")}
                  </Button>
                </>
              ) : (
                /* Quick-Create Inline Form */
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">
                      {holderType === "person" ? t("entities.officers.createNewPerson") : t("entities.officers.createNewEntity")}
                    </h4>
                    <button type="button" onClick={() => setQuickCreate(false)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                      <ArrowLeftIcon className="h-3 w-3" />
                      {t("entities.officers.backToSearch")}
                    </button>
                  </div>

                  {holderType === "person" ? (
                    <>
                      {personForm.person_type === "natural" && (
                        <PersonDocumentScan
                          jurisdictions={jurisdictions}
                          onApply={handleScanApply}
                        />
                      )}
                      <Input label={t("people.form.fullName")} value={personForm.full_name} onChange={(e) => setPersonForm((f) => ({ ...f, full_name: e.target.value }))} />
                      <Select
                        label={t("people.form.personType")}
                        value={personForm.person_type}
                        onChange={(e) => setPersonForm((f) => ({ ...f, person_type: e.target.value }))}
                        options={[
                          { value: "natural", label: t("people.form.natural") },
                          { value: "corporate", label: t("people.form.corporate") },
                        ]}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <SearchableSelect label={t("people.form.nationality")} value={personForm.nationality_id} onChange={(val) => setPersonForm((f) => ({ ...f, nationality_id: val }))} options={jurisdictionOptions} />
                        <SearchableSelect label={t("people.form.countryOfResidence")} value={personForm.country_of_residence_id} onChange={(val) => setPersonForm((f) => ({ ...f, country_of_residence_id: val }))} options={jurisdictionOptions} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input label={t("people.form.dateOfBirth")} type="date" value={personForm.date_of_birth} onChange={(e) => setPersonForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                        <Input label={t("people.form.idNumber")} value={personForm.identification_number} onChange={(e) => setPersonForm((f) => ({ ...f, identification_number: e.target.value }))} />
                      </div>
                      <Select
                        label={t("people.form.idType")}
                        value={personForm.identification_type}
                        onChange={(e) => setPersonForm((f) => ({ ...f, identification_type: e.target.value }))}
                        options={[
                          { value: "", label: "—" },
                          { value: "passport", label: t("documents.types.passport") },
                          { value: "cedula", label: t("documents.types.cedula") },
                          { value: "corporate_registry", label: t("documents.types.corporate_registry") },
                        ]}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={personForm.pep_status} onChange={(e) => setPersonForm((f) => ({ ...f, pep_status: e.target.checked }))} className="rounded border-gray-300" />
                        {t("people.form.pepStatus")}
                      </label>
                      <Button
                        size="sm"
                        onClick={handleQuickCreatePerson}
                        loading={createPersonMutation.isPending}
                        disabled={!personForm.full_name}
                      >
                        {t("entities.officers.createAndSelect")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input label={t("entities.form.name")} value={entityForm.name} onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))} />
                      <Select
                        label={t("entities.form.jurisdiction")}
                        value={entityForm.jurisdiction}
                        onChange={(e) => setEntityForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                        options={[
                          { value: "bvi", label: t("entities.form.bvi") },
                          { value: "panama", label: t("entities.form.panama") },
                          { value: "belize", label: t("entities.form.belize") },
                        ]}
                      />
                      <Input label={t("entities.form.incorporationDate")} type="date" value={entityForm.incorporation_date} onChange={(e) => setEntityForm((f) => ({ ...f, incorporation_date: e.target.value }))} />
                      <Select
                        label={t("entities.form.status")}
                        value={entityForm.status}
                        onChange={(e) => setEntityForm((f) => ({ ...f, status: e.target.value }))}
                        options={[
                          { value: "pending", label: t("entities.form.pending") },
                          { value: "active", label: t("entities.form.active") },
                          { value: "dissolved", label: t("entities.form.dissolved") },
                          { value: "struck_off", label: t("entities.form.struckOff") },
                        ]}
                      />
                      <Button
                        size="sm"
                        onClick={handleQuickCreateEntity}
                        loading={createEntityMutation.isPending}
                        disabled={!entityForm.name}
                      >
                        {t("entities.officers.createAndSelect")}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Multi-select Positions (checkboxes) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("entities.officers.position")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITION_OPTIONS.map((pos) => (
                    <label key={pos} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.positions.includes(pos)}
                        onChange={() => togglePosition(pos)}
                        className="rounded border-gray-300"
                      />
                      {t(`entities.officers.positions.${pos}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("entities.officers.startDate")}
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
                <Input
                  label={t("entities.officers.endDate")}
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={resetModal}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!form.holder_id || form.positions.length === 0}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Officer Modal */}
      {editingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.officers.edit")}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">{t("entities.officers.holder")}</p>
                <p className="font-medium">
                  {editingOfficer.officer_person?.full_name ?? editingOfficer.officer_entity?.name ?? "—"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("entities.officers.position")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITION_OPTIONS.map((pos) => (
                    <label key={pos} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editOfficerForm.positions.includes(pos)}
                        onChange={() => toggleEditPosition(pos)}
                        className="rounded border-gray-300"
                      />
                      {t(`entities.officers.positions.${pos}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("entities.officers.startDate")}
                  type="date"
                  value={editOfficerForm.start_date}
                  onChange={(e) => setEditOfficerForm((f) => ({ ...f, start_date: e.target.value }))}
                />
                <Input
                  label={t("entities.officers.endDate")}
                  type="date"
                  value={editOfficerForm.end_date}
                  onChange={(e) => setEditOfficerForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingOfficer(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveOfficer} loading={updateOfficerMutation.isPending}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Share Register Section
// ---------------------------------------------------------------------------

function ShareRegisterSection({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showIssuanceModal, setShowIssuanceModal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [holderType, setHolderType] = useState<"person" | "entity">("person");
  const [quickCreate, setQuickCreate] = useState(false);

  const [classForm, setClassForm] = useState({
    name: "",
    currency: "USD",
    par_value: "",
    no_par_value: false,
    authorized_shares: "",
    voting_rights: true,
  });

  const [issuanceForm, setIssuanceForm] = useState({
    holder_id: "",
    num_shares: "",
    issue_date: "",
    certificate_number: "",
    is_jtwros: false,
    jtwros_partner_name: "",
    is_trustee: false,
    trustee_for: "",
  });

  // Quick-create person form
  const [personForm, setPersonForm] = useState({
    full_name: "",
    person_type: "natural" as string,
    nationality_id: "",
    country_of_residence_id: "",
    date_of_birth: "",
    identification_number: "",
    identification_type: "" as string,
    pep_status: false,
  });

  // Quick-create entity form
  const [entityForm, setEntityForm] = useState({
    name: "",
    jurisdiction: "bvi" as string,
    incorporation_date: "",
    status: "pending" as string,
  });

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

  const entityQuery = useEntity(entityId);
  const classesQuery = useShareClasses(entityId, expanded);
  const peopleQuery = usePeople(search && holderType === "person" ? { search } : {});
  const createClassMutation = useCreateShareClass();
  const deleteClassMutation = useDeleteShareClass();
  const createIssuanceMutation = useCreateShareIssuance();
  const updateIssuanceMutation = useUpdateShareIssuance();
  const deleteIssuanceMutation = useDeleteShareIssuance();
  const createPersonMutation = useCreatePerson();
  const createEntityMutation = useCreateEntity();

  const entitiesQuery = useEntities(search && holderType === "entity" ? { search } : {});

  const shareClasses = classesQuery.data?.results ?? [];

  // Edit issuance state
  const [editingIssuance, setEditingIssuance] = useState<ShareIssuance | null>(null);
  const [editIssuanceForm, setEditIssuanceForm] = useState({
    num_shares: "",
    issue_date: "",
    certificate_number: "",
    is_jtwros: false,
    jtwros_partner_name: "",
    is_trustee: false,
    trustee_for: "",
  });

  const handleCreateClass = () => {
    createClassMutation.mutate(
      {
        entity_id: entityId,
        name: classForm.name,
        currency: classForm.currency,
        par_value: classForm.no_par_value ? null : (classForm.par_value ? Number(classForm.par_value) : null),
        authorized_shares: classForm.authorized_shares ? Number(classForm.authorized_shares) : null,
        voting_rights: classForm.voting_rights,
      },
      {
        onSuccess: () => {
          setShowClassModal(false);
          setClassForm({ name: "", currency: "USD", par_value: "", no_par_value: false, authorized_shares: "", voting_rights: true });
        },
      },
    );
  };

  const handleCreateIssuance = () => {
    const data: Record<string, unknown> = {
      share_class_id: showIssuanceModal,
      num_shares: Number(issuanceForm.num_shares),
      issue_date: issuanceForm.issue_date || null,
      certificate_number: issuanceForm.certificate_number,
      is_jtwros: issuanceForm.is_jtwros,
      jtwros_partner_name: issuanceForm.jtwros_partner_name,
      is_trustee: issuanceForm.is_trustee,
      trustee_for: issuanceForm.trustee_for,
    };
    if (holderType === "person") {
      data.shareholder_person_id = issuanceForm.holder_id;
      data.shareholder_entity_id = null;
    } else {
      data.shareholder_entity_id = issuanceForm.holder_id;
      data.shareholder_person_id = null;
    }
    createIssuanceMutation.mutate(data, {
      onSuccess: () => {
        resetIssuanceModal();
      },
    });
  };

  const resetIssuanceModal = () => {
    setShowIssuanceModal(null);
    setIssuanceForm({
      holder_id: "",
      num_shares: "",
      issue_date: "",
      certificate_number: "",
      is_jtwros: false,
      jtwros_partner_name: "",
      is_trustee: false,
      trustee_for: "",
    });
    setSearch("");
    setQuickCreate(false);
    setHolderType("person");
    setPersonForm({
      full_name: "", person_type: "natural", nationality_id: "", country_of_residence_id: "",
      date_of_birth: "", identification_number: "", identification_type: "", pep_status: false,
    });
    setEntityForm({ name: "", jurisdiction: "bvi", incorporation_date: "", status: "pending" });
  };

  const handleQuickCreatePerson = () => {
    const data: Record<string, unknown> = {
      full_name: personForm.full_name,
      person_type: personForm.person_type,
      nationality_id: personForm.nationality_id || null,
      country_of_residence_id: personForm.country_of_residence_id || null,
      date_of_birth: personForm.date_of_birth || null,
      identification_number: personForm.identification_number,
      identification_type: personForm.identification_type,
      pep_status: personForm.pep_status,
      client_id: entityQuery.data?.client?.id ?? null,
    };
    createPersonMutation.mutate(data, {
      onSuccess: (created) => {
        setIssuanceForm((f) => ({ ...f, holder_id: created.id }));
        setSearch(created.full_name);
        setQuickCreate(false);
      },
    });
  };

  const handleQuickCreateEntity = () => {
    const data: Record<string, unknown> = {
      ...entityForm,
      client_id: entityQuery.data?.client?.id,
      incorporation_date: entityForm.incorporation_date || null,
    };
    createEntityMutation.mutate(data, {
      onSuccess: (created) => {
        setIssuanceForm((f) => ({ ...f, holder_id: created.id }));
        setSearch(created.name);
        setQuickCreate(false);
      },
    });
  };

  const handleScanApply = (data: PersonFormData) => {
    setPersonForm((p) => ({
      ...p,
      ...(data.full_name && { full_name: data.full_name }),
      ...(data.date_of_birth && { date_of_birth: data.date_of_birth }),
      ...(data.nationality_id && { nationality_id: data.nationality_id }),
      ...(data.country_of_residence_id && { country_of_residence_id: data.country_of_residence_id }),
      ...(data.identification_number && { identification_number: data.identification_number }),
      ...(data.identification_type && { identification_type: data.identification_type }),
    }));
  };

  const handleEditIssuance = (iss: ShareIssuance) => {
    setEditIssuanceForm({
      num_shares: String(iss.num_shares),
      issue_date: iss.issue_date ?? "",
      certificate_number: iss.certificate_number,
      is_jtwros: iss.is_jtwros,
      jtwros_partner_name: iss.jtwros_partner_name,
      is_trustee: iss.is_trustee,
      trustee_for: iss.trustee_for,
    });
    setEditingIssuance(iss);
  };

  const handleSaveIssuance = () => {
    if (!editingIssuance) return;
    updateIssuanceMutation.mutate(
      {
        id: editingIssuance.id,
        data: {
          num_shares: Number(editIssuanceForm.num_shares),
          issue_date: editIssuanceForm.issue_date || null,
          certificate_number: editIssuanceForm.certificate_number,
          is_jtwros: editIssuanceForm.is_jtwros,
          jtwros_partner_name: editIssuanceForm.jtwros_partner_name,
          is_trustee: editIssuanceForm.is_trustee,
          trustee_for: editIssuanceForm.trustee_for,
        },
      },
      { onSuccess: () => setEditingIssuance(null) },
    );
  };

  return (
    <CollapsibleSection
      title={t("entities.shareRegister.title")}
      onToggle={setExpanded}
      action={
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            setShowClassModal(true);
          }}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("entities.shareRegister.addClass")}
        </Button>
      }
    >
      {classesQuery.isLoading ? (
        <div className="flex justify-center py-6"><Spinner size="lg" /></div>
      ) : shareClasses.length === 0 ? (
        <p className="text-center text-sm text-gray-500">{t("common.noResults")}</p>
      ) : (
        <div className="space-y-4">
          {shareClasses.map((sc: ShareClass) => {
            const totalIssued = sc.issuances.reduce((s, i) => s + i.num_shares, 0);
            return (
              <div key={sc.id} className="rounded-lg border border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{sc.name}</span>
                    <Badge color="blue">{sc.currency}</Badge>
                    {sc.par_value ? (
                      <span className="text-xs text-gray-500">
                        Par: {sc.par_value}
                      </span>
                    ) : (
                      <Badge color="gray">{t("entities.shareRegister.noParValue")}</Badge>
                    )}
                    {sc.authorized_shares && (
                      <span className="text-xs text-gray-500">
                        Auth: {sc.authorized_shares.toLocaleString()}
                      </span>
                    )}
                    {sc.voting_rights && (
                      <Badge color="green">{t("entities.shareRegister.voting")}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowIssuanceModal(sc.id);
                        setHolderType("person");
                      }}
                    >
                      <PlusIcon className="mr-1 h-3 w-3" />
                      {t("entities.shareRegister.addIssuance")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => deleteClassMutation.mutate(sc.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {sc.issuances.length > 0 && (
                  <div className="border-t border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">{t("entities.shareRegister.holder")}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">{t("entities.shareRegister.shares")}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">%</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">{t("entities.shareRegister.certificate")}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">{t("entities.shareRegister.flags")}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">{t("entities.shareRegister.issueDate")}</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {sc.issuances.map((iss: ShareIssuance) => {
                          const pct = totalIssued > 0 ? ((iss.num_shares / totalIssued) * 100).toFixed(1) : "—";
                          const holderName = iss.shareholder_person?.full_name ?? iss.shareholder_entity?.name ?? "—";
                          const holderRoute = iss.shareholder_person
                            ? ROUTES.PERSON_DETAIL.replace(":id", iss.shareholder_person.id)
                            : iss.shareholder_entity
                              ? ROUTES.ENTITY_DETAIL.replace(":id", iss.shareholder_entity.id)
                              : null;

                          return (
                            <tr key={iss.id}>
                              <td className="px-4 py-2 text-sm">
                                {holderRoute ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate(holderRoute)}
                                    className="font-medium text-arifa-navy hover:underline"
                                  >
                                    {holderName}
                                  </button>
                                ) : (
                                  holderName
                                )}
                                {iss.shareholder_entity && (
                                  <Badge color="blue" className="ml-1">{t("entities.shareRegister.entityType")}</Badge>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">{iss.num_shares.toLocaleString()}</td>
                              <td className="px-4 py-2 text-sm">{pct}%</td>
                              <td className="px-4 py-2 text-sm font-mono">{iss.certificate_number || "—"}</td>
                              <td className="px-4 py-2 text-sm">
                                <div className="flex gap-1">
                                  {iss.is_jtwros && <Badge color="yellow">JTWROS</Badge>}
                                  {iss.is_trustee && <Badge color="gray">{t("entities.shareRegister.trustee")}</Badge>}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {iss.issue_date ? new Date(iss.issue_date).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditIssuance(iss)}
                                    className="text-gray-400 hover:text-blue-500"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteIssuanceMutation.mutate(iss.id)}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Share Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.shareRegister.addClass")}</h3>
            <div className="space-y-4">
              <Input
                label={t("entities.shareRegister.className")}
                value={classForm.name}
                onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Class A Ordinary"
              />
              <Select
                label={t("entities.shareRegister.currency")}
                value={classForm.currency}
                onChange={(e) => setClassForm((f) => ({ ...f, currency: e.target.value }))}
                options={CURRENCY_OPTIONS}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={classForm.no_par_value}
                  onChange={(e) => setClassForm((f) => ({ ...f, no_par_value: e.target.checked, par_value: e.target.checked ? "" : f.par_value }))}
                  className="rounded border-gray-300"
                />
                {t("entities.shareRegister.noParValue")}
              </label>
              {!classForm.no_par_value && (
                <Input
                  label={t("entities.shareRegister.parValue")}
                  type="number"
                  value={classForm.par_value}
                  onChange={(e) => setClassForm((f) => ({ ...f, par_value: e.target.value }))}
                />
              )}
              <Input
                label={t("entities.shareRegister.authorizedShares")}
                type="number"
                value={classForm.authorized_shares}
                onChange={(e) => setClassForm((f) => ({ ...f, authorized_shares: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={classForm.voting_rights}
                  onChange={(e) => setClassForm((f) => ({ ...f, voting_rights: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t("entities.shareRegister.votingRights")}
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowClassModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreateClass} loading={createClassMutation.isPending} disabled={!classForm.name}>
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Issuance Modal */}
      {showIssuanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.shareRegister.addIssuance")}</h3>
            <div className="space-y-4">
              {/* Holder Type Toggle */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("entities.officers.holderType")}
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={holderType === "person" ? "primary" : "secondary"}
                    onClick={() => { setHolderType("person"); setSearch(""); setIssuanceForm((f) => ({ ...f, holder_id: "" })); setQuickCreate(false); }}
                  >
                    {t("entities.shareRegister.personHolder")}
                  </Button>
                  <Button
                    size="sm"
                    variant={holderType === "entity" ? "primary" : "secondary"}
                    onClick={() => { setHolderType("entity"); setSearch(""); setIssuanceForm((f) => ({ ...f, holder_id: "" })); setQuickCreate(false); }}
                  >
                    {t("entities.shareRegister.entityHolder")}
                  </Button>
                </div>
              </div>

              {/* Search or Quick-Create */}
              {!quickCreate ? (
                <>
                  <Input
                    label={holderType === "person" ? t("entities.officers.searchPerson") : t("entities.shareRegister.searchEntity")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={holderType === "person" ? t("entities.officers.searchPerson") : t("entities.shareRegister.searchEntity")}
                  />
                  {search && (
                    <div className="max-h-32 overflow-auto rounded border border-gray-200">
                      {holderType === "person" ? (
                        peopleQuery.isLoading ? (
                          <div className="flex justify-center p-2"><Spinner size="sm" /></div>
                        ) : (
                          (peopleQuery.data?.results ?? []).map((p: Person) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setIssuanceForm((f) => ({ ...f, holder_id: p.id }));
                                setSearch(p.full_name);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                issuanceForm.holder_id === p.id ? "bg-blue-50 font-medium" : ""
                              }`}
                            >
                              {p.full_name}
                            </button>
                          ))
                        )
                      ) : (
                        entitiesQuery.isLoading ? (
                          <div className="flex justify-center p-2"><Spinner size="sm" /></div>
                        ) : (
                          (entitiesQuery.data?.results ?? []).map((e: { id: string; name: string }) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => {
                                setIssuanceForm((f) => ({ ...f, holder_id: e.id }));
                                setSearch(e.name);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                issuanceForm.holder_id === e.id ? "bg-blue-50 font-medium" : ""
                              }`}
                            >
                              {e.name}
                            </button>
                          ))
                        )
                      )}
                    </div>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setQuickCreate(true)}>
                    <PlusIcon className="mr-1 h-3 w-3" />
                    {holderType === "person" ? t("entities.officers.createNewPerson") : t("entities.officers.createNewEntity")}
                  </Button>
                </>
              ) : (
                /* Quick-Create Inline Form */
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">
                      {holderType === "person" ? t("entities.officers.createNewPerson") : t("entities.officers.createNewEntity")}
                    </h4>
                    <button type="button" onClick={() => setQuickCreate(false)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                      <ArrowLeftIcon className="h-3 w-3" />
                      {t("entities.officers.backToSearch")}
                    </button>
                  </div>

                  {holderType === "person" ? (
                    <>
                      {personForm.person_type === "natural" && (
                        <PersonDocumentScan
                          jurisdictions={jurisdictions}
                          onApply={handleScanApply}
                        />
                      )}
                      <Input label={t("people.form.fullName")} value={personForm.full_name} onChange={(e) => setPersonForm((f) => ({ ...f, full_name: e.target.value }))} />
                      <Select
                        label={t("people.form.personType")}
                        value={personForm.person_type}
                        onChange={(e) => setPersonForm((f) => ({ ...f, person_type: e.target.value }))}
                        options={[
                          { value: "natural", label: t("people.form.natural") },
                          { value: "corporate", label: t("people.form.corporate") },
                        ]}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <SearchableSelect label={t("people.form.nationality")} value={personForm.nationality_id} onChange={(val) => setPersonForm((f) => ({ ...f, nationality_id: val }))} options={jurisdictionOptions} />
                        <SearchableSelect label={t("people.form.countryOfResidence")} value={personForm.country_of_residence_id} onChange={(val) => setPersonForm((f) => ({ ...f, country_of_residence_id: val }))} options={jurisdictionOptions} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input label={t("people.form.dateOfBirth")} type="date" value={personForm.date_of_birth} onChange={(e) => setPersonForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                        <Input label={t("people.form.idNumber")} value={personForm.identification_number} onChange={(e) => setPersonForm((f) => ({ ...f, identification_number: e.target.value }))} />
                      </div>
                      <Select
                        label={t("people.form.idType")}
                        value={personForm.identification_type}
                        onChange={(e) => setPersonForm((f) => ({ ...f, identification_type: e.target.value }))}
                        options={[
                          { value: "", label: "—" },
                          { value: "passport", label: t("documents.types.passport") },
                          { value: "cedula", label: t("documents.types.cedula") },
                          { value: "corporate_registry", label: t("documents.types.corporate_registry") },
                        ]}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={personForm.pep_status} onChange={(e) => setPersonForm((f) => ({ ...f, pep_status: e.target.checked }))} className="rounded border-gray-300" />
                        {t("people.form.pepStatus")}
                      </label>
                      <Button
                        size="sm"
                        onClick={handleQuickCreatePerson}
                        loading={createPersonMutation.isPending}
                        disabled={!personForm.full_name}
                      >
                        {t("entities.officers.createAndSelect")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input label={t("entities.form.name")} value={entityForm.name} onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))} />
                      <Select
                        label={t("entities.form.jurisdiction")}
                        value={entityForm.jurisdiction}
                        onChange={(e) => setEntityForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                        options={[
                          { value: "bvi", label: t("entities.form.bvi") },
                          { value: "panama", label: t("entities.form.panama") },
                          { value: "belize", label: t("entities.form.belize") },
                        ]}
                      />
                      <Input label={t("entities.form.incorporationDate")} type="date" value={entityForm.incorporation_date} onChange={(e) => setEntityForm((f) => ({ ...f, incorporation_date: e.target.value }))} />
                      <Select
                        label={t("entities.form.status")}
                        value={entityForm.status}
                        onChange={(e) => setEntityForm((f) => ({ ...f, status: e.target.value }))}
                        options={[
                          { value: "pending", label: t("entities.form.pending") },
                          { value: "active", label: t("entities.form.active") },
                          { value: "dissolved", label: t("entities.form.dissolved") },
                          { value: "struck_off", label: t("entities.form.struckOff") },
                        ]}
                      />
                      <Button
                        size="sm"
                        onClick={handleQuickCreateEntity}
                        loading={createEntityMutation.isPending}
                        disabled={!entityForm.name}
                      >
                        {t("entities.officers.createAndSelect")}
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("entities.shareRegister.numShares")}
                  type="number"
                  value={issuanceForm.num_shares}
                  onChange={(e) => setIssuanceForm((f) => ({ ...f, num_shares: e.target.value }))}
                />
                <Input
                  label={t("entities.shareRegister.certificate")}
                  value={issuanceForm.certificate_number}
                  onChange={(e) => setIssuanceForm((f) => ({ ...f, certificate_number: e.target.value }))}
                />
              </div>
              <Input
                label={t("entities.shareRegister.issueDate")}
                type="date"
                value={issuanceForm.issue_date}
                onChange={(e) => setIssuanceForm((f) => ({ ...f, issue_date: e.target.value }))}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={issuanceForm.is_jtwros}
                  onChange={(e) => setIssuanceForm((f) => ({ ...f, is_jtwros: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                JTWROS
              </label>
              {issuanceForm.is_jtwros && (
                <Input
                  label={t("entities.shareRegister.jtwrosPartner")}
                  value={issuanceForm.jtwros_partner_name}
                  onChange={(e) => setIssuanceForm((f) => ({ ...f, jtwros_partner_name: e.target.value }))}
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={issuanceForm.is_trustee}
                  onChange={(e) => setIssuanceForm((f) => ({ ...f, is_trustee: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t("entities.shareRegister.heldAsTrustee")}
              </label>
              {issuanceForm.is_trustee && (
                <Input
                  label={t("entities.shareRegister.trusteeFor")}
                  value={issuanceForm.trustee_for}
                  onChange={(e) => setIssuanceForm((f) => ({ ...f, trustee_for: e.target.value }))}
                />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={resetIssuanceModal}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreateIssuance}
                loading={createIssuanceMutation.isPending}
                disabled={!issuanceForm.holder_id || !issuanceForm.num_shares}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Issuance Modal */}
      {editingIssuance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.shareRegister.editIssuance")}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">{t("entities.shareRegister.holder")}</p>
                <p className="font-medium">
                  {editingIssuance.shareholder_person?.full_name ?? editingIssuance.shareholder_entity?.name ?? "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("entities.shareRegister.numShares")}
                  type="number"
                  value={editIssuanceForm.num_shares}
                  onChange={(e) => setEditIssuanceForm((f) => ({ ...f, num_shares: e.target.value }))}
                />
                <Input
                  label={t("entities.shareRegister.certificate")}
                  value={editIssuanceForm.certificate_number}
                  onChange={(e) => setEditIssuanceForm((f) => ({ ...f, certificate_number: e.target.value }))}
                />
              </div>
              <Input
                label={t("entities.shareRegister.issueDate")}
                type="date"
                value={editIssuanceForm.issue_date}
                onChange={(e) => setEditIssuanceForm((f) => ({ ...f, issue_date: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editIssuanceForm.is_jtwros}
                  onChange={(e) => setEditIssuanceForm((f) => ({ ...f, is_jtwros: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                JTWROS
              </label>
              {editIssuanceForm.is_jtwros && (
                <Input
                  label={t("entities.shareRegister.jtwrosPartner")}
                  value={editIssuanceForm.jtwros_partner_name}
                  onChange={(e) => setEditIssuanceForm((f) => ({ ...f, jtwros_partner_name: e.target.value }))}
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editIssuanceForm.is_trustee}
                  onChange={(e) => setEditIssuanceForm((f) => ({ ...f, is_trustee: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                {t("entities.shareRegister.heldAsTrustee")}
              </label>
              {editIssuanceForm.is_trustee && (
                <Input
                  label={t("entities.shareRegister.trusteeFor")}
                  value={editIssuanceForm.trustee_for}
                  onChange={(e) => setEditIssuanceForm((f) => ({ ...f, trustee_for: e.target.value }))}
                />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingIssuance(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSaveIssuance}
                loading={updateIssuanceMutation.isPending}
                disabled={!editIssuanceForm.num_shares}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// UBOs Section (computed recursively by backend)
// ---------------------------------------------------------------------------

function UBOsSection({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const treeQuery = useOwnershipTree(entityId, expanded);
  const ubos = treeQuery.data?.ubos ?? [];

  const columns = [
    {
      key: "person",
      header: t("entities.ubos.person"),
      render: (row: UBOEntry) => (
        <button
          type="button"
          onClick={() => navigate(ROUTES.PERSON_DETAIL.replace(":id", row.person.id))}
          className="font-medium text-arifa-navy hover:underline"
        >
          {row.person.full_name}
        </button>
      ),
    },
    {
      key: "via",
      header: t("entities.ubos.via"),
      render: (row: UBOEntry) =>
        row.via.length > 0 ? (
          <span className="text-sm text-gray-500">{row.via.join(" → ")}</span>
        ) : (
          <Badge color="green">{t("entities.ubos.direct")}</Badge>
        ),
    },
    {
      key: "pct",
      header: t("entities.ubos.ownership"),
      render: (row: UBOEntry) => `${row.effective_pct.toFixed(1)}%`,
    },
    {
      key: "pep",
      header: "PEP",
      render: (row: UBOEntry) =>
        row.person.pep_status ? <Badge color="red">PEP</Badge> : <Badge color="green">No</Badge>,
    },
  ];

  return (
    <CollapsibleSection title={t("entities.ubos.title")} onToggle={setExpanded}>
      {expanded && (
        <>
          <p className="mb-3 text-xs text-gray-500">{t("entities.ubos.derivationNote")}</p>
          <DataTable
            columns={columns}
            data={ubos as (UBOEntry & Record<string, unknown>)[]}
            loading={treeQuery.isLoading}
            emptyMessage={t("entities.ubos.noUbos")}
            keyExtractor={(row) => (row as UBOEntry).person.id}
          />
        </>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Org Chart Section (recursive tree from backend)
// ---------------------------------------------------------------------------

function OwnershipNodeCard({
  node,
  navigate,
  t,
}: {
  node: OwnershipNode;
  navigate: ReturnType<typeof useNavigate>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const isPerson = node.type === "person";
  return (
    <div className="flex flex-col items-center">
      {/* Render children (upstream owners) above this node */}
      {node.children.length > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-4">
            {node.children.map((child) => (
              <OwnershipNodeCard key={child.id} node={child} navigate={navigate} t={t} />
            ))}
          </div>
          {node.children.length > 1 && (
            <div
              className="h-0.5 bg-gray-300"
              style={{ width: `${Math.min(node.children.length * 192, 600)}px` }}
            />
          )}
          <div className="h-6 w-0.5 bg-gray-300" />
        </>
      )}

      <button
        type="button"
        onClick={() =>
          navigate(
            isPerson
              ? ROUTES.PERSON_DETAIL.replace(":id", node.id)
              : ROUTES.ENTITY_DETAIL.replace(":id", node.id),
          )
        }
        className="w-44 rounded-lg border border-gray-200 bg-white p-3 text-center shadow-sm transition-shadow hover:shadow-md"
      >
        <Badge color={isPerson ? "gray" : "blue"} className="mb-1">
          {isPerson ? t("entities.orgChart.person") : t("entities.orgChart.entity")}
        </Badge>
        <p className="truncate text-sm font-semibold text-gray-900">{node.name}</p>
        <p className="text-xs text-gray-500">{node.pct.toFixed(1)}%</p>
      </button>
      <div className="h-6 w-0.5 bg-gray-300" />
    </div>
  );
}

function OrgChartSection({ entityId, entityName }: { entityId: string; entityName: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const treeQuery = useOwnershipTree(entityId, expanded);
  const tree = treeQuery.data?.tree ?? [];

  return (
    <CollapsibleSection title={t("entities.orgChart.title")} onToggle={setExpanded}>
      {treeQuery.isLoading ? (
        <div className="flex justify-center py-6"><Spinner size="lg" /></div>
      ) : tree.length === 0 ? (
        <p className="text-center text-sm text-gray-500">{t("entities.orgChart.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full flex-col items-center">
            {/* Recursive shareholder tree */}
            <div className="flex flex-wrap justify-center gap-4">
              {tree.map((node) => (
                <OwnershipNodeCard key={node.id} node={node} navigate={navigate} t={t} />
              ))}
            </div>

            {/* Horizontal connector */}
            {tree.length > 1 && (
              <div
                className="-mt-6 h-0.5 bg-gray-300"
                style={{ width: `${Math.min(tree.length * 192, 800)}px` }}
              />
            )}

            {/* Central connector down to entity */}
            <div className="h-6 w-0.5 bg-gray-300" />

            {/* Target entity node */}
            <div className="inline-flex items-center gap-2 rounded-lg border-2 border-arifa-navy bg-arifa-navy/5 px-4 py-2">
              <svg className="h-5 w-5 text-arifa-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-sm font-semibold text-arifa-navy">{entityName}</span>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CorporateStructureTab({ entityId }: CorporateStructureTabProps) {
  const entityQuery = useEntity(entityId);
  const entityName = entityQuery.data?.name ?? "";

  return (
    <div className="space-y-4">
      <OfficersSection entityId={entityId} />
      <ShareRegisterSection entityId={entityId} />
      <UBOsSection entityId={entityId} />
      <OrgChartSection entityId={entityId} entityName={entityName} />
    </div>
  );
}
