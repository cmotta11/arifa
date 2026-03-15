import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/overlay/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/overlay/toast";

interface HelpButtonProps {
  module: string; // "kyc" | "economic_substance" | "accounting_records"
  entityId?: string;
  currentPage?: string;
}

export function HelpButton({ module, entityId, currentPage }: HelpButtonProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post("/compliance/help-request/", {
        module,
        entity_id: entityId || undefined,
        current_page: currentPage,
        message: message || undefined,
      });
      setIsOpen(false);
      setMessage("");
      toast.success(
        t(
          "helpRequest.success",
          "Help request sent! Our team will contact you shortly.",
        ),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.warning(
          t(
            "helpRequest.rateLimited",
            "Please wait before sending another request",
          ),
        );
      } else {
        toast.error(
          t("helpRequest.error", "Failed to send help request. Please try again."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const moduleLabels: Record<string, string> = {
    kyc: t("nav.kyc", "KYC Submissions"),
    economic_substance: t("nav.economicSubstance", "Economic Substance"),
    accounting_records: t("nav.registrosContables", "Accounting Records"),
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
        aria-label={t("helpRequest.button", "Need Help?")}
      >
        <QuestionMarkCircleIcon className="h-6 w-6" aria-hidden="true" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("helpRequest.title", "Need Help?")}
        size="md"
      >
        <div className="space-y-4">
          {/* Module (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t("helpRequest.module", "Module")}
            </label>
            <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {moduleLabels[module] || module}
            </div>
          </div>

          {/* Entity */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t("common.entity", "Entity")}
            </label>
            {entityId ? (
              <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {entityId}
              </div>
            ) : (
              <div className="mt-1 text-sm italic text-gray-400">
                {t("common.noEntitySelected", "No entity selected")}
              </div>
            )}
          </div>

          {/* Message */}
          <Textarea
            label={t("helpRequest.message", "Message")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t(
              "helpRequest.messagePlaceholder",
              "Describe your question or issue...",
            )}
            rows={4}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {t("common.submit", "Submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
