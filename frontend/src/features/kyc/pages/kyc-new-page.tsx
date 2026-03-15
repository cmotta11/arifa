import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data-display/empty-state";
import { ROUTES } from "@/config/routes";
import { api } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import type { Ticket, PaginatedResponse } from "@/types";
import { useCreateKYC } from "../api/kyc-api";
import { KYCFormShell } from "../components/kyc-form-shell";

// ─── Ticket fetcher ─────────────────────────────────────────────────────────

function useTickets() {
  return useQuery({
    queryKey: ["tickets", "list"],
    queryFn: () =>
      api.get<PaginatedResponse<Ticket>>("/workflow/tickets/", {
        per_page: "200",
      }),
  });
}

// ─── Priority Badge Color ───────────────────────────────────────────────────

const PRIORITY_COLOR: Record<Ticket["priority"], "gray" | "green" | "yellow" | "red"> = {
  low: "gray",
  medium: "green",
  high: "yellow",
  urgent: "red",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function KYCNewPage() {
  const { t } = useTranslation("kyc");
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [createdKycId, setCreatedKycId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const ticketsQuery = useTickets();
  const createKycMutation = useCreateKYC();

  const tickets = ticketsQuery.data?.results ?? [];

  // Filter tickets by search term
  const filteredTickets = useMemo(() => {
    if (!debouncedSearch) return tickets;
    const lower = debouncedSearch.toLowerCase();
    return tickets.filter(
      (ticket) =>
        ticket.title.toLowerCase().includes(lower) ||
        ticket.id.toLowerCase().includes(lower) ||
        ticket.client.name.toLowerCase().includes(lower)
    );
  }, [tickets, debouncedSearch]);

  const handleSelectTicket = async (ticketId: string) => {
    try {
      const newKyc = await createKycMutation.mutateAsync(ticketId);
      setCreatedKycId(newKyc.id);
    } catch {
      // Handled by mutation error state
    }
  };

  const handleSubmitSuccess = () => {
    navigate(ROUTES.KYC);
  };

  // ─── If KYC has been created, show the form shell ───────────────────────

  if (createdKycId) {
    return (
      <div className="p-6">
        {/* Back to ticket selection */}
        <button
          type="button"
          onClick={() => setCreatedKycId(null)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("actions.backToList")}
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {t("new.formTitle")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("new.formHint")}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <KYCFormShell
            kycId={createdKycId}
            onSubmitSuccess={handleSubmitSuccess}
          />
        </div>
      </div>
    );
  }

  // ─── Ticket Selection ───────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.KYC)}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("actions.backToList")}
      </button>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("new.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t("new.selectTicket")}</p>
      </div>

      {/* Error state from KYC creation */}
      {createKycMutation.isError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("errors.createFailed")}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder={t("new.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Ticket List */}
      {ticketsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : ticketsQuery.isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("errors.loadTicketsFailed")}
        </div>
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          title={t("new.noTickets")}
          description={
            searchTerm
              ? t("new.noTicketsSearch")
              : t("new.noTicketsAvailable")
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => handleSelectTicket(ticket.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {ticket.title}
                    </h3>
                    <Badge color={PRIORITY_COLOR[ticket.priority]}>
                      {ticket.priority}
                    </Badge>
                    <Badge color="blue">{ticket.current_state.name}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      {t("new.client")}: {ticket.client.name}
                    </span>
                    {ticket.entity && (
                      <span>
                        {t("new.entity")}: {ticket.entity.name}
                      </span>
                    )}
                    <span>
                      {t("new.created")}:{" "}
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="ml-4">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={
                      createKycMutation.isPending &&
                      createKycMutation.variables === ticket.id
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTicket(ticket.id);
                    }}
                  >
                    {t("new.select")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
