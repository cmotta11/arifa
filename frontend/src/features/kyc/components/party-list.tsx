import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/overlay/modal";
import type { Party } from "@/types";
import { useDeleteParty } from "../api/kyc-api";
import { PartyForm } from "./party-form";

// ─── Props ──────────────────────────────────────────────────────────────────

interface PartyListProps {
  kycId: string;
  parties: Party[];
  isLoading: boolean;
  readonly?: boolean;
}

// ─── Role Color Mapping ─────────────────────────────────────────────────────

const ROLE_BADGE_COLOR: Record<string, "blue" | "green" | "yellow" | "gray" | "red"> = {
  ubo: "red",
  director: "blue",
  shareholder: "green",
  protector: "yellow",
  authorized_signatory: "gray",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function PartyList({
  kycId,
  parties,
  isLoading,
  readonly = false,
}: PartyListProps) {
  const { t } = useTranslation("kyc");
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deletingPartyId, setDeletingPartyId] = useState<string | null>(null);

  const deletePartyMutation = useDeleteParty();

  // UBO ownership tracking
  const ubosAndShareholders = parties.filter(
    (p) => p.role === "ubo" || p.role === "shareholder"
  );
  const totalOwnership = ubosAndShareholders.reduce(
    (sum, p) => sum + (p.ownership_percentage ?? 0),
    0
  );

  const handleEdit = (party: Party) => {
    setEditingParty(party);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingParty(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingParty(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingParty(null);
  };

  const handleDelete = (partyId: string) => {
    deletePartyMutation.mutate(
      { partyId, kycId },
      {
        onSuccess: () => {
          setDeletingPartyId(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("steps.parties")}
        </h2>
        {!readonly && (
          <Button variant="primary" size="sm" onClick={handleAddNew}>
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            {t("party.add")}
          </Button>
        )}
      </div>

      {/* UBO Ownership Indicator */}
      {ubosAndShareholders.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t("ubo.totalOwnership")}</span>
            <span
              className={`font-semibold ${
                totalOwnership === 100
                  ? "text-green-600"
                  : totalOwnership > 100
                    ? "text-red-600"
                    : "text-yellow-600"
              }`}
            >
              {totalOwnership}% / 100%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                totalOwnership === 100
                  ? "bg-green-500"
                  : totalOwnership > 100
                    ? "bg-red-500"
                    : "bg-yellow-500"
              }`}
              style={{ width: `${Math.min(totalOwnership, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Party Cards */}
      {parties.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
          <svg
            className="mx-auto h-10 w-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">{t("party.empty")}</p>
          {!readonly && (
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={handleAddNew}
            >
              {t("party.addFirst")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {parties.map((party) => (
            <div
              key={party.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                {/* Party Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {party.name}
                    </h3>
                    <Badge color={ROLE_BADGE_COLOR[party.role] ?? "gray"}>
                      {t(`roles.${party.role}`)}
                    </Badge>
                    <Badge
                      color={party.party_type === "natural" ? "blue" : "gray"}
                    >
                      {party.party_type === "natural"
                        ? t("party.natural")
                        : t("party.corporate")}
                    </Badge>
                    {party.pep_status && (
                      <Badge color="red">{t("party.pep")}</Badge>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-4">
                    <div>
                      <span className="font-medium text-gray-600">
                        {t("fields.nationality")}:
                      </span>{" "}
                      {party.nationality || "-"}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        {t("fields.countryOfResidence")}:
                      </span>{" "}
                      {party.country_of_residence || "-"}
                    </div>
                    {(party.role === "ubo" || party.role === "shareholder") && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {t("fields.ownership")}:
                        </span>{" "}
                        {party.ownership_percentage != null
                          ? `${party.ownership_percentage}%`
                          : "-"}
                      </div>
                    )}
                    {party.party_type === "natural" && party.date_of_birth && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {t("fields.dob")}:
                        </span>{" "}
                        {new Date(party.date_of_birth).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!readonly && (
                  <div className="ml-4 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(party)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-arifa-navy"
                      aria-label={t("actions.edit")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingPartyId(party.id)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={t("actions.delete")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Party Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormCancel}
        title={editingParty ? t("party.editTitle") : t("party.addTitle")}
        className="max-w-2xl"
      >
        <PartyForm
          kycId={kycId}
          party={editingParty}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingPartyId}
        onClose={() => setDeletingPartyId(null)}
        title={t("party.deleteTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t("party.deleteConfirm")}</p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setDeletingPartyId(null)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={deletePartyMutation.isPending}
              onClick={() => {
                if (deletingPartyId) {
                  handleDelete(deletingPartyId);
                }
              }}
            >
              {t("actions.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
