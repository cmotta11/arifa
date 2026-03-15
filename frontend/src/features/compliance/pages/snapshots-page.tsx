import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import {
  useComplianceSnapshots,
  useCreateComplianceSnapshot,
  useSnapshotAssessments,
  useExportSnapshotPDF,
} from "../api/risk-matrix-api";
import type { ComplianceSnapshot, RiskAssessment } from "@/types";

const STATUS_COLORS: Record<string, "green" | "yellow" | "red"> = {
  completed: "green",
  running: "yellow",
  failed: "red",
};

const RISK_COLORS: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

export default function SnapshotsPage() {
  const { t } = useTranslation();
  const snapshotsQuery = useComplianceSnapshots();
  const createMutation = useCreateComplianceSnapshot();
  const exportMutation = useExportSnapshotPDF();

  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: "", notes: "" });
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const snapshots = snapshotsQuery.data?.results ?? [];

  const handleCreate = () => {
    createMutation.mutate(
      { name: formData.name, notes: formData.notes || undefined },
      {
        onSuccess: () => {
          setShowCreate(false);
          setFormData({ name: "", notes: "" });
        },
      },
    );
  };

  const handleExportPDF = (snapshotId: string) => {
    exportMutation.mutate(snapshotId, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `snapshot-${snapshotId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  const snapshotColumns = [
    {
      key: "name",
      header: t("riskMatrix.snapshots.name"),
      render: (row: ComplianceSnapshot) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      key: "date",
      header: t("riskMatrix.snapshots.date"),
      render: (row: ComplianceSnapshot) =>
        new Date(row.snapshot_date).toLocaleString(),
    },
    {
      key: "status",
      header: t("tickets.status"),
      render: (row: ComplianceSnapshot) => (
        <Badge color={STATUS_COLORS[row.status] ?? "gray"}>
          {row.status === "running" && (
            <ArrowPathIcon className="mr-1 h-3 w-3 animate-spin" />
          )}
          {row.status}
        </Badge>
      ),
    },
    {
      key: "counts",
      header: t("riskMatrix.snapshots.riskBreakdown"),
      render: (row: ComplianceSnapshot) => (
        <div className="flex gap-2">
          <Badge color="red">{row.high_risk_count} H</Badge>
          <Badge color="yellow">{row.medium_risk_count} M</Badge>
          <Badge color="green">{row.low_risk_count} L</Badge>
        </div>
      ),
    },
    {
      key: "totals",
      header: t("riskMatrix.snapshots.totals"),
      render: (row: ComplianceSnapshot) => (
        <span className="text-sm text-gray-500">
          {row.total_entities} {t("riskMatrix.snapshots.entities")} / {row.total_persons}{" "}
          {t("riskMatrix.snapshots.persons")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row: ComplianceSnapshot) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleExportPDF(row.id);
          }}
          disabled={exportMutation.isPending || row.status !== "completed"}
          className="text-gray-400 hover:text-primary disabled:opacity-30"
          title={t("riskMatrix.exportPDF")}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (snapshotsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("riskMatrix.snapshots.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("riskMatrix.snapshots.description")}
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {snapshots.length} {t("riskMatrix.snapshots.totalSnapshots")}
          </span>
          {snapshots.length > 0 && (
            <span className="text-xs text-gray-500">
              {t("riskMatrix.snapshots.latest")}:{" "}
              {new Date(snapshots[0]?.snapshot_date ?? "").toLocaleDateString()}
            </span>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("riskMatrix.snapshots.runNew")}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Snapshots List */}
        <div className="overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <DataTable
            columns={snapshotColumns}
            data={snapshots}
            loading={snapshotsQuery.isLoading}
            emptyMessage={t("riskMatrix.snapshots.noSnapshots")}
            keyExtractor={(row) => row.id as string}
            onRowClick={(row) => setSelectedSnapshotId(row.id as string)}
          />
        </div>

        {/* Snapshot Detail */}
        <div className="overflow-auto lg:col-span-1">
          {selectedSnapshotId ? (
            <SnapshotDetail snapshotId={selectedSnapshotId} />
          ) : (
            <Card className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500">
                {t("riskMatrix.snapshots.selectSnapshot")}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("riskMatrix.snapshots.runNew")}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("riskMatrix.snapshots.name")}
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={formData.name}
              onChange={(e) =>
                setFormData((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("riskMatrix.config.notes")}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
              value={formData.notes}
              onChange={(e) =>
                setFormData((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            loading={createMutation.isPending}
            disabled={!formData.name}
          >
            {t("riskMatrix.snapshots.runNew")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SnapshotDetail({ snapshotId }: { snapshotId: string }) {
  const { t } = useTranslation();
  const assessmentsQuery = useSnapshotAssessments(snapshotId);
  const assessments = assessmentsQuery.data?.results ?? [];

  if (assessmentsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        {t("riskMatrix.snapshots.assessments")} ({assessments.length})
      </h3>
      {assessments.length === 0 ? (
        <p className="text-sm text-gray-500">{t("common.noResults")}</p>
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {a.entity_name
                    ? `Entity: ${a.entity_name}`
                    : a.person_name
                      ? `Person: ${a.person_name}`
                      : `KYC: ${a.kyc_submission}`}
                </p>
                <p className="text-xs text-gray-500">
                  {t("riskMatrix.score")}: {a.total_score}
                </p>
              </div>
              <Badge color={RISK_COLORS[a.risk_level] ?? "gray"}>
                {t(`riskLevels.${a.risk_level}`)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
