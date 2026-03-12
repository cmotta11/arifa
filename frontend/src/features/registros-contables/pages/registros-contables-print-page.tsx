import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { PrintView } from "../components/print-view";
import { setGuestToken } from "@/lib/api-client";
import {
  useAccountingRecord,
  useAccountingRecordDocuments,
  useGuestAccountingRecord,
  useGuestAccountingDocuments,
} from "../api/registros-contables-api";
import { useAuth } from "@/lib/auth/auth-context";

export default function RegistrosContablesPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const guestToken = searchParams.get("token");

  // Set guest token if provided via URL
  useEffect(() => {
    if (guestToken) setGuestToken(guestToken);
    return () => {
      if (guestToken) setGuestToken(null);
    };
  }, [guestToken]);

  // If authenticated staff, use staff endpoints; otherwise use guest endpoints
  const isStaff = !!user && !guestToken;

  const staffRecord = useAccountingRecord(isStaff ? id! : "");
  const staffDocs = useAccountingRecordDocuments(isStaff ? id! : "");
  const guestRecord = useGuestAccountingRecord(!isStaff ? id! : "");
  const guestDocs = useGuestAccountingDocuments(!isStaff ? id! : "");

  const record = isStaff ? staffRecord.data : guestRecord.data;
  const documents = isStaff ? staffDocs.data : guestDocs.data;
  const isLoading = isStaff
    ? staffRecord.isLoading
    : guestRecord.isLoading;

  if (isLoading || !record) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PrintView record={record} documents={documents} />
    </div>
  );
}
