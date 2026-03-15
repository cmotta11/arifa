import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/overlay/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { Person } from "@/types";
import { usePersonSearch } from "../api/kyc-api";

// ─── Props ──────────────────────────────────────────────────────────────────

interface PersonSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (person: Person) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PersonSearchDialog({
  isOpen,
  onClose,
  onSelect,
}: PersonSearchDialogProps) {
  const { t } = useTranslation("kyc");
  const [searchQuery, setSearchQuery] = useState("");

  const searchResult = usePersonSearch(searchQuery);
  const persons = searchResult.data ?? [];
  const isSearching = searchResult.isLoading && searchQuery.length >= 2;
  const showResults = searchQuery.length >= 2;

  const handleSelect = (person: Person) => {
    onSelect(person);
    setSearchQuery("");
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("personSearch.title")}
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <Input
          placeholder={t("personSearch.placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <p className="text-xs text-gray-400">
            {t("personSearch.minChars")}
          </p>
        )}

        {/* Results */}
        {showResults && (
          <div className="max-h-80 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : persons.length === 0 ? (
              <div className="py-8 text-center">
                <svg
                  className="mx-auto h-8 w-8 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  {t("personSearch.noResults")}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {t("personSearch.createHint")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {persons.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(person)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {person.full_name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <span>{person.nationality?.country_name ?? "—"}</span>
                          <span>-</span>
                          <span>
                            {person.identification_type
                              ? `${person.identification_type}: ${person.identification_number}`
                              : person.identification_number}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          color={
                            person.person_type === "natural" ? "blue" : "gray"
                          }
                        >
                          {person.person_type === "natural"
                            ? t("personSearch.natural")
                            : t("personSearch.corporate")}
                        </Badge>
                        {person.pep_status && (
                          <Badge color="red">{t("personSearch.pep")}</Badge>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 pt-4">
          <Button variant="ghost" onClick={handleClose}>
            {t("actions.cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
