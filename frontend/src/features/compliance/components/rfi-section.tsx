import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/overlay/modal";
import { FormField } from "@/components/forms/form-field";
import type { RFI } from "@/types";
import { useKYCRFIs, useCreateRFI, useRespondToRFI } from "../api/compliance-api";
import { formatDateTime } from "@/lib/format";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rfiStatusColor: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  open: "yellow",
  responded: "blue",
  closed: "green",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RFISectionProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RFISection({ kycId }: RFISectionProps) {
  const { t } = useTranslation("compliance");
  const rfisQuery = useKYCRFIs(kycId);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (rfisQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (rfisQuery.isError) {
    return (
      <Card>
        <div className="py-6 text-center text-sm text-error">
          {t("rfi.errorLoading")}
        </div>
      </Card>
    );
  }

  const rfis = rfisQuery.data ?? [];

  // Sort by most recent first
  const sorted = [...rfis].sort(
    (a, b) =>
      new Date(b.responded_at ?? b.created_at ?? 0).getTime() -
      new Date(a.responded_at ?? a.created_at ?? 0).getTime(),
  );

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("rfi.title")}
        </h3>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
        >
          {t("rfi.create")}
        </Button>
      </div>

      {/* RFI List */}
      {sorted.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">{t("rfi.empty")}</p>
            <p className="mt-1 text-sm text-gray-500">{t("rfi.emptyDescription")}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((rfi) => (
            <RFICard key={rfi.id} rfi={rfi} kycId={kycId} />
          ))}
        </div>
      )}

      {/* Create RFI Modal */}
      <CreateRFIModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        kycId={kycId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RFI Card
// ---------------------------------------------------------------------------

function RFICard({ rfi, kycId }: { rfi: RFI; kycId: string }) {
  const { t } = useTranslation("compliance");
  const [showRespond, setShowRespond] = useState(false);
  const [responseText, setResponseText] = useState("");
  const respondMutation = useRespondToRFI();

  function handleRespond() {
    if (!responseText.trim()) return;
    respondMutation.mutate(
      { rfiId: rfi.id, kycId, response_text: responseText.trim() },
      {
        onSuccess: () => {
          setShowRespond(false);
          setResponseText("");
        },
      },
    );
  }

  const requestedByName =
    typeof rfi.requested_by === "object" && rfi.requested_by
      ? `${rfi.requested_by.first_name} ${rfi.requested_by.last_name}`
      : String(rfi.requested_by ?? t("rfi.system"));

  return (
    <Card>
      {/* RFI Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {t("rfi.requestLabel")}
            </span>
            <Badge color={rfiStatusColor[rfi.status] ?? "gray"}>
              {t(`rfiStatus.${rfi.status}`)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("rfi.requestedBy")}: {requestedByName}
          </p>
        </div>
        <time className="flex-shrink-0 text-xs text-gray-400">
          {formatDateTime(rfi.responded_at ?? null)}
        </time>
      </div>

      {/* Requested fields */}
      {rfi.requested_fields.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">
            {t("rfi.requestedFields")}:
          </p>
          <div className="flex flex-wrap gap-1">
            {rfi.requested_fields.map((field) => (
              <span
                key={field}
                className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {rfi.notes && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">{t("rfi.notes")}:</p>
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {rfi.notes}
          </p>
        </div>
      )}

      {/* Response */}
      {rfi.response_text && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">{t("rfi.response")}:</p>
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {rfi.response_text}
          </p>
          {rfi.responded_at && (
            <p className="mt-1 text-xs text-gray-400">
              {t("rfi.respondedAt")}: {formatDateTime(rfi.responded_at)}
            </p>
          )}
        </div>
      )}

      {/* Respond Action (only for open RFIs) */}
      {rfi.status === "open" && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          {showRespond ? (
            <div className="space-y-3">
              <textarea
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                  placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                placeholder={t("rfi.responsePlaceholder")}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={respondMutation.isPending}
                  disabled={!responseText.trim()}
                  onClick={handleRespond}
                >
                  {t("rfi.submitResponse")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowRespond(false);
                    setResponseText("");
                  }}
                >
                  {t("actions.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRespond(true)}
            >
              {t("rfi.respond")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create RFI Modal
// ---------------------------------------------------------------------------

function CreateRFIModal({
  isOpen,
  onClose,
  kycId,
}: {
  isOpen: boolean;
  onClose: () => void;
  kycId: string;
}) {
  const { t } = useTranslation("compliance");
  const createMutation = useCreateRFI();

  const [fieldInput, setFieldInput] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  function handleAddField() {
    const trimmed = fieldInput.trim();
    if (trimmed && !fields.includes(trimmed)) {
      setFields((prev) => [...prev, trimmed]);
      setFieldInput("");
    }
  }

  function handleRemoveField(field: string) {
    setFields((prev) => prev.filter((f) => f !== field));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddField();
    }
    if (e.key === "Backspace" && !fieldInput && fields.length > 0) {
      setFields((prev) => prev.slice(0, -1));
    }
  }

  function handleSubmit() {
    if (fields.length === 0) return;
    createMutation.mutate(
      { kycId, requested_fields: fields, notes: notes.trim() },
      {
        onSuccess: () => {
          setFields([]);
          setNotes("");
          setFieldInput("");
          onClose();
        },
      },
    );
  }

  function handleClose() {
    if (!createMutation.isPending) {
      setFields([]);
      setNotes("");
      setFieldInput("");
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("rfi.createTitle")}>
      <div className="space-y-4">
        {/* Tag Input for requested fields */}
        <FormField label={t("rfi.requestedFieldsLabel")} required>
          <div className="rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <div className="flex flex-wrap gap-1">
              {fields.map((field) => (
                <span
                  key={field}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {field}
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-gray-400"
                placeholder={
                  fields.length === 0
                    ? t("rfi.fieldInputPlaceholder")
                    : t("rfi.fieldInputPlaceholderMore")
                }
                value={fieldInput}
                onChange={(e) => setFieldInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAddField}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t("rfi.fieldInputHelp")}
          </p>
        </FormField>

        {/* Notes */}
        <FormField label={t("rfi.notesLabel")}>
          <textarea
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
              placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder={t("rfi.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={fields.length === 0}
          >
            {t("rfi.createSubmit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
