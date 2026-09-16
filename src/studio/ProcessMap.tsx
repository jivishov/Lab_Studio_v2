import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges, Background, Controls, MarkerType, Position, ReactFlow,
  type Edge, type EdgeMouseHandler, type Node, type NodeChange,
  type NodeMouseHandler, type OnNodeDrag, type ReactFlowInstance,
} from "@xyflow/react";
import { CheckCircle2, Eye, GitBranch, Maximize2, RefreshCcw } from "lucide-react";
import { getProcessNodeLayout } from "../domain/processLayout";
import type { EdgeConditionType, LabDefinition, ProcessEdge, ProcessNode } from "../domain/types";
import type { InsertTemplateStepOptions, StudioTemplate } from "./studioState";

interface ProcessMapProps {
  draft: LabDefinition;
  selectedNodeId?: string;
  onAddBranchEdge: (fromNodeId: string, toNodeId: string) => void;
  onAddRetryEdge: (fromNodeId: string) => void;
  onAddTemplate: (template: StudioTemplate, options?: InsertTemplateStepOptions) => void;
  onAutoLayout: () => void;
  onOpenDetails: () => void;
  onSelect: (nodeId: string) => void;
  onUpdateEdge: (index: number, edge: ProcessEdge) => void;
  onUpdateNode: (node: ProcessNode) => void;
  detailsViewVersion?: number;
  connectionsOpen?: boolean;
  onConnectionsOpenChange?: (open: boolean) => void;
  previewVisible?: boolean;
  onTogglePreview?: () => void;
  readinessLabel?: string;
  readinessTone?: "ready" | "review" | "blocked";
  onReadinessClick?: () => void;
}

type ProcessFlowNode = Node<{ label: string; order: number; nodeType: ProcessNode["type"] }>;
const edgeTypes: EdgeConditionType[] = ["validationPassed", "always", "retry", "calculationResult"];
const conditionLabel = (type: EdgeConditionType) => type === "validationPassed" ? "Validation passed" : type === "calculationResult" ? "Calculation result" : type === "retry" ? "Retry" : "Always";
const conditionForType = (type: EdgeConditionType, previous: ProcessEdge["condition"]): ProcessEdge["condition"] => type === "calculationResult" ? { type, calculationId: previous.calculationId, min: previous.min, max: previous.max } : { type };

const positionToward = (
  origin: { x: number; y: number },
  destination: { x: number; y: number },
) => {
  const deltaX = destination.x - origin.x;
  const deltaY = destination.y - origin.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? Position.Right : Position.Left;
  return deltaY >= 0 ? Position.Bottom : Position.Top;
};

const makeFlowNodes = (draft: LabDefinition, selectedNodeId?: string): ProcessFlowNode[] => {
  const layouts = new Map(
    draft.process.nodes.map((node, index) => [node.id, getProcessNodeLayout(node, index)]),
  );
  return draft.process.nodes.map((node, index) => {
    const layout = layouts.get(node.id) ?? getProcessNodeLayout(node, index);
    const incoming = draft.process.edges.find((edge) => edge.to === node.id && edge.condition.type !== "retry")
      ?? draft.process.edges.find((edge) => edge.to === node.id);
    const outgoing = draft.process.edges.find((edge) => edge.from === node.id && edge.condition.type !== "retry")
      ?? draft.process.edges.find((edge) => edge.from === node.id);
    const incomingLayout = incoming ? layouts.get(incoming.from) : undefined;
    const outgoingLayout = outgoing ? layouts.get(outgoing.to) : undefined;
    return {
      id: node.id, type: "default", position: { x: layout.x, y: layout.y },
      data: { label: `${index + 1}. ${node.title}`, order: index + 1, nodeType: node.type },
      className: ["diagram-node", `is-${node.type}`, selectedNodeId === node.id ? "is-selected" : ""].filter(Boolean).join(" "),
      selected: selectedNodeId === node.id,
      ariaLabel: `Step ${index + 1}: ${node.title}`,
      targetPosition: incomingLayout ? positionToward(layout, incomingLayout) : Position.Top,
      sourcePosition: outgoingLayout ? positionToward(layout, outgoingLayout) : Position.Bottom,
    };
  });
};

const makeFlowEdges = (draft: LabDefinition, selectedEdgeId: string | null): Edge[] =>
  draft.process.edges.map((edge, index) => ({
    id: `${edge.from}-${edge.to}-${index}`, source: edge.from, target: edge.to,
    label: edge.label || conditionLabel(edge.condition.type),
    type: edge.condition.type === "retry" ? "smoothstep" : "step",
    animated: edge.condition.type === "retry",
    selected: selectedEdgeId === `${edge.from}-${edge.to}-${index}`,
    className: `diagram-edge is-${edge.condition.type}`,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

export const ProcessMap = ({
  draft, onAutoLayout, onSelect, onUpdateEdge, onUpdateNode, selectedNodeId,
  detailsViewVersion = 0, connectionsOpen, onConnectionsOpenChange,
  previewVisible = false, onTogglePreview,
  readinessLabel = "Review process readiness", readinessTone = "review", onReadinessClick,
}: ProcessMapProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const connectionsButtonRef = useRef<HTMLButtonElement>(null);
  const flowRef = useRef<ReactFlowInstance<ProcessFlowNode, Edge> | null>(null);
  const [flowNodes, setFlowNodes] = useState(() => makeFlowNodes(draft, selectedNodeId));
  const [internalConnectionsOpen, setInternalConnectionsOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [advancedConnections, setAdvancedConnections] = useState(false);
  const showConnections = connectionsOpen ?? internalConnectionsOpen;
  const compactReadinessLabel = readinessTone === "ready"
    ? "Ready to preview"
    : readinessTone === "review"
      ? "Preview ready"
      : "Preview blocked";
  const flowEdges = useMemo(() => makeFlowEdges(draft, selectedEdgeId), [draft.process.edges, selectedEdgeId]);
  const setConnections = useCallback((open: boolean) => {
    setInternalConnectionsOpen(open);
    onConnectionsOpenChange?.(open);
  }, [onConnectionsOpenChange]);

  useEffect(() => setFlowNodes(makeFlowNodes(draft, selectedNodeId)), [draft.process.nodes, selectedNodeId]);
  const fitProcessToView = useCallback(() => window.requestAnimationFrame(() => flowRef.current?.fitView({ duration: 180, includeHiddenNodes: false, padding: 0.18 })), []);
  useEffect(() => { fitProcessToView(); }, [detailsViewVersion, draft.process.nodes.length, fitProcessToView]);
  useEffect(() => {
    const element = canvasRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(fitProcessToView);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitProcessToView]);
  useEffect(() => {
    if (!showConnections) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setConnections(false);
      window.requestAnimationFrame(() => connectionsButtonRef.current?.focus());
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [setConnections, showConnections]);

  const handleNodeDragStop: OnNodeDrag<ProcessFlowNode> = (_event, node) => {
    const processNode = draft.process.nodes.find((candidate) => candidate.id === node.id);
    if (!processNode) return;
    const fallback = getProcessNodeLayout(processNode, draft.process.nodes.findIndex((candidate) => candidate.id === node.id));
    onUpdateNode({ ...processNode, layout: { ...fallback, ...processNode.layout, x: Math.round(node.position.x), y: Math.round(node.position.y) } });
  };
  const handleNodeClick: NodeMouseHandler<ProcessFlowNode> = (_event, node) => onSelect(node.id);
  const handleEdgeClick: EdgeMouseHandler = (_event, edge) => { setSelectedEdgeId(edge.id); setConnections(true); };

  return (
    <section className={`process-editor ${showConnections ? "is-connections-open" : ""}`} aria-label="Process map editor">
      <div className="process-canvas-toolbar">
        <div className="process-canvas-actions">
          <button type="button" onClick={onAutoLayout}><RefreshCcw size={17} aria-hidden="true" /> Auto layout</button>
          <button type="button" onClick={fitProcessToView}><Maximize2 size={17} aria-hidden="true" /> Fit</button>
          <button ref={connectionsButtonRef} type="button" aria-controls="process-connections-panel" aria-pressed={showConnections} onClick={() => setConnections(!showConnections)}><GitBranch size={17} aria-hidden="true" /> Connections</button>
          <button
            className="process-split-preview-toggle"
            type="button"
            aria-label={previewVisible ? "Close in-context split preview" : "Open in-context split preview"}
            aria-pressed={previewVisible}
            title="Edit the process while observing the Student Player beside it."
            onClick={onTogglePreview}
          >
            <Eye size={17} aria-hidden="true" /> {previewVisible ? "Close preview" : "Split preview"}
          </button>
        </div>
        <button
          type="button"
          className={`process-readiness is-${readinessTone}`}
          aria-label={readinessLabel}
          title={readinessLabel}
          onClick={onReadinessClick}
        >
          <CheckCircle2 size={19} aria-hidden="true" /> {previewVisible ? compactReadinessLabel : readinessLabel}
        </button>
      </div>
      <div ref={canvasRef} className="diagram-canvas" aria-label="Editable process diagram">
        <ReactFlow
          colorMode="light" edges={flowEdges} fitView maxZoom={1.2} minZoom={0.45}
          nodes={flowNodes} nodesDraggable onEdgeClick={handleEdgeClick}
          onInit={(instance) => { flowRef.current = instance; fitProcessToView(); }}
          onNodeClick={handleNodeClick} onNodeDragStop={handleNodeDragStop}
          onNodesChange={(changes: NodeChange<ProcessFlowNode>[]) => setFlowNodes((nodes) => applyNodeChanges(changes, nodes))}
          onPaneClick={() => setSelectedEdgeId(null)} panOnDrag panOnScroll
          proOptions={{ hideAttribution: true }} zoomOnDoubleClick={false}
        >
          <Background gap={22} size={1} />
          <Controls showFitView={false} showInteractive={false} />
        </ReactFlow>
      </div>
      {showConnections ? (
        <aside id="process-connections-panel" className="flow-editor" aria-label="Process connections">
          <div className="flow-editor-heading">
            <div><h3>Connections</h3><span>{draft.process.edges.length} connections</span></div>
            <button type="button" aria-expanded={advancedConnections} onClick={() => setAdvancedConnections((current) => !current)}>Advanced fields</button>
            <button type="button" aria-label="Close connections" onClick={() => setConnections(false)}>×</button>
          </div>
          <div className="flow-editor-list">
            {draft.process.edges.map((edge, index) => (
              <section className="flow-row" key={`${edge.from}-${edge.to}-${index}`}>
                <span>After</span>
                <select aria-label={`Connection ${index + 1} source step`} value={edge.from} onChange={(event) => onUpdateEdge(index, { ...edge, from: event.target.value })}>{draft.process.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select>
                <span>go to</span>
                <select aria-label={`Connection ${index + 1} target step`} value={edge.to} onChange={(event) => onUpdateEdge(index, { ...edge, to: event.target.value })}>{draft.process.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select>
                {advancedConnections ? (
                  <div className="flow-advanced-fields">
                    <select aria-label="Connection condition" value={edge.condition.type} onChange={(event) => onUpdateEdge(index, { ...edge, condition: conditionForType(event.target.value as EdgeConditionType, edge.condition) })}>{edgeTypes.map((type) => <option key={type} value={type}>{conditionLabel(type)}</option>)}</select>
                    <input aria-label="Connection label" value={edge.label} onChange={(event) => onUpdateEdge(index, { ...edge, label: event.target.value })} />
                    {edge.condition.type === "calculationResult" ? <input aria-label="Calculation ID" value={edge.condition.calculationId ?? ""} onChange={(event) => onUpdateEdge(index, { ...edge, condition: { ...edge.condition, calculationId: event.target.value || undefined } })} /> : null}
                  </div>
                ) : null}
              </section>
            ))}
            {!draft.process.edges.length ? <p className="empty-state">Add a second step to create process connections.</p> : null}
          </div>
        </aside>
      ) : null}
    </section>
  );
};
