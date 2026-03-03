import { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Transition } from "@headlessui/react";
import { LinkIcon, ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { useCreateGuestLink } from "../api/kyc-api";

interface ShareGuestLinkButtonProps {
  kycId: string;
}

export function ShareGuestLinkButton({ kycId }: ShareGuestLinkButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const createGuestLink = useCreateGuestLink();

  const handleClick = () => {
    createGuestLink.mutate(kycId, {
      onSuccess: () => {
        setIsOpen(true);
        setCopied(false);
      },
    });
  };

  const guestUrl = createGuestLink.data
    ? `${window.location.origin}/guest/${createGuestLink.data.token}`
    : "";

  const expiresFormatted = createGuestLink.data
    ? new Date(createGuestLink.data.expires_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        loading={createGuestLink.isPending}
      >
        <LinkIcon className="mr-1.5 h-4 w-4" />
        {t("kyc.shareLink.button")}
      </Button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsOpen(false)}
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
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {t("kyc.shareLink.title")}
                  </Dialog.Title>

                  <p className="mt-2 text-sm text-gray-500">
                    {t("kyc.shareLink.description")}
                  </p>

                  <div className="mt-4">
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                      {t("kyc.shareLink.urlLabel")}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={guestUrl}
                        className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex-shrink-0 rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        title={t("kyc.shareLink.copy")}
                      >
                        {copied ? (
                          <CheckIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ClipboardIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    {t("kyc.shareLink.expiresAt", { date: expiresFormatted })}
                  </p>

                  <div className="mt-6 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                    >
                      {t("common.close")}
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
