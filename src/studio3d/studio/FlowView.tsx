import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  BaseEdge, EdgeLabelRenderer, Handle, MiniMap, Panel, Position, ReactFlow, ReactFlowProvider, getBezierPath, useReactFlow,
  type Connection, type Edge, type EdgeProps, type Node, type NodeProps, type OnNodeDrag, type Viewport,
} from "@xyflow/react";
import type { EdgeConditionType, ProcessNode } from "../../domain/types";
import { removeConnection } from "./draftEdits";
import { equipment3dAssetUrl, equipment3dEntry } from "../equipment3d/readiness";
import { Icon } from "../ui/Icon";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { CONDITION_GLYPH, CONDITION_LABEL, NODE_WIDTH, neighbourAlongEdges, nodeCards, type NodeCard } from "./flowModel";
import { LIBRARY_DRAG_TYPE, readLibraryDrag, type LibraryDrag } from "./libraryDrag";
import type { Studio3DController } from "./useStudio3DDraft";

/**
 * Stage: Flow view (handoff §4.4). React Flow draws the process; every change it makes is one
 * labelled Studio transaction (plan §4.6): dragging a node is `updateProcessNode`, connecting is
 * `addBranchEdge` or a retry, dropping a library step on an edge is `appendTemplateStep` with that
 * edge's anchor. Nothing is edited while the draft is read-only.
 */
const GRID = 24;
/**
 * Stored layouts are in the original Studio's units (its generated grid is 230 × 128 px, sized for
 * its smaller nodes). The Flow view draws them spread to fit 232 px cards and divides back on
 * commit, so a layout edited here reads the same in the original Studio.
 */
const FLOW_SCALE = Object.freeze({ x: 1.3, y: 1.7 });
const toView = (p: { x: number; y: number }) => ({ x: p.x * FLOW_SCALE.x, y: p.y * FLOW_SCALE.y });
const toStored = (p: { x: number; y: number }) => ({ x: p.x / FLOW_SCALE.x, y: p.y / FLOW_SCALE.y });

type CardNode = Node<{ card: NodeCard; compact: boolean; ringIn: boolean }, "card">;
type FrameNode = Node<{ label: string; width: number; height: number }, "frame">;
type FlowNode = CardNode | FrameNode;
type CondEdge = Edge<{ condition: EdgeConditionType; label: string; hot: boolean; insertText?: string; selfLoop: boolean }, "condition">;

const Thumb = ({ definitionId, size = 28 }: { definitionId: string; size?: number }) => {
  const entry = equipment3dEntry(definitionId);
  return (
    <span className="s3d-node__thumb" style={{ width: size, height: size }} title={definitionId}>
      {entry ? <img src={equipment3dAssetUrl(entry.thumbnail)} alt="" width={size - 2} height={size - 2} draggable={false} /> : <Icon name="cube" size={14} />}
    </span>
  );
};

const CardNodeView = ({ data, selected }: NodeProps<CardNode>) => {
  const { card, compact, ringIn } = data;
  const classes = ["s3d-node", `s3d-node--${card.type}`, selected ? "is-selected" : "", card.issues ? "has-issue" : ""].filter(Boolean).join(" ");
  const outs = card.type === "decision" ? card.outConditions : [];
  return (
    <div className={classes} style={{ width: NODE_WIDTH }}>
      {card.isStart ? <span className="s3d-node__start"><Icon name="flag" size={11} />START</span> : null}
      <Handle type="target" position={Position.Left} className={`s3d-handle${ringIn ? " is-ring" : ""}`} />
      <div className="s3d-node__head">
        <span className="s3d-node__icon"><Icon name={card.icon} size={14} /></span>
        <span className="s3d-eyebrow s3d-node__eyebrow">{card.eyebrow}</span>
        {card.issues ? <span className="s3d-chip s3d-chip--err" title={`${card.issues} issue${card.issues === 1 ? "" : "s"}`}><Icon name="warn" size={12} />{card.issues}</span> : null}
        {card.hasHint ? <span title="Has hint text" className="s3d-node__hint"><Icon name="info" size={14} /></span> : null}
      </div>
      <div className="s3d-node__title" title={card.title}>{card.title}</div>
      {!compact && card.equipment.length ? (
        <div className="s3d-node__eq">
          {card.equipment.slice(0, 3).map((id) => <Thumb key={id} definitionId={id} />)}
          {card.equipment.length > 3 ? <span className="s3d-small">+{card.equipment.length - 3}</span> : null}
        </div>
      ) : null}
      {outs.length ? (
        <div className="s3d-node__outs">
          {outs.map((condition, i) => (
            <div key={`${condition}-${i}`}>
              <span>{CONDITION_LABEL[condition]}</span>
              <Handle type="source" id={`out-${i}`} position={Position.Right} className="s3d-handle s3d-handle--out" style={{ top: "auto", right: -18 }} />
            </div>
          ))}
        </div>
      ) : null}
      {!compact ? (
        <div className="s3d-node__chips">
          {card.inputRole ? <ProvenanceChip kind={card.inputRole === "teacherConfiguration" ? "teacher" : "entry"} studio /> : null}
          {card.type === "observation" ? <span className="s3d-chip s3d-chip--neutral"><Icon name="book" size={12} />Notebook</span> : null}
          {card.type === "calculation" ? <span className="s3d-chip s3d-chip--neutral"><Icon name="equals" size={12} />Tolerance</span> : null}
          {card.validation.map((type) => <span key={type} className="s3d-chip s3d-chip--neutral s3d-mono">{type}</span>)}
          {card.evidence.length ? <span className="s3d-chip s3d-chip--outline" title={card.evidence.join(", ")}>Evidence · {card.evidence.length}</span> : null}
        </div>
      ) : null}
      {outs.length ? null : <Handle type="source" position={Position.Right} className="s3d-handle s3d-handle--out" />}
    </div>
  );
};

const FrameNodeView = ({ data }: NodeProps<FrameNode>) => (
  <div className="s3d-group-frame" style={{ width: data.width, height: data.height }} aria-hidden="true">
    <span>From: {data.label}</span>
  </div>
);

const ConditionEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<CondEdge>) => {
  const condition = data?.condition ?? "always";
  let path: string;
  let labelX: number;
  let labelY: number;
  if (data?.selfLoop) {
    // A retry to the same step loops under it (§4.4 "routed back").
    const drop = 70;
    path = `M${sourceX} ${sourceY} C${sourceX + 60} ${sourceY + drop}, ${targetX - 60} ${targetY + drop}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = sourceY + drop * 0.75;
  } else if (condition === "retry" && targetX < sourceX) {
    const drop = 90;
    path = `M${sourceX} ${sourceY} C${sourceX + 80} ${sourceY + drop}, ${targetX - 80} ${targetY + drop}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = Math.max(sourceY, targetY) + drop * 0.75;
  } else {
    [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }
  const glyph = CONDITION_GLYPH[condition];
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={`s3d-edge s3d-edge--${condition}${data?.hot ? " is-hot" : ""}${selected ? " is-selected" : ""}`} interactionWidth={18} />
      <EdgeLabelRenderer>
        <div className="s3d-edge-labels nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
          {data?.hot ? (
            <>
              <span className="s3d-insert-marker"><Icon name="plus" size={16} /></span>
              {data.insertText ? <span className="s3d-callout s3d-callout--insert">{data.insertText}</span> : null}
            </>
          ) : glyph || selected ? (
            <span className={`s3d-edge-pill${selected ? " is-open" : ""}`}>
              {glyph ? <Icon name={glyph} size={12} /> : null}
              <span className="s3d-edge-pill__text">{data?.label || CONDITION_LABEL[condition]}</span>
            </span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = { card: CardNodeView, frame: FrameNodeView };
const edgeTypes = { condition: ConditionEdge };

export interface FlowViewProps {
  studio: Studio3DController;
  onInspect: () => void;
  onAddFromLibrary: (item: LibraryDrag, anchor?: { anchorNodeId: string; placement: "after" }) => void;
  onToast: (text: string, action?: { label: string; run: () => void }) => void;
  onDraggingLibrary?: boolean;
  focusVersion: number;
}

const FlowCanvas = ({ studio, onInspect, onAddFromLibrary, onToast, focusVersion }: FlowViewProps) => {
  const { draft, readiness, selection, setSelection, readOnly, commit } = studio;
  const flow = useReactFlow<FlowNode, CondEdge>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"select" | "connect">("select");
  const [snap, setSnap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [compact, setCompact] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hotEdge, setHotEdge] = useState<number>();
  const [connectFrom, setConnectFrom] = useState<string>();
  const [connectMenu, setConnectMenu] = useState<{ from: string; to: string; x: number; y: number }>();
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  const cards = useMemo(() => nodeCards(draft, readiness.diagnostics), [draft, readiness.diagnostics]);
  const selectedNodeId = selection?.kind === "node" ? selection.id : undefined;
  const titleOf = useCallback((id: string) => draft.process.nodes.find((n) => n.id === id)?.title ?? id, [draft.process.nodes]);

  const nodes = useMemo<FlowNode[]>(() => {
    const cardNodes: CardNode[] = cards.map((card) => ({
      id: card.id,
      type: "card",
      position: dragPositions[card.id] ?? toView(card.position),
      data: { card, compact, ringIn: Boolean(connectFrom && connectFrom !== card.id) },
      selected: selectedNodeId === card.id,
      draggable: !readOnly,
      connectable: !readOnly,
      ariaLabel: `${card.eyebrow}: ${card.title}`,
    }));
    // Flattened experiment drafts (D8 a): faint, read-only frames around each source technique.
    const frames: FrameNode[] = [];
    const groups = new Map<string, NodeCard[]>();
    for (const card of cards) if (card.sourceTechniqueId) groups.set(card.sourceTechniqueId, [...(groups.get(card.sourceTechniqueId) ?? []), card]);
    for (const [techniqueId, members] of groups) {
      const xs = members.map((m) => (dragPositions[m.id] ?? toView(m.position)).x);
      const ys = members.map((m) => (dragPositions[m.id] ?? toView(m.position)).y);
      const x = Math.min(...xs) - 20;
      const y = Math.min(...ys) - 22;
      const technique = draft.techniques.find((t) => t.id === techniqueId);
      frames.push({
        id: `frame:${techniqueId}`, type: "frame", position: { x, y }, draggable: false, selectable: false, connectable: false, focusable: false, zIndex: -1,
        data: { label: technique?.title ?? techniqueId, width: Math.max(...xs) - x + NODE_WIDTH + 20, height: Math.max(...ys) - y + 170 },
      });
    }
    return [...frames, ...cardNodes];
  }, [cards, compact, connectFrom, dragPositions, draft.techniques, readOnly, selectedNodeId]);

  const edges = useMemo<CondEdge[]>(() => draft.process.edges.map((edge, index) => {
    const decisionOuts = draft.process.nodes.find((n) => n.id === edge.from)?.type === "decision"
      ? draft.process.edges.filter((e) => e.from === edge.from) : undefined;
    return {
      id: `edge-${index}`,
      source: edge.from,
      target: edge.to,
      ...(decisionOuts ? { sourceHandle: `out-${decisionOuts.indexOf(edge)}` } : {}),
      type: "condition",
      selected: selection?.kind === "edge" && selection.index === index,
      markerEnd: { type: "arrowclosed" as never, width: 16, height: 16 },
      data: {
        condition: edge.condition.type,
        label: edge.label,
        hot: hotEdge === index,
        selfLoop: edge.from === edge.to,
        ...(hotEdge === index ? { insertText: `Release to insert between “${titleOf(edge.from)}” and “${titleOf(edge.to)}”` } : {}),
      },
    };
  }), [draft.process.edges, draft.process.nodes, hotEdge, selection, titleOf]);

  const fit = useCallback(() => window.requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 200 })), [flow]);
  useEffect(() => { fit(); }, [draft.process.nodes.length, fit, focusVersion]);

  const frameSelection = () => {
    if (!selectedNodeId) { fit(); return; }
    flow.fitView({ nodes: [{ id: selectedNodeId }], padding: 1.2, duration: 200, maxZoom: 1.2 });
  };

  const setLayout = (node: ProcessNode, x: number, y: number, label: string) => {
    const index = draft.process.nodes.findIndex((n) => n.id === node.id);
    const current = cards[index]?.position ?? { x: 0, y: 0 };
    commit(label, [{ type: "updateProcessNode", node: { ...node, layout: { ...current, ...node.layout, x: Math.round(x), y: Math.round(y) } } }]);
  };

  const onNodeDragStop: OnNodeDrag<FlowNode> = (event, node) => {
    setDragPositions({});
    const processNode = draft.process.nodes.find((n) => n.id === node.id);
    if (!processNode || readOnly) return;
    // Alt bypasses grid snapping (§4.4).
    const snapIt = snap && !(event as unknown as MouseEvent).altKey;
    const x = snapIt ? Math.round(node.position.x / GRID) * GRID : node.position.x;
    const y = snapIt ? Math.round(node.position.y / GRID) * GRID : node.position.y;
    const stored = toStored({ x, y });
    setLayout(processNode, stored.x, stored.y, `Move ${processNode.title}`);
  };

  const connectionEnds = (from: string, to: string, x: number, y: number) => {
    if (readOnly) return;
    setConnectMenu({ from, to, x, y });
  };
  const onConnect = (connection: Connection) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const target = flow.getInternalNode(connection.target);
    const at = target ? flow.flowToScreenPosition({ x: target.internals.positionAbsolute.x, y: target.internals.positionAbsolute.y }) : { x: 0, y: 0 };
    connectionEnds(connection.source, connection.target, at.x - (rect?.left ?? 0), at.y - (rect?.top ?? 0) + 20);
  };
  const addBranch = (from: string, to: string) => {
    commit(`Add branch: ${titleOf(from)} → ${titleOf(to)}`, [{ type: "addBranchEdge", from, to }], { selection: { kind: "edge", index: draft.process.edges.length } });
    setConnectMenu(undefined);
    setConnectFrom(undefined);
  };
  const addRetry = (from: string, to: string) => {
    const index = draft.process.edges.length;
    const operations = from === to
      ? [{ type: "addRetryEdge" as const, nodeId: from }]
      : [{ type: "addBranchEdge" as const, from, to },
         { type: "updateProcessEdge" as const, index, edge: { from, to, label: "Retry", condition: { type: "retry" as const } } }];
    commit(from === to ? `Add retry on ${titleOf(from)}` : `Add retry: ${titleOf(from)} → ${titleOf(to)}`, operations, { selection: { kind: "edge", index } });
    setConnectMenu(undefined);
    setConnectFrom(undefined);
  };

  const onNodeClick = (event: React.MouseEvent, node: FlowNode) => {
    if (node.type !== "card") return;
    if ((mode === "connect" || connectFrom) && !readOnly) {
      const from = connectFrom ?? selectedNodeId;
      if (!from) { setConnectFrom(node.id); setSelection({ kind: "node", id: node.id }); return; }
      const rect = wrapRef.current?.getBoundingClientRect();
      connectionEnds(from, node.id, event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0));
      return;
    }
    setSelection({ kind: "node", id: node.id });
  };

  const removeSelected = () => {
    if (readOnly || !selectedNodeId) return;
    const title = titleOf(selectedNodeId);
    const result = commit(`Delete ${title}`, [{ type: "removeProcessNode", nodeId: selectedNodeId }], { selection: undefined });
    if (result.ok) onToast(`Deleted ${title}.`, { label: "Undo", run: studio.undo });
  };
  const removeEdge = (index: number) => {
    if (readOnly) return;
    if (removeConnection(studio, index)) onToast("Connection deleted.", { label: "Undo", run: studio.undo });
  };

  // Keyboard map (§4.9): only while the canvas has focus (WCAG 2.1.4).
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("input, textarea, select")) return;
    const key = event.key;
    if (key === "Escape") { setConnectFrom(undefined); setConnectMenu(undefined); setHotEdge(undefined); return; }
    if (key === "Home") { event.preventDefault(); fit(); return; }
    if (key === "f" || key === "F") { event.preventDefault(); frameSelection(); return; }
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      if (selection?.kind === "edge") removeEdge(selection.index);
      else removeSelected();
      return;
    }
    if (!selectedNodeId) {
      if (key.startsWith("Arrow") && draft.process.startNodeId) { setSelection({ kind: "node", id: draft.process.startNodeId }); event.preventDefault(); }
      return;
    }
    if (key === "Enter") { event.preventDefault(); onInspect(); return; }
    if ((key === "c" || key === "C") && !readOnly) { setConnectFrom(selectedNodeId); onToast("Choose the step to connect to, or press Esc."); return; }
    if (key.startsWith("Arrow")) {
      event.preventDefault();
      if (event.shiftKey && !readOnly) {
        const node = draft.process.nodes.find((n) => n.id === selectedNodeId)!;
        const at = cards.find((c) => c.id === selectedNodeId)!.position;
        // 8 px on screen (1 px with Alt), in stored units.
        const step = event.altKey ? 1 : 8;
        const dx = (key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0) / FLOW_SCALE.x;
        const dy = (key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0) / FLOW_SCALE.y;
        setLayout(node, at.x + dx, at.y + dy, `Nudge ${node.title}`);
        return;
      }
      const next = neighbourAlongEdges(draft, selectedNodeId, key);
      if (next) setSelection({ kind: "node", id: next });
    }
  };

  // Library drops (§4.4 magnetic editing): over an edge, insert there; elsewhere, after the selection.
  const edgeUnder = (clientX: number, clientY: number): number | undefined => {
    const element = document.elementFromPoint(clientX, clientY)?.closest(".react-flow__edge");
    const id = element?.getAttribute("data-id") ?? element?.getAttribute("data-testid")?.replace("rf__edge-", "");
    const index = id?.startsWith("edge-") ? Number(id.slice(5)) : undefined;
    return index !== undefined && Number.isInteger(index) ? index : undefined;
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (readOnly || !event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setHotEdge(event.dataTransfer.types.includes(`${LIBRARY_DRAG_TYPE}+step`) ? edgeUnder(event.clientX, event.clientY) : undefined);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const item = readLibraryDrag(event.dataTransfer);
    const edgeIndex = hotEdge;
    setHotEdge(undefined);
    if (!item || readOnly) return;
    event.preventDefault();
    const edge = edgeIndex !== undefined ? draft.process.edges[edgeIndex] : undefined;
    if (edge && item.kind === "template") onAddFromLibrary(item, { anchorNodeId: edge.from, placement: "after" });
    else onAddFromLibrary(item);
  };

  const onMove = (_: unknown, viewport: Viewport) => setZoom(viewport.zoom);

  return (
    <div className="s3d-flowview" ref={wrapRef} onKeyDown={onKeyDown} onDragOver={onDragOver} onDragLeave={() => setHotEdge(undefined)} onDrop={onDrop}
      tabIndex={0} role="application" aria-roledescription="process flow" aria-label="Process flow. Arrow keys move along the connections; Enter opens the step.">
      <ReactFlow<FlowNode, CondEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes) => {
          const moved: Record<string, { x: number; y: number }> = {};
          for (const change of changes) if (change.type === "position" && change.position) moved[change.id] = change.position;
          if (Object.keys(moved).length) setDragPositions((current) => ({ ...current, ...moved }));
        }}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={(_, edge) => setSelection({ kind: "edge", index: Number(edge.id.slice(5)) })}
        onPaneClick={() => { setSelection(undefined); setConnectFrom(undefined); setConnectMenu(undefined); }}
        onConnect={onConnect}
        onMove={onMove}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        connectOnClick={false}
        elementsSelectable
        snapToGrid={false}
        minZoom={0.3}
        maxZoom={1.6}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        panOnDrag
        panActivationKeyCode="Space"
        proOptions={{ hideAttribution: true }}
        fitView
      >
        {minimap ? <MiniMap className="s3d-minimap" pannable zoomable nodeColor={(n) => (n.type === "frame" ? "transparent" : n.selected ? "#2a5a49" : "#cad5c7")} nodeStrokeWidth={0} maskColor="#f7f8f499" /> : null}
        <Panel position="bottom-center" className="s3d-tbar-panel">
          <div className="s3d-tbar" role="toolbar" aria-label="Flow tools">
            <button type="button" className={mode === "select" ? "is-on" : ""} aria-pressed={mode === "select"} onClick={() => { setMode("select"); setConnectFrom(undefined); }}><Icon name="cursor" />Select</button>
            <button type="button" className={mode === "connect" ? "is-on" : ""} aria-pressed={mode === "connect"} disabled={Boolean(readOnly)} onClick={() => setMode("connect")}><Icon name="link" />Connect</button>
            <i />
            <button type="button" className={snap ? "is-on" : ""} aria-pressed={snap} onClick={() => setSnap((v) => !v)}><Icon name="grid" />Snap to grid</button>
            <button type="button" disabled={Boolean(readOnly)} onClick={() => { commit("Auto-layout", [{ type: "autoLayoutProcess" }]); fit(); }}><Icon name="layout" />Auto-layout</button>
            <button type="button" className={minimap ? "is-on" : ""} aria-pressed={minimap} onClick={() => setMinimap((v) => !v)}><Icon name="map" />Minimap</button>
            <button type="button" className={compact ? "" : "is-on"} aria-pressed={!compact} onClick={() => setCompact((v) => !v)} title={compact ? "Show full details" : "Show compact cards"}><Icon name="details" />Details</button>
            <i />
            <button type="button" aria-label="Zoom out" onClick={() => flow.zoomOut({ duration: 150 })}><Icon name="minus" /></button>
            <button type="button" className="s3d-mono" aria-label="Zoom to 100%" onClick={() => flow.zoomTo(1, { duration: 150 })}>{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="Zoom in" onClick={() => flow.zoomIn({ duration: 150 })}><Icon name="plus" /></button>
            <i />
            <button type="button" onClick={fit}><Icon name="fit" />Fit</button>
          </div>
        </Panel>
      </ReactFlow>
      {connectMenu ? (
        <div className="s3d-popmenu s3d-connect-menu" role="menu" style={{ left: connectMenu.x, top: connectMenu.y }} aria-label="Connection type">
          <button type="button" role="menuitem" onClick={() => addBranch(connectMenu.from, connectMenu.to)}><Icon name="split" />Branch</button>
          <button type="button" role="menuitem" onClick={() => addRetry(connectMenu.from, connectMenu.to)}><Icon name="retry" />Retry</button>
        </div>
      ) : null}
      {connectFrom && !connectMenu ? <div className="s3d-callout s3d-callout--status">Connecting from “{titleOf(connectFrom)}”. Choose a step, or press Esc.</div> : null}
    </div>
  );
};

export const FlowView = (props: FlowViewProps) => (
  <ReactFlowProvider>
    <FlowCanvas {...props} />
  </ReactFlowProvider>
);
