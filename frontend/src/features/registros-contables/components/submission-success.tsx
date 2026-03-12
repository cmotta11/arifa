import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface SubmissionSuccessProps {
  entityName: string;
  submittedAt: string;
  recordId: string;
  guestToken?: string;
}

export function SubmissionSuccess({
  entityName,
  submittedAt,
  recordId,
  guestToken,
}: SubmissionSuccessProps) {
  const { t } = useTranslation();

  const formattedDate = new Date(submittedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => {
    const tokenParam = guestToken ? `?token=${guestToken}` : "";
    window.open(`/registros-contables/${recordId}/print${tokenParam}`, "_blank");
  };

  return (
    <Card className="mx-auto max-w-md text-center">
      <div className="py-8">
        <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          {t("registrosContables.guest.submissionSuccess")}
        </h2>
        <p className="mb-1 text-sm text-gray-700 font-medium">{entityName}</p>
        <p className="mb-6 text-sm text-gray-500">{formattedDate}</p>
        <p className="mb-6 text-sm text-gray-500">
          {t("registrosContables.guest.submissionSuccessDescription")}
        </p>
        <Button onClick={handlePrint}>
          {t("registrosContables.guest.printDownload")}
        </Button>
      </div>
    </Card>
  );
}
