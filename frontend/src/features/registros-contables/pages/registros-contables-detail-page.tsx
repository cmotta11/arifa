import { useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, Transition } from "@headlessui/react";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { AccountingStatusBadge } from "../components/status-badge";
import {
  useAccountingRecord,
  useAccountingRecordDocuments,
  useApproveAccountingRecord,
  useRejectAccountingRecord,
  type AccountingRecord,
} from "../api/registros-contables-api";
import { HelpButton } from "@/components/feedback/help-button";

export default function RegistrosContablesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: record, isLoading } = useAccountingRecord(id!);
  const { data: documents } = useAccountingRecordDocuments(id!);
  const approveMut = useApproveAccountingRecord();
  const rejectMut = useRejectAccountingRecord();

  const [reviewNotes, setReviewNotes] = useState("");
  const [showReviewModal, setShowReviewModal] = useState<"approve" | "reject" | null>(null);
  const [reviewError, setReviewError] = useState("");

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex justify-center p-12">
        <p className="text-sm text-red-600">{t("common.error")}</p>
      </div>
    );
  }

  const handleReview = async () => {
    if (!showReviewModal) return;
    setReviewError("");
    try {
      if (showReviewModal === "approve") {
        await approveMut.mutateAsync({ id: id!, review_notes: reviewNotes });
      } else {
        await rejectMut.mutateAsync({ id: id!, review_notes: reviewNotes });
      }
      setShowReviewModal(null);
      setReviewNotes("");
    } catch {
      setReviewError(t("common.error"));
    }
  };

  const guestLinkUrl = record.guest_link_token
    ? `${window.location.origin}/registros-contables/guest/${record.guest_link_token}`
    : null;

  const copyGuestLink = () => {
    if (guestLinkUrl) navigator.clipboard.writeText(guestLinkUrl);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.REGISTROS_CONTABLES)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("common.back")}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {record.entity_name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("registrosContables.fiscalYear")} {record.fiscal_year}
            {record.client_name && ` — ${record.client_name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AccountingStatusBadge status={record.status} />
          {guestLinkUrl && (
            <Button variant="secondary" size="sm" onClick={copyGuestLink}>
              {t("registrosContables.staff.copyLink")}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(`/registros-contables/${id}/print`, "_blank")}
          >
            {t("registrosContables.staff.print")}
          </Button>
        </div>
      </div>

      {/* Record info */}
      <Card>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-medium text-gray-500">{t("registrosContables.formType")}</dt>
            <dd className="mt-1 text-gray-900">{record.form_type_display || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t("registrosContables.status")}</dt>
            <dd className="mt-1"><AccountingStatusBadge status={record.status} /></dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t("registrosContables.submittedAt")}</dt>
            <dd className="mt-1 text-gray-900">
              {record.submitted_at
                ? new Date(record.submitted_at).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t("registrosContables.staff.reviewedBy")}</dt>
            <dd className="mt-1 text-gray-900">{record.reviewed_by_email || "—"}</dd>
          </div>
        </dl>
      </Card>

      {/* Form data display */}
      {record.form_type && (
        <Card>
          <FormDataDisplay record={record} />
        </Card>
      )}

      {/* Signature */}
      {record.signature_data && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            {t("registrosContables.guest.signature")}
          </h3>
          <div className="inline-block rounded border border-gray-200 p-2">
            {record.signature_data.startsWith("data:image/") ? (
              <img src={record.signature_data} alt="Signature" className="max-h-24" />
            ) : (
              <p className="text-sm text-gray-400">{t("common.invalidImage")}</p>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">{record.signer_name}</span>
            {record.signer_identification && ` — ${record.signer_identification}`}
          </div>
        </Card>
      )}

      {/* Documents */}
      {documents && documents.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            {t("registrosContables.print.documents")}
          </h3>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-700">{doc.original_filename}</span>
                <span className="text-xs text-gray-400">
                  {(doc.file_size / 1024).toFixed(0)} KB
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Review notes if any */}
      {record.review_notes && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            {t("registrosContables.staff.reviewNotes")}
          </h3>
          <p className="text-sm text-gray-600">{record.review_notes}</p>
        </Card>
      )}

      {/* Approve / Reject buttons */}
      {record.status === "submitted" && (
        <div className="flex gap-3">
          <Button onClick={() => setShowReviewModal("approve")}>
            {t("registrosContables.staff.approve")}
          </Button>
          <Button variant="danger" onClick={() => setShowReviewModal("reject")}>
            {t("registrosContables.staff.reject")}
          </Button>
        </div>
      )}

      {/* Review modal (Headless UI Dialog) */}
      <Transition appear show={showReviewModal !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setShowReviewModal(null);
            setReviewNotes("");
            setReviewError("");
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                  <Dialog.Title className="mb-2 text-lg font-semibold text-gray-900">
                    {showReviewModal === "approve"
                      ? t("registrosContables.staff.approveTitle")
                      : t("registrosContables.staff.rejectTitle")}
                  </Dialog.Title>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    placeholder={t("registrosContables.staff.reviewNotesPlaceholder")}
                    className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  {reviewError && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {reviewError}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowReviewModal(null);
                        setReviewNotes("");
                        setReviewError("");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant={showReviewModal === "approve" ? "primary" : "danger"}
                      onClick={handleReview}
                      loading={approveMut.isPending || rejectMut.isPending}
                    >
                      {t("common.confirm")}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      <HelpButton module="accounting_records" entityId={record?.entity} currentPage="registros-detail" />
    </div>
  );
}

// ─── Inline Form Data Display ─────────────────────────────────────────────────

function FormDataDisplay({ record }: { record: AccountingRecord }) {
  const { t } = useTranslation();
  const data = record.form_data || {};

  if (record.form_type === "no_operations") {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          {record.form_type_display}
        </h3>
        <p className="text-sm text-gray-600">
          {t("registrosContables.guest.noOperationsDeclaration")}
        </p>
      </div>
    );
  }

  if (record.form_type === "panama_assets") {
    const countries = (data.asset_countries as string[]) || [];
    return (
      <div className="space-y-3">
        <div className="text-center space-y-1">
          <h3 className="text-sm font-bold text-gray-900 uppercase">
            {t("registrosContables.panamaAssets.formTitle")}
          </h3>
          <p className="text-xs font-medium text-gray-600 uppercase">
            {t("registrosContables.panamaAssets.subtitle")}
          </p>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {t("registrosContables.panamaAssets.introText")}
        </p>
        <ol className="list-decimal ml-5 space-y-1 text-sm text-gray-600">
          <li>
            {t("registrosContables.panamaAssets.requirement1")}{" "}
            <span className="font-medium text-gray-900">
              {countries.length > 0 ? countries.join(", ") : "—"}
            </span>
          </li>
          <li>{t("registrosContables.panamaAssets.requirement2")}</li>
          <li>{t("registrosContables.panamaAssets.requirement3")}</li>
        </ol>
      </div>
    );
  }

  if (record.form_type === "balance_general") {
    const getNum = (section: string, key: string) => {
      const s = data[section] as Record<string, unknown> | undefined;
      if (!s) return 0;
      return Number(s[key]) || 0;
    };
    const fmt = (n: number) =>
      "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

    const totalAssets =
      getNum("assets", "cash") +
      getNum("assets", "investments_deposits") +
      getNum("assets", "fixed_assets") +
      getNum("assets", "other_assets");
    const totalLiabilities =
      getNum("liabilities", "bank_debt") +
      getNum("liabilities", "other_liabilities");

    return (
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          {record.form_type_display}
        </h3>
        <table className="w-full text-sm">
          <tbody>
            {[
              { section: "assets", keys: ["cash", "investments_deposits", "fixed_assets", "other_assets"] },
              { section: "liabilities", keys: ["bank_debt", "other_liabilities"] },
              { section: "income", keys: ["interest", "dividends", "rent", "other_income"] },
            ].map(({ section, keys }) => (
              <Fragment key={section}>
                <tr className="border-b border-gray-200">
                  <td className="py-2 font-semibold text-gray-700" colSpan={2}>
                    {t(`registrosContables.balanceSections.${section}`)}
                  </td>
                </tr>
                {keys.map((k) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-1 pl-4 text-gray-600">
                      {t(`registrosContables.balanceFields.${k}`)}
                    </td>
                    <td className="py-1 text-right text-gray-900">
                      {fmt(getNum(section, k))}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="border-t-2 border-gray-300">
              <td className="py-2 font-semibold text-primary">
                {t("registrosContables.balanceSections.equity")}
              </td>
              <td className="py-2 text-right font-bold text-primary">
                {fmt(totalAssets - totalLiabilities)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (record.form_type === "exempt_license") {
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          {record.form_type_display}
        </h3>
        <p className="text-sm text-gray-600">
          {t("registrosContables.guest.exemptDeclaration")}
        </p>
        {(data.license_number as string) && (
          <p className="mt-2 text-sm text-gray-900">
            <span className="font-medium">{t("registrosContables.guest.licenseNumber")}:</span>{" "}
            {data.license_number as string}
          </p>
        )}
      </div>
    );
  }

  return null;
}
