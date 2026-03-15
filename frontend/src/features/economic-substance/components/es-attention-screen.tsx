import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

interface ESAttentionScreenProps {
  attentionReason: string;
  entityName: string;
}

export function ESAttentionScreen({
  attentionReason,
  entityName,
}: ESAttentionScreenProps) {
  const { t } = useTranslation();

  return (
    <Card className="mx-auto max-w-lg text-center">
      <div className="space-y-6 py-4">
        {/* Alert icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {t("es.attention.title")}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {t("es.attention.subtitle", { entity: entityName })}
          </p>
        </div>

        {/* Reason box */}
        {attentionReason && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-left">
            <p className="text-sm font-medium text-yellow-800">
              {t("es.attention.reasonLabel")}
            </p>
            <p className="mt-1 text-sm text-yellow-700">{attentionReason}</p>
          </div>
        )}

        {/* Contact info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">
            {t("es.attention.contactTitle")}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {t("es.attention.contactDescription")}
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{t("es.attention.email")}:</span>{" "}
              {t("economicSubstance.attention.emailValue", "compliance@arifa.com")}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{t("es.attention.phone")}:</span>{" "}
              {t("economicSubstance.attention.phoneValue", "+507 300-0000")}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
