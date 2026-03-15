import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
  ArrowUpTrayIcon,
  DocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface FileUploadProps {
  accept?: Accept;
  maxSize?: number;
  maxFiles?: number;
  value?: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  error?: string;
  progress?: Record<string, number>;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function FileUpload({
  accept,
  maxSize,
  maxFiles = 0,
  value = [],
  onChange,
  disabled = false,
  error,
  progress,
  className = "",
}: FileUploadProps) {
  const { t } = useTranslation();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  // Generate previews for image files
  useEffect(() => {
    const newPreviews = new Map<string, string>();
    const urls: string[] = [];

    for (const file of value) {
      if (isImageFile(file)) {
        const url = URL.createObjectURL(file);
        newPreviews.set(file.name + file.size, url);
        urls.push(url);
      }
    }

    setPreviews(newPreviews);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [value]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejections: FileRejection[]) => {
      const errors: string[] = [];

      for (const rejection of rejections) {
        for (const err of rejection.errors) {
          if (err.code === "file-too-large") {
            errors.push(
              t("fileUpload.fileTooLarge", {
                name: rejection.file.name,
                maxSize: maxSize ? formatFileSize(maxSize) : "",
              }),
            );
          } else if (err.code === "file-invalid-type") {
            errors.push(
              t("fileUpload.invalidType", { name: rejection.file.name }),
            );
          } else if (err.code === "too-many-files") {
            errors.push(t("fileUpload.tooManyFiles", { max: maxFiles }));
          } else {
            errors.push(err.message);
          }
        }
      }

      setValidationErrors(errors);

      if (acceptedFiles.length > 0) {
        const combined = [...value, ...acceptedFiles];
        const limited =
          maxFiles > 0 ? combined.slice(0, maxFiles) : combined;
        onChange(limited);
      }
    },
    [value, onChange, maxFiles, maxSize, t],
  );

  const removeFile = useCallback(
    (index: number) => {
      const updated = value.filter((_, i) => i !== index);
      onChange(updated);
      setValidationErrors([]);
    },
    [value, onChange],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept,
      maxSize,
      maxFiles: maxFiles > 0 ? maxFiles : undefined,
      multiple: maxFiles !== 1,
      disabled,
    });

  const hasFiles = value.length > 0;
  const displayError = error || (validationErrors.length > 0 ? validationErrors[0] : undefined);

  const acceptedExtensions = useMemo(() => {
    if (!accept) return null;
    const exts: string[] = [];
    for (const mimeExts of Object.values(accept)) {
      exts.push(...mimeExts);
    }
    return exts.length > 0 ? exts.join(", ") : null;
  }, [accept]);

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed
          px-6 py-8 transition-colors duration-150
          ${disabled ? "cursor-not-allowed opacity-50" : ""}
          ${
            isDragActive && !isDragReject
              ? "border-primary bg-primary/5"
              : isDragReject
                ? "border-error bg-red-50"
                : displayError
                  ? "border-error hover:border-error/70"
                  : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
          }
        `}
      >
        <input {...getInputProps()} />
        <ArrowUpTrayIcon
          className={`mb-3 h-8 w-8 ${
            isDragActive ? "text-primary" : "text-gray-400"
          }`}
        />
        <p
          className={`text-sm ${
            isDragActive
              ? "font-medium text-primary"
              : "text-gray-500"
          }`}
        >
          {isDragActive && !isDragReject
            ? t("fileUpload.dropHere")
            : isDragReject
              ? t("fileUpload.invalidType", { name: "" })
              : t("fileUpload.dragOrClick")}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
          {maxSize && (
            <span>
              {t("fileUpload.maxSize", {
                size: formatFileSize(maxSize),
              })}
            </span>
          )}
          {acceptedExtensions && <span>{acceptedExtensions}</span>}
          {maxFiles > 0 && (
            <span>
              {t("fileUpload.maxFiles", { count: maxFiles })}
            </span>
          )}
        </div>
      </div>

      {/* Error display */}
      {displayError && (
        <p className="mt-1 text-sm text-error">{displayError}</p>
      )}

      {/* File list */}
      {hasFiles && (
        <ul className="mt-3 space-y-2">
          {value.map((file, index) => {
            const key = file.name + file.size + index;
            const previewUrl = previews.get(file.name + file.size);
            const fileProgress = progress?.[file.name];

            return (
              <li
                key={key}
                className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
              >
                {/* Thumbnail or icon */}
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-10 w-10 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <DocumentIcon className="h-10 w-10 flex-shrink-0 text-gray-400" />
                )}

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                  {/* Progress bar */}
                  {fileProgress !== undefined && fileProgress < 100 && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${fileProgress}%` }}
                        role="progressbar"
                        aria-valuenow={fileProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="flex-shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label={t("common.remove")}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
