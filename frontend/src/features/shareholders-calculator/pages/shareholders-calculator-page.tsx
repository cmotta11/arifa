import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/overlay/modal";
import { Input } from "@/components/ui/input";
import {
  useOwnershipTree,
  useSaveOwnershipTree,
  useOwnershipAuditLog,
  type OwnershipNode,
  type OwnershipEdge,
  type ReportableUBO,
} from "../api/ownership-api";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShareholdersCalculatorPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const treeQuery = useOwnershipTree(entityId ?? "");
  const saveMutation = useSaveOwnershipTree();
  const auditQuery = useOwnershipAuditLog(entityId ?? "");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [parentNodeId, setParentNodeId] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  // Local editable state derived from server data
  const [localNodes, setLocalNodes] = useState<OwnershipNode[]>([]);
  const [localEdges, setLocalEdges] = useState<OwnershipEdge[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync from server on first load
  useEffect(() => {
    if (treeQuery.data && !initialized) {
      setLocalNodes(treeQuery.data.nodes);
      setLocalEdges(treeQuery.data.edges);
      setInitialized(true);
    }
  }, [treeQuery.data, initialized]);

  const reportableUbos = treeQuery.data?.reportable_ubos ?? [];
  const warnings = treeQuery.data?.warnings ?? [];

  // Build tree structure for rendering
  const buildTree = useCallback(() => {
    const childMap = new Map<string, { node: OwnershipNode; pct: number }[]>();

    for (const edge of localEdges) {
      const children = childMap.get(edge.source) ?? [];
      const node = localNodes.find((n) => n.id === edge.target);
      if (node) {
        children.push({ node, pct: edge.ownership_pct });
      }
      childMap.set(edge.source, children);
    }

    // Find root nodes (not targets of any edge)
    const targetIds = new Set(localEdges.map((e) => e.target));
    const rootNodes = localNodes.filter((n) => !targetIds.has(n.id));

    return { rootNodes, childMap };
  }, [localNodes, localEdges]);

  const { rootNodes, childMap } = buildTree();

  // Add shareholder
  const handleAddShareholder = (data: {
    name: string;
    type: "person" | "entity";
    percentage: number;
  }) => {
    const newId = crypto.randomUUID();
    const newNode: OwnershipNode = {
      id: newId,
      label: data.name,
      node_type: data.type,
      ownership_pct: data.percentage,
    };
    setLocalNodes((prev) => [...prev, newNode]);

    if (parentNodeId) {
      setLocalEdges((prev) => [
        ...prev,
        { source: parentNodeId, target: newId, ownership_pct: data.percentage },
      ]);
    }

    setShowAddModal(false);
    setParentNodeId(null);
  };

  // Remove node
  const handleRemoveNode = (nodeId: string) => {
    // Recursively remove node and all children
    const toRemove = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      toRemove.add(current);
      const children = localEdges
        .filter((e) => e.source === current)
        .map((e) => e.target);
      queue.push(...children);
    }

    setLocalNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));
    setLocalEdges((prev) =>
      prev.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target))
    );
  };

  // Save
  const handleSave = () => {
    if (!entityId) return;
    saveMutation.mutate({
      entityId,
      nodes: localNodes,
      edges: localEdges,
    });
  };

  // Analyze
  const handleAnalyze = () => {
    setAnalyzed(true);
    // Re-fetch to get server-computed UBOs
    treeQuery.refetch();
  };

  if (!entityId) {
    return (
      <div className="p-6 text-center text-gray-500">{t("shareholdersCalculator.entityIdRequired", "Entity ID required")}</div>
    );
  }

  if (treeQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (treeQuery.isError) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("shareholdersCalculator.loadError", "Failed to load ownership tree. Please try again.")}
        </div>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => treeQuery.refetch()}>
          {t("common.retry", "Retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Save error banner */}
      {saveMutation.isError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("shareholdersCalculator.saveError", "Failed to save ownership tree. Please try again.")}
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            &larr; {t("common.back")}
          </Button>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {t("shareholdersCalculator.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAuditLog(true)}
          >
            {t("shareholdersCalculator.auditLog")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAnalyze}
          >
            {t("shareholdersCalculator.analyze")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saveMutation.isPending}
          >
            {t("shareholdersCalculator.save")}
          </Button>
        </div>
      </div>

      {/* Reportable UBOs Banner */}
      {analyzed && reportableUbos.length > 0 && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-semibold text-green-800">
            {t("shareholdersCalculator.reportableUbos")} ({reportableUbos.length})
          </h3>
          <ul className="mt-2 space-y-1">
            {reportableUbos.map((ubo) => (
              <li key={ubo.id} className="flex items-center gap-2 text-sm text-green-700">
                <Badge color="green">{ubo.effective_pct.toFixed(2)}%</Badge>
                <span className="font-medium">{ubo.name}</span>
                {ubo.chain.length > 0 && (
                  <span className="text-xs text-green-600">
                    via {ubo.chain.join(" → ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <h3 className="text-sm font-semibold text-yellow-800">
            {t("shareholdersCalculator.warnings")}
          </h3>
          <ul className="mt-1 space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-yellow-700">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ownership Tree Visualization */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white p-6">
        {rootNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">
              {t("shareholdersCalculator.description")}
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setParentNodeId(null);
                setShowAddModal(true);
              }}
            >
              {t("shareholdersCalculator.addShareholder")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rootNodes.map((rootNode) => (
              <TreeNode
                key={rootNode.id}
                node={rootNode}
                depth={0}
                childMap={childMap}
                analyzed={analyzed}
                reportableIds={new Set(reportableUbos.map((u) => u.id))}
                onAddChild={(parentId) => {
                  setParentNodeId(parentId);
                  setShowAddModal(true);
                }}
                onRemove={handleRemoveNode}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParentNodeId(null);
                setShowAddModal(true);
              }}
            >
              + {t("shareholdersCalculator.addShareholder")}
            </Button>
          </div>
        )}
      </div>

      {/* Add Shareholder Modal */}
      <AddShareholderModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setParentNodeId(null);
        }}
        onAdd={handleAddShareholder}
      />

      {/* Audit Log Modal */}
      <Modal
        isOpen={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        title={t("shareholdersCalculator.auditLog")}
        className="max-w-lg"
      >
        {auditQuery.isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (auditQuery.data ?? []).length === 0 ? (
          <p className="py-4 text-sm text-gray-500">
            {t("shareholdersCalculator.noSnapshots")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {(auditQuery.data ?? []).map((snapshot) => (
              <li key={snapshot.id} className="py-3">
                <p className="text-sm font-medium text-gray-900">
                  {new Date(snapshot.created_at).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {snapshot.nodes.length} nodes, {snapshot.reportable_ubos.length} UBOs
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree Node Component
// ---------------------------------------------------------------------------

function TreeNode({
  node,
  depth,
  childMap,
  analyzed,
  reportableIds,
  onAddChild,
  onRemove,
}: {
  node: OwnershipNode;
  depth: number;
  childMap: Map<string, { node: OwnershipNode; pct: number }[]>;
  analyzed: boolean;
  reportableIds: Set<string>;
  onAddChild: (parentId: string) => void;
  onRemove: (nodeId: string) => void;
}) {
  const { t } = useTranslation();
  const children = childMap.get(node.id) ?? [];
  const isEntity = node.node_type === "entity";
  const isReportable = analyzed && reportableIds.has(node.id);

  return (
    <div className={`${depth > 0 ? "ml-8 border-l-2 border-gray-200 pl-4" : ""}`}>
      <div
        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
          isReportable
            ? "border-green-300 bg-green-50"
            : isEntity
              ? "border-blue-200 bg-blue-50"
              : "border-gray-200 bg-white"
        }`}
      >
        {/* Icon */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isEntity ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
          }`}
        >
          {isEntity ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{node.label}</span>
            {node.ownership_pct > 0 && (
              <Badge color={isReportable ? "green" : "gray"}>
                {node.ownership_pct}%
              </Badge>
            )}
            {node.pep_status && <Badge color="red">PEP</Badge>}
            {node.exception_type && (
              <Badge color="blue">
                {t(`shareholdersCalculator.exception.${node.exception_type}`)}
              </Badge>
            )}
          </div>
          {(node.nationality || node.jurisdiction) && (
            <p className="text-xs text-gray-500">
              {node.nationality && `${node.nationality}`}
              {node.jurisdiction && ` | ${node.jurisdiction}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEntity && (
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary"
              title={t("shareholdersCalculator.addShareholder")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
          {depth > 0 && (
            <button
              type="button"
              onClick={() => onRemove(node.id)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              title={t("shareholdersCalculator.deleteNode")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map(({ node: childNode }) => (
            <TreeNode
              key={childNode.id}
              node={childNode}
              depth={depth + 1}
              childMap={childMap}
              analyzed={analyzed}
              reportableIds={reportableIds}
              onAddChild={onAddChild}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Shareholder Modal
// ---------------------------------------------------------------------------

function AddShareholderModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; type: "person" | "entity"; percentage: number }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<"person" | "entity">("person");
  const [percentage, setPercentage] = useState("");

  const handleSubmit = () => {
    const pct = parseFloat(percentage);
    if (!name.trim() || isNaN(pct) || pct <= 0 || pct > 100) return;
    onAdd({ name: name.trim(), type, percentage: pct });
    setName("");
    setType("person");
    setPercentage("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("shareholdersCalculator.addShareholder")}
    >
      <div className="space-y-4">
        <Input
          label={t("shareholdersCalculator.node.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("shareholdersCalculator.node.namePlaceholder", "Enter name...")}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("shareholdersCalculator.node.type")}
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setType("person")}
              className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                type === "person"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {t("shareholdersCalculator.node.natural")}
            </button>
            <button
              type="button"
              onClick={() => setType("entity")}
              className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                type === "entity"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {t("shareholdersCalculator.node.legal")}
            </button>
          </div>
        </div>

        <Input
          label={t("shareholdersCalculator.node.percentage")}
          type="number"
          min="0.01"
          max="100"
          step="0.01"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          placeholder={t("shareholdersCalculator.node.percentagePlaceholder", "e.g. 25.00")}
        />

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!name.trim() || !percentage}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
