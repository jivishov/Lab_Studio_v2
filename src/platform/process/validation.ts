import type { ContractDiagnostic, ContractValidationResult } from "../validation/jsonSchema";
import {
  getCompletionProcessNodes,
  getOutgoingProcessEdges,
  getReachableProcessNodeIds,
  topologicallySortProcessNodes,
} from "./graph";
import { validatePlatformProcessGraphSchema } from "./schema";
import type { PlatformProcessEdge, PlatformProcessGraph } from "./types";

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const pathExists = (
  graph: PlatformProcessGraph,
  start: string,
  target: string,
  includeRetry = false,
): boolean => {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    graph.edges.forEach((edge) => {
      if (edge.from === current && (includeRetry || edge.condition.type !== "retry")) pending.push(edge.to);
    });
  }
  return false;
};

const duplicateDiagnostics = (
  values: readonly { id: string }[],
  basePath: string,
  code: string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value.id)) return [error(code, `${basePath}/${index}/id`, `Duplicate id ${value.id}.`)];
    seen.add(value.id);
    return [];
  });
};

const branchDiagnostics = (graph: PlatformProcessGraph): ContractDiagnostic[] => graph.nodes.flatMap(
  (node, nodeIndex) => {
    const outgoing = getOutgoingProcessEdges(graph, node.id).filter((edge) => edge.condition.type !== "retry");
    if (node.type === "decision") {
      const diagnostics: ContractDiagnostic[] = [];
      if (outgoing.length < 2) diagnostics.push(error(
        "process.branch.insufficient-options",
        `/nodes/${nodeIndex}`,
        "Decision nodes require at least two non-retry branch edges.",
      ));
      const branchKeys = new Set<string>();
      outgoing.forEach((edge) => {
        const edgeIndex = graph.edges.indexOf(edge);
        if (edge.condition.type !== "branch") {
          diagnostics.push(error(
            "process.branch.condition-required",
            `/edges/${edgeIndex}/condition/type`,
            "Non-retry edges from a decision node must use branch conditions.",
          ));
          return;
        }
        if (branchKeys.has(edge.condition.branchKey)) diagnostics.push(error(
          "process.branch.key-duplicate",
          `/edges/${edgeIndex}/condition/branchKey`,
          `Duplicate branch key ${edge.condition.branchKey}.`,
        ));
        branchKeys.add(edge.condition.branchKey);
      });
      return diagnostics;
    }
    return outgoing.flatMap((edge) => edge.condition.type === "branch"
      ? [error(
          "process.branch.source-not-decision",
          `/edges/${graph.edges.indexOf(edge)}/condition/type`,
          "Branch edges must originate from decision nodes.",
        )]
      : []);
  },
);

const retryDiagnostics = (graph: PlatformProcessGraph): ContractDiagnostic[] => graph.edges.flatMap(
  (edge, edgeIndex) => {
    if (edge.condition.type !== "retry" || edge.from === edge.to) return [];
    return pathExists(graph, edge.to, edge.from)
      ? []
      : [error(
          "process.retry.not-back-edge",
          `/edges/${edgeIndex}`,
          "Retry edges must return to the same node or a non-retry ancestor.",
        )];
  },
);

const endpointDiagnostics = (
  edges: readonly PlatformProcessEdge[],
  nodeIds: ReadonlySet<string>,
): ContractDiagnostic[] => edges.flatMap((edge, index) => [
  ...(!nodeIds.has(edge.from)
    ? [error("process.edge.from-missing", `/edges/${index}/from`, `Node ${edge.from} is not declared.`)]
    : []),
  ...(!nodeIds.has(edge.to)
    ? [error("process.edge.to-missing", `/edges/${index}/to`, `Node ${edge.to} is not declared.`)]
    : []),
]);

export const validatePlatformProcessGraph = (
  input: unknown,
): ContractValidationResult<PlatformProcessGraph> => {
  const schemaResult = validatePlatformProcessGraphSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const graph = schemaResult.value;
  const nodeIds = new Set(graph.nodes.map(({ id }) => id));
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateDiagnostics(graph.nodes, "/nodes", "process.node.duplicate"),
    ...duplicateDiagnostics(graph.edges, "/edges", "process.edge.duplicate"),
    ...endpointDiagnostics(graph.edges, nodeIds),
  ];

  if (!nodeIds.has(graph.startNodeId)) diagnostics.push(error(
    "process.start-node.missing",
    "/startNodeId",
    `Start node ${graph.startNodeId} is not declared.`,
  ));
  graph.nodes.forEach((node, index) => {
    if (node.type === "operation" && !node.operationRef) diagnostics.push(error(
      "process.operation.reference-required",
      `/nodes/${index}/operationRef`,
      "Operation nodes require an operationRef.",
    ));
  });

  if (diagnostics.length === 0) {
    const reachable = getReachableProcessNodeIds(graph);
    graph.nodes.forEach((node, index) => {
      if (!reachable.has(node.id)) diagnostics.push(error(
        "process.node.unreachable",
        `/nodes/${index}/id`,
        `Node ${node.id} is unreachable from ${graph.startNodeId}.`,
      ));
    });
    diagnostics.push(...branchDiagnostics(graph), ...retryDiagnostics(graph));
    if (topologicallySortProcessNodes(graph).length !== graph.nodes.length) diagnostics.push(error(
      "process.cycle.requires-retry",
      "/edges",
      "Every process cycle must be expressed through an edge with condition.type = retry.",
    ));
    if (getCompletionProcessNodes(graph).length === 0) diagnostics.push(error(
      "process.completion.missing",
      "/nodes",
      "The process requires at least one completion node with no non-retry outgoing edge.",
    ));
  }

  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length === 0
    ? { ok: true, value: graph, diagnostics: [] }
    : { ok: false, diagnostics };
};
