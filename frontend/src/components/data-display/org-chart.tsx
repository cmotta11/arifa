/**
 * OrgChart Shell Component (Task 1.6.2)
 *
 * React Flow-based organization chart for visualizing corporate structures.
 * Provides custom EntityNode and PersonNode types with ownership percentage
 * labels on edges, zoom/pan controls, and a minimap.
 *
 * NOTE: `reactflow` is NOT in package.json. Install before using:
 *   npm install reactflow
 *
 * This shell is designed to be consistent with the existing shareholders-calculator
 * feature, which uses a manual tree layout. This component provides the React Flow
 * alternative for richer interactive visualizations.
 */

import { useCallback, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type NodeProps,
  type EdgeProps,
  type OnNodesChange,
  type OnEdgesChange,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";

// ---------------------------------------------------------------------------
// Custom Node: EntityNode (blue rounded card)
// ---------------------------------------------------------------------------

export interface EntityNodeData {
  label: string;
  ownershipPct?: number;
  jurisdiction?: string;
  exceptionType?: string;
}

export function EntityNode({ data, selected }: NodeProps<EntityNodeData>) {
  const { t } = useTranslation();

  return (
    <div
      className={`
        min-w-[160px] rounded-lg border-2 bg-blue-50 px-4 py-3 shadow-sm
        transition-colors duration-100
        ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-blue-200"}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-gray-900">
            {data.label}
          </p>
          <p className="text-xs text-blue-600">
            {t("orgChart.entity", "Entity")}
          </p>
        </div>
      </div>

      {(data.jurisdiction || data.exceptionType) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {data.jurisdiction && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {data.jurisdiction}
            </span>
          )}
          {data.exceptionType && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              {data.exceptionType}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-400"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Node: PersonNode (green rounded card)
// ---------------------------------------------------------------------------

export interface PersonNodeData {
  label: string;
  ownershipPct?: number;
  nationality?: string;
  pepStatus?: boolean;
}

export function PersonNode({ data, selected }: NodeProps<PersonNodeData>) {
  const { t } = useTranslation();

  return (
    <div
      className={`
        min-w-[160px] rounded-lg border-2 bg-green-50 px-4 py-3 shadow-sm
        transition-colors duration-100
        ${selected ? "border-green-500 ring-2 ring-green-200" : "border-green-200"}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-400"
      />

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-gray-900">
            {data.label}
          </p>
          <p className="text-xs text-green-600">
            {t("orgChart.person", "Person")}
          </p>
        </div>
      </div>

      {(data.nationality || data.pepStatus) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {data.nationality && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {data.nationality}
            </span>
          )}
          {data.pepStatus && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              PEP
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-400"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Edge: OwnershipEdge (with percentage label)
// ---------------------------------------------------------------------------

export interface OwnershipEdgeData {
  ownershipPct: number;
}

export function OwnershipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<OwnershipEdgeData>) {
  const { t } = useTranslation();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const pct = data?.ownershipPct;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
      {pct !== undefined && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200"
          >
            {pct}% {t("orgChart.ownership", "ownership")}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Node / Edge type registries
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  entity: EntityNode,
  person: PersonNode,
};

const edgeTypes: EdgeTypes = {
  ownership: OwnershipEdge,
};

// ---------------------------------------------------------------------------
// OrgChart component
// ---------------------------------------------------------------------------

export interface OrgChartNode extends Node {
  type: "entity" | "person";
  data: EntityNodeData | PersonNodeData;
}

export interface OrgChartEdge extends Edge {
  type?: "ownership";
  data?: OwnershipEdgeData;
}

interface OrgChartProps {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
  onNodeClick?: (event: MouseEvent, node: OrgChartNode) => void;
  onEdgeClick?: (event: MouseEvent, edge: OrgChartEdge) => void;
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  className?: string;
}

export function OrgChart({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
  onNodesChange,
  onEdgesChange,
  className = "",
}: OrgChartProps) {
  const { t } = useTranslation();

  const handleNodeClick = useCallback(
    (event: MouseEvent, node: Node) => {
      onNodeClick?.(event, node as OrgChartNode);
    },
    [onNodeClick],
  );

  const handleEdgeClick = useCallback(
    (event: MouseEvent, edge: Edge) => {
      onEdgeClick?.(event, edge as OrgChartEdge);
    },
    [onEdgeClick],
  );

  return (
    <div className={`h-full w-full ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: "ownership",
          animated: false,
        }}
      >
        <Controls
          showInteractive={false}
          className="!rounded-md !border-gray-200 !shadow-sm"
          aria-label={t("orgChart.controls", "Zoom controls")}
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) =>
            node.type === "entity" ? "#93c5fd" : "#86efac"
          }
          maskColor="rgba(0,0,0,0.08)"
          className="!rounded-md !border-gray-200 !shadow-sm"
          aria-label={t("orgChart.minimap", "Minimap")}
        />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
}
