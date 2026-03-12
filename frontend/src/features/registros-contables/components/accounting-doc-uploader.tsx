import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDropzone } from "@/components/forms/file-dropzone";
import { Spinner } from "@/components/ui/spinner";
import { DocumentIcon } from "@heroicons/react/24/outline";
import type { AccountingRecordDocument } from "../api/registros-contables-api";
import {
  useUploadAccountingDocument,
  useGuestAccountingDocuments,
} from "../api/registros-contables-api";

interface AccountingDocUploaderProps {
  recordId: string;
}

export function AccountingDocUploader({ recordId }: AccountingDocUploaderProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useGuestAccountingDocuments(recordId);
  const uploadMutation = useUploadAccountingDocument();

  const handleDrop = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadMutation.mutateAsync({ id: recordId, file });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        {t("registrosContables.guest.supportingDocuments")}
        <span className="ml-1 text-xs text-gray-400">
          ({t("registrosContables.guest.optional")})
        </span>
      </label>

      <FileDropzone
        onDrop={handleDrop}
        multiple
        accept={{
          "application/pdf": [".pdf"],
          "image/*": [".png", ".jpg", ".jpeg"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          "application/vnd.ms-excel": [".xls"],
        }}
        maxSize={20 * 1024 * 1024}
        label={t("registrosContables.guest.dropDocuments")}
      />

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner size="sm" />
          {t("registrosContables.guest.uploading")}
        </div>
      )}

      {isLoading ? (
        <Spinner size="sm" />
      ) : documents && documents.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {documents.map((doc: AccountingRecordDocument) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <DocumentIcon className="h-5 w-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-gray-700">
                  {doc.original_filename}
                </p>
                <p className="text-xs text-gray-400">
                  {(doc.file_size / 1024).toFixed(0)} KB
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
