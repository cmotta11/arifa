import { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Transition } from "@headlessui/react";
import { Button } from "@/components/ui/button";
import { useBulkCreateAccountingRecords } from "../api/registros-contables-api";

interface BulkSendButtonProps {
  fiscalYear: number;
}

export function BulkSendButton({ fiscalYear }: BulkSendButtonProps) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const bulkCreate = useBulkCreateAccountingRecords();

  const handleConfirm = async () => {
    setError("");
    try {
      await bulkCreate.mutateAsync(fiscalYear);
      setShowConfirm(false);
    } catch {
      setError(t("common.error"));
    }
  };

  return (
    <>
      <Button onClick={() => setShowConfirm(true)}>
        {t("registrosContables.staff.bulkSend")}
      </Button>

      <Transition appear show={showConfirm} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (!bulkCreate.isPending) {
              setShowConfirm(false);
              setError("");
            }
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
                    {t("registrosContables.staff.bulkSendConfirmTitle")}
                  </Dialog.Title>
                  <p className="mb-6 text-sm text-gray-500">
                    {t("registrosContables.staff.bulkSendConfirmDescription", {
                      year: fiscalYear,
                    })}
                  </p>
                  {error && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowConfirm(false);
                        setError("");
                      }}
                      disabled={bulkCreate.isPending}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={handleConfirm}
                      loading={bulkCreate.isPending}
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
    </>
  );
}
