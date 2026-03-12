import { useTranslation } from "react-i18next";
import type { AccountingRecord, AccountingRecordDocument } from "../api/registros-contables-api";

interface PrintViewProps {
  record: AccountingRecord;
  documents?: AccountingRecordDocument[];
}

function getNum(obj: Record<string, unknown> | undefined, key: string): number {
  if (!obj) return 0;
  const val = obj[key];
  return typeof val === "number" ? val : Number(val) || 0;
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function PrintView({ record, documents }: PrintViewProps) {
  const { t } = useTranslation();
  const data = record.form_data || {};

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="mb-8 border-b-2 border-arifa-navy pb-4">
        <h1 className="text-2xl font-bold text-arifa-navy">ARIFA</h1>
        <p className="text-sm text-gray-500">
          {t("registrosContables.print.title")} — {t("registrosContables.print.fiscalYear")} {record.fiscal_year}
        </p>
      </div>

      {/* Entity Info */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
          {t("registrosContables.print.entityInfo")}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="font-medium text-gray-700">{t("registrosContables.entity")}</dt>
          <dd className="text-gray-900">{record.entity_name}</dd>
          {record.client_name && (
            <>
              <dt className="font-medium text-gray-700">{t("registrosContables.client")}</dt>
              <dd className="text-gray-900">{record.client_name}</dd>
            </>
          )}
          <dt className="font-medium text-gray-700">{t("registrosContables.formType")}</dt>
          <dd className="text-gray-900">{record.form_type_display}</dd>
          <dt className="font-medium text-gray-700">{t("registrosContables.status")}</dt>
          <dd className="text-gray-900">{record.status_display}</dd>
        </dl>
      </section>

      {/* Form Data */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
          {t("registrosContables.print.formData")}
        </h2>

        {record.form_type === "no_operations" && (
          <p className="text-sm text-gray-700">
            {t("registrosContables.guest.noOperationsDeclaration")}
          </p>
        )}

        {record.form_type === "panama_assets" && (() => {
          const countries = (data.asset_countries as string[]) || [];
          return (
            <div className="space-y-3">
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-gray-900 uppercase">
                  {t("registrosContables.panamaAssets.formTitle")}
                </p>
                <p className="text-xs font-medium text-gray-600 uppercase">
                  {t("registrosContables.panamaAssets.subtitle")}
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {t("registrosContables.panamaAssets.introText")}
              </p>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-gray-700">
                <li>
                  {t("registrosContables.panamaAssets.requirement1")}{" "}
                  <span className="font-medium">{countries.length > 0 ? countries.join(", ") : "—"}</span>
                </li>
                <li>{t("registrosContables.panamaAssets.requirement2")}</li>
                <li>{t("registrosContables.panamaAssets.requirement3")}</li>
              </ol>
            </div>
          );
        })()}

        {record.form_type === "balance_general" && (
          <div className="space-y-4 text-sm">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td colSpan={2} className="py-2 font-semibold text-gray-700">
                    {t("registrosContables.balanceSections.assets")}
                  </td>
                </tr>
                {["cash", "investments_deposits", "fixed_assets", "other_assets"].map((k) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-1 pl-4 text-gray-600">
                      {t(`registrosContables.balanceFields.${k}`)}
                    </td>
                    <td className="py-1 text-right text-gray-900">
                      {fmt(getNum(data.assets as Record<string, unknown>, k))}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-200">
                  <td colSpan={2} className="py-2 font-semibold text-gray-700">
                    {t("registrosContables.balanceSections.liabilities")}
                  </td>
                </tr>
                {["bank_debt", "other_liabilities"].map((k) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-1 pl-4 text-gray-600">
                      {t(`registrosContables.balanceFields.${k}`)}
                    </td>
                    <td className="py-1 text-right text-gray-900">
                      {fmt(getNum(data.liabilities as Record<string, unknown>, k))}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-200">
                  <td colSpan={2} className="py-2 font-semibold text-gray-700">
                    {t("registrosContables.balanceSections.income")}
                  </td>
                </tr>
                {["interest", "dividends", "rent", "other_income"].map((k) => (
                  <tr key={k} className="border-b border-gray-100">
                    <td className="py-1 pl-4 text-gray-600">
                      {t(`registrosContables.balanceFields.${k}`)}
                    </td>
                    <td className="py-1 text-right text-gray-900">
                      {fmt(getNum(data.income as Record<string, unknown>, k))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {record.form_type === "exempt_license" && (
          <div>
            <p className="text-sm text-gray-700 mb-2">
              {t("registrosContables.guest.exemptDeclaration")}
            </p>
            {(data.license_number as string) && (
              <p className="text-sm text-gray-900">
                <span className="font-medium">{t("registrosContables.guest.licenseNumber")}:</span>{" "}
                {data.license_number as string}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Signer Info */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
          {t("registrosContables.print.signerInfo")}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="font-medium text-gray-700">{t("registrosContables.guest.signerName")}</dt>
          <dd className="text-gray-900">{record.signer_name || "—"}</dd>
          <dt className="font-medium text-gray-700">{t("registrosContables.guest.signerIdentification")}</dt>
          <dd className="text-gray-900">{record.signer_identification || "—"}</dd>
        </dl>
      </section>

      {/* Signature */}
      {record.signature_data && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
            {t("registrosContables.guest.signature")}
          </h2>
          <div className="inline-block rounded border border-gray-200 p-2">
            <img src={record.signature_data} alt="Signature" className="max-h-24" />
          </div>
        </section>
      )}

      {/* Documents */}
      {documents && documents.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">
            {t("registrosContables.print.documents")}
          </h2>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {documents.map((doc) => (
              <li key={doc.id}>{doc.original_filename}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Timestamp */}
      {record.submitted_at && (
        <section className="border-t border-gray-200 pt-4 text-sm text-gray-500">
          {t("registrosContables.print.submittedAt")}:{" "}
          {new Date(record.submitted_at).toLocaleString()}
        </section>
      )}

      {/* Print button (hidden in print) */}
      <div className="mt-8 text-center print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-arifa-navy px-6 py-2 text-sm font-medium text-white hover:bg-arifa-navy-dark"
        >
          {t("registrosContables.guest.printDownload")}
        </button>
      </div>
    </div>
  );
}
