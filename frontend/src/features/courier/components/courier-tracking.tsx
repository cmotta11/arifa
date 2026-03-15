import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Courier service options
// ---------------------------------------------------------------------------

const COURIER_SERVICE_KEYS = [
  { value: "", labelKey: "common.select" },
  { value: "dhl", labelKey: "courier.services.dhl" },
  { value: "fedex", labelKey: "courier.services.fedex" },
  { value: "ups", labelKey: "courier.services.ups" },
  { value: "local_messenger", labelKey: "courier.services.local_messenger" },
  { value: "registered_mail", labelKey: "courier.services.registered_mail" },
  { value: "other", labelKey: "common.other" },
] as const;

// ---------------------------------------------------------------------------
// Status badge color mapping
// ---------------------------------------------------------------------------

type CourierStatus =
  | "pending_archive"
  | "dispatched"
  | "delivered"
  | "filed";

const statusColorMap: Record<CourierStatus, "gray" | "blue" | "yellow" | "green"> = {
  pending_archive: "gray",
  dispatched: "blue",
  delivered: "yellow",
  filed: "green",
};

const statusLabelMap: Record<CourierStatus, string> = {
  pending_archive: "Pending Archive",
  dispatched: "Dispatched",
  delivered: "Delivered",
  filed: "Filed",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CourierTrackingProps {
  trackingNumber: string;
  dispatchDate: string;
  courierService: string;
  status: string;
  onTrackingNumberChange: (value: string) => void;
  onDispatchDateChange: (value: string) => void;
  onCourierServiceChange: (value: string) => void;
  disabled?: boolean;
}

export function CourierTracking({
  trackingNumber,
  dispatchDate,
  courierService,
  status,
  onTrackingNumberChange,
  onDispatchDateChange,
  onCourierServiceChange,
  disabled = false,
}: CourierTrackingProps) {
  const { t } = useTranslation();
  const [localTracking, setLocalTracking] = useState(trackingNumber);

  const normalizedStatus = (status || "pending_archive")
    .toLowerCase()
    .replace(/\s+/g, "_") as CourierStatus;

  const badgeColor = statusColorMap[normalizedStatus] ?? "gray";
  const badgeLabel =
    t(`courier.statuses.${normalizedStatus}`, {
      defaultValue: statusLabelMap[normalizedStatus] ?? status,
    });

  const handleTrackingBlur = () => {
    if (localTracking !== trackingNumber) {
      onTrackingNumberChange(localTracking);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {t("courier.tracking.status")}:
        </span>
        <Badge color={badgeColor}>{badgeLabel}</Badge>
      </div>

      {/* Tracking number */}
      <Input
        label={t("courier.tracking.trackingNumber")}
        value={localTracking}
        onChange={(e) => setLocalTracking(e.target.value)}
        onBlur={handleTrackingBlur}
        placeholder={t("courier.tracking.trackingNumberPlaceholder")}
        disabled={disabled}
      />

      {/* Dispatch date */}
      <DatePicker
        label={t("courier.tracking.dispatchDate")}
        value={dispatchDate}
        onChange={(e) => onDispatchDateChange(e.target.value)}
        disabled={disabled}
      />

      {/* Courier service selector */}
      <Select
        label={t("courier.tracking.courierService")}
        options={COURIER_SERVICE_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        value={courierService}
        onChange={(e) => onCourierServiceChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
