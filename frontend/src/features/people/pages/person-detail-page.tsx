import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import { usePerson, useUpdatePerson } from "../api/people-api";
import { useJurisdictionRisks } from "@/features/admin/api/admin-api";
import { PersonDocumentScan, type PersonFormData } from "../components/person-document-scan";
import { SourceOfWealthTab } from "../components/source-of-wealth-tab";
import { PersonAuditTab } from "../components/audit-tab";
import { PersonRiskAssessmentTab } from "../components/person-risk-assessment-tab";

type Tab = "overview" | "kycParties" | "screening" | "riskAssessment" | "sourceOfWealth" | "auditLog";

const tabs: Tab[] = ["overview", "kycParties", "screening", "riskAssessment", "sourceOfWealth", "auditLog"];

const STATUS_BADGE_COLORS: Record<string, "yellow" | "green" | "red"> = {
  pending_approval: "yellow",
  approved: "green",
  rejected: "red",
};

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: person, isLoading } = usePerson(id!);
  const updateMutation = useUpdatePerson();
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t("common.noResults")}</p>
      </div>
    );
  }

  const handleEdit = () => {
    setFormData({
      full_name: person.full_name,
      last_name: person.last_name,
      person_type: person.person_type,
      nationality_id: person.nationality?.id ?? "",
      country_of_residence_id: person.country_of_residence?.id ?? "",
      date_of_birth: person.date_of_birth ?? "",
      identification_number: person.identification_number,
      identification_type: person.identification_type,
      pep_status: String(person.pep_status),
      status: person.status,
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = { ...formData };
    payload.pep_status = formData.pep_status === "true";
    payload.last_name = formData.last_name ?? "";
    if (!payload.date_of_birth) {
      payload.date_of_birth = null;
    }
    payload.nationality_id = formData.nationality_id || null;
    payload.country_of_residence_id = formData.country_of_residence_id || null;
    updateMutation.mutate(
      { id: id!, data: payload },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(ROUTES.PEOPLE)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{person.full_name}</h1>
            <Badge color={person.person_type === "corporate" ? "blue" : "gray"}>
              {t(`people.form.${person.person_type}`)}
            </Badge>
            <Badge color={STATUS_BADGE_COLORS[person.status] ?? "gray"}>
              {t(`people.status.${person.status}`)}
            </Badge>
            {person.pep_status && (
              <Badge color="red">{t("people.pep")}</Badge>
            )}
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
              {t(`people.detail.tabs.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "overview" && (
          <Card>
            {editing ? (
              <div className="space-y-4">
                <PersonDocumentScan
                  jurisdictions={jurisdictions}
                  onApply={(data: PersonFormData) => {
                    setFormData((p) => ({
                      ...p,
                      ...(data.full_name !== undefined && { full_name: data.full_name }),
                      ...(data.last_name !== undefined && { last_name: data.last_name }),
                      ...(data.date_of_birth !== undefined && { date_of_birth: data.date_of_birth }),
                      ...(data.nationality_id !== undefined && { nationality_id: data.nationality_id }),
                      ...(data.country_of_residence_id !== undefined && { country_of_residence_id: data.country_of_residence_id }),
                      ...(data.identification_number !== undefined && { identification_number: data.identification_number }),
                      ...(data.identification_type !== undefined && { identification_type: data.identification_type }),
                    }));
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("people.form.firstName")}
                  value={formData.full_name ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                />
                <Input
                  label={t("people.form.lastName")}
                  value={formData.last_name ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
                />
                <Select
                  label={t("people.form.personType")}
                  value={formData.person_type ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, person_type: e.target.value }))}
                  options={[
                    { value: "natural", label: t("people.form.natural") },
                    { value: "corporate", label: t("people.form.corporate") },
                  ]}
                />
                <SearchableSelect
                  label={t("people.form.nationality")}
                  value={formData.nationality_id ?? ""}
                  onChange={(val) => setFormData((p) => ({ ...p, nationality_id: val }))}
                  options={jurisdictionOptions}
                />
                <SearchableSelect
                  label={t("people.form.countryOfResidence")}
                  value={formData.country_of_residence_id ?? ""}
                  onChange={(val) =>
                    setFormData((p) => ({ ...p, country_of_residence_id: val }))
                  }
                  options={jurisdictionOptions}
                />
                <Input
                  label={t("people.form.dateOfBirth")}
                  type="date"
                  value={formData.date_of_birth ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, date_of_birth: e.target.value }))}
                />
                <Input
                  label={t("people.form.idNumber")}
                  value={formData.identification_number ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, identification_number: e.target.value }))
                  }
                />
                <Select
                  label={t("people.form.idType")}
                  value={formData.identification_type ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, identification_type: e.target.value }))
                  }
                  options={[
                    { value: "passport", label: t("people.documentTypes.passport") },
                    { value: "cedula", label: t("people.documentTypes.cedula") },
                    { value: "corporate_registry", label: t("people.documentTypes.corporateRegistry") },
                  ]}
                />
                <Select
                  label={t("people.form.pepStatus")}
                  value={formData.pep_status ?? "false"}
                  onChange={(e) => setFormData((p) => ({ ...p, pep_status: e.target.value }))}
                  options={[
                    { value: "false", label: t("people.notPep") },
                    { value: "true", label: t("people.pep") },
                  ]}
                />
                <Select
                  label={t("people.form.status")}
                  value={formData.status ?? "pending_approval"}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  options={[
                    { value: "pending_approval", label: t("people.status.pending_approval") },
                    { value: "approved", label: t("people.status.approved") },
                    { value: "rejected", label: t("people.status.rejected") },
                  ]}
                />
              </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.firstName")}</p>
                  <p className="font-medium">{person.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.lastName")}</p>
                  <p className="font-medium">{person.last_name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.personType")}</p>
                  <p className="font-medium">{t(`people.form.${person.person_type}`)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.nationality")}</p>
                  <p className="font-medium">{person.nationality?.country_name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.countryOfResidence")}</p>
                  <p className="font-medium">{person.country_of_residence?.country_name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.dateOfBirth")}</p>
                  <p className="font-medium">
                    {person.date_of_birth
                      ? new Date(person.date_of_birth).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.idNumber")}</p>
                  <p className="font-mono font-medium">
                    {person.identification_number || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.idType")}</p>
                  <p className="font-medium">{person.identification_type || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.pepStatus")}</p>
                  <Badge color={person.pep_status ? "red" : "green"}>
                    {person.pep_status ? t("people.pep") : t("people.notPep")}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t("people.form.status")}</p>
                  <Badge color={STATUS_BADGE_COLORS[person.status] ?? "gray"}>
                    {t(`people.status.${person.status}`)}
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        )}

        {activeTab === "kycParties" && (
          <Card className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-500">{t("common.noResults")}</p>
          </Card>
        )}

        {activeTab === "screening" && (
          <Card className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-500">{t("common.noResults")}</p>
          </Card>
        )}

        {activeTab === "riskAssessment" && (
          <PersonRiskAssessmentTab personId={id!} />
        )}

        {activeTab === "sourceOfWealth" && (
          <SourceOfWealthTab personId={id!} />
        )}

        {activeTab === "auditLog" && (
          <PersonAuditTab personId={id!} />
        )}
      </div>
    </div>
  );
}
