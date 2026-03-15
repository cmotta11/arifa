import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  accept?: Accept;
  maxSize?: number;
  label?: string;
  multiple?: boolean;
  className?: string;
}

export function FileDropzone({
  onDrop,
  accept,
  maxSize,
  label = "Drag and drop files here, or click to select",
  multiple = false,
  className = "",
}: FileDropzoneProps) {
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      onDrop(acceptedFiles);
    },
    [onDrop],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: handleDrop,
      accept,
      maxSize,
      multiple,
    });

  return (
    <div
      {...getRootProps()}
      className={`
        flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed
        px-6 py-8 transition-colors duration-150
        ${
          isDragActive && !isDragReject
            ? "border-primary bg-primary/5"
            : isDragReject
              ? "border-error bg-red-50"
              : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
        }
        ${className}
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
          isDragActive ? "text-primary font-medium" : "text-gray-500"
        }`}
      >
        {isDragActive && !isDragReject
          ? "Drop files here..."
          : isDragReject
            ? "File type not accepted"
            : label}
      </p>
      {maxSize && (
        <p className="mt-1 text-xs text-gray-400">
          Max size: {(maxSize / 1024 / 1024).toFixed(0)} MB
        </p>
      )}
    </div>
  );
}
