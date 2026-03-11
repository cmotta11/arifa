import { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Transition } from "@headlessui/react";
import {
  ClipboardIcon,
  CheckIcon,
  LinkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-display/data-table";
import { Spinner } from "@/components/ui/spinner";
import { ShareGuestLinkButton } from "@/features/kyc/components/share-guest-link-button";
import { useCreateKYC, useCreateGuestLink } from "@/features/kyc/api/kyc-api";
import { useCreateTicket } from "@/features/tickets/api/tickets-api";
import {
  useEntityGuestLinks,
  useEntityKYCSubmissions,
  useEntityTickets,
} from "../api/entities-api";

interface AccessLinksTabProps {
  entityId: string;
  clientId: string;
  entityName: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-500" />
      ) : (
        <ClipboardIcon className="h-4 w-4" />
      )}
    </button>
  );
}

export function AccessLinksTab({ entityId, clientId, entityName }: AccessLinksTabProps) {
  const { t } = useTranslation();
  const guestLinksQuery = useEntityGuestLinks(entityId);
  const kycQuery = useEntityKYCSubmissions(entityId);
  const ticketsQuery = useEntityTickets(entityId);

  const [showTicketPicker, setShowTicketPicker] = useState(false);
  const [showLinkResult, setShowLinkResult] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [generatedExpires, setGeneratedExpires] = useState("");
  const [copiedResult, setCopiedResult] = useState(false);
  const [isCreatingFull, setIsCreatingFull] = useState(false);

  const createKycMutation = useCreateKYC();
  const createGuestLinkMutation = useCreateGuestLink();
  const createTicketMutation = useCreateTicket();

  const guestLinks = guestLinksQuery.data?.results ?? [];
  const kycSubmissions = kycQuery.data?.results ?? [];
  const tickets = ticketsQuery.data?.results ?? [];

  // Tickets that don't already have a KYC submission in our list
  const kycTicketIds = new Set(kycSubmissions.map((k) => k.ticket));
  const availableTickets = tickets.filter((t) => !kycTicketIds.has(t.id));

  const showLinkResultDialog = (token: string, expiresAt: string) => {
    setGeneratedUrl(`${window.location.origin}/guest/${token}`);
    setGeneratedExpires(
      new Date(expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
    setShowTicketPicker(false);
    setShowLinkResult(true);
    setCopiedResult(false);
    guestLinksQuery.refetch();
    kycQuery.refetch();
  };

  const handleCreateKYCAndLink = async (ticketId: string) => {
    try {
      const newKyc = await createKycMutation.mutateAsync(ticketId);
      const link = await createGuestLinkMutation.mutateAsync(newKyc.id);
      showLinkResultDialog(link.token, link.expires_at);
    } catch {
      // Errors handled by mutation state
    }
  };

  const handleCreateFullFlow = async () => {
    setIsCreatingFull(true);
    try {
      const ticket = await createTicketMutation.mutateAsync({
        title: `KYC – ${entityName}`,
        client_id: clientId,
        entity_id: entityId,
      });
      const newKyc = await createKycMutation.mutateAsync(ticket.id);
      const link = await createGuestLinkMutation.mutateAsync(newKyc.id);
      ticketsQuery.refetch();
      showLinkResultDialog(link.token, link.expires_at);
    } catch {
      // Errors handled by mutation state
    } finally {
      setIsCreatingFull(false);
    }
  };

  const handleButtonClick = () => {
    if (availableTickets.length > 0) {
      setShowTicketPicker(true);
    } else {
      handleCreateFullFlow();
    }
  };

  const handleCopyResult = async () => {
    await navigator.clipboard.writeText(generatedUrl);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const guestLinkColumns = [
    {
      key: "token",
      header: t("entities.accessLinks.linkUrl"),
      render: (row: Record<string, unknown>) => {
        const url = `${window.location.origin}/guest/${String(row.token)}`;
        return (
          <div className="flex items-center gap-2">
            <span className="max-w-xs truncate text-sm text-gray-600">
              {url}
            </span>
            <CopyButton text={url} />
          </div>
        );
      },
    },
    {
      key: "kyc_submission",
      header: "KYC",
      render: (row: Record<string, unknown>) =>
        row.kyc_submission
          ? String(row.kyc_submission).slice(0, 8) + "..."
          : "—",
    },
    {
      key: "expires_at",
      header: t("entities.accessLinks.expires"),
      render: (row: Record<string, unknown>) =>
        new Date(String(row.expires_at)).toLocaleDateString(),
    },
  ];

  const kycColumns = [
    {
      key: "id",
      header: "ID",
      render: (row: Record<string, unknown>) => (
        <span className="font-medium">{String(row.id).slice(0, 8)}...</span>
      ),
    },
    {
      key: "status",
      header: t("tickets.status"),
      render: (row: Record<string, unknown>) => {
        const status = String(row.status);
        const colors: Record<
          string,
          "gray" | "blue" | "yellow" | "green" | "red"
        > = {
          draft: "gray",
          submitted: "blue",
          under_review: "yellow",
          approved: "green",
          rejected: "red",
          sent_back: "yellow",
        };
        return <Badge color={colors[status] ?? "gray"}>{status}</Badge>;
      },
    },
    {
      key: "created_at",
      header: t("tickets.createdAt"),
      render: (row: Record<string, unknown>) =>
        new Date(String(row.created_at)).toLocaleDateString(),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row: Record<string, unknown>) => (
        <ShareGuestLinkButton kycId={String(row.id)} />
      ),
    },
  ];

  if (guestLinksQuery.isLoading || kycQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create KYC & Link Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleButtonClick}
          loading={isCreatingFull}
        >
          <PlusIcon className="mr-1.5 h-4 w-4" />
          {t("entities.accessLinks.createKycLink")}
        </Button>
      </div>

      {/* Active Guest Links */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("entities.accessLinks.guestLinks")}
        </h3>
        {guestLinks.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("entities.accessLinks.noLinks")}
          </p>
        ) : (
          <DataTable
            columns={guestLinkColumns}
            data={guestLinks as unknown as Record<string, unknown>[]}
            emptyMessage={t("entities.accessLinks.noLinks")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>

      {/* KYC Submissions */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("entities.accessLinks.kycSubmissions")}
        </h3>
        {kycSubmissions.length === 0 ? (
          <p className="text-sm text-gray-500">{t("kyc.noKyc")}</p>
        ) : (
          <DataTable
            columns={kycColumns}
            data={kycSubmissions as unknown as Record<string, unknown>[]}
            emptyMessage={t("kyc.noKyc")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>

      {/* ─── Ticket Picker Dialog ─────────────────────────────────────── */}
      <Transition appear show={showTicketPicker} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowTicketPicker(false)}
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
                    {t("entities.accessLinks.selectTicket")}
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("entities.accessLinks.selectTicketDesc")}
                  </p>

                  {createKycMutation.isError && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {t("common.error")}
                    </div>
                  )}

                  <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                    {availableTickets.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        {t("entities.accessLinks.noTicketsAvailable")}
                      </p>
                    ) : (
                      availableTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => handleCreateKYCAndLink(ticket.id)}
                          disabled={createKycMutation.isPending}
                          className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:border-arifa-navy hover:bg-gray-50 disabled:opacity-50"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {ticket.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {ticket.client?.name ?? ""} &middot;{" "}
                              {new Date(
                                ticket.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          {createKycMutation.isPending &&
                          createKycMutation.variables === ticket.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <LinkIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTicketPicker(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ─── Link Result Dialog ───────────────────────────────────────── */}
      <Transition appear show={showLinkResult} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowLinkResult(false)}
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
                        value={generatedUrl}
                        className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyResult}
                        className="flex-shrink-0 rounded-md border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        title={t("kyc.shareLink.copy")}
                      >
                        {copiedResult ? (
                          <CheckIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ClipboardIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    {t("kyc.shareLink.expiresAt", { date: generatedExpires })}
                  </p>

                  <div className="mt-6 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowLinkResult(false)}
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
    </div>
  );
}
