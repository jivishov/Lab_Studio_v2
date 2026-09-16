import type {
  PlatformProcessEdge,
  PlatformProcessGraph,
  PlatformProcessNode,
} from "./types";

export const getOutgoingProcessEdges = (
  graph: PlatformProcessGraph,
  nodeId: string,
): PlatformProcessEdge[] => graph.edges.filter((edge) => edge.from === nodeId);

export const getReachableProcessNodeIds = (
  graph: PlatformProcessGraph,
  startNodeId = graph.startNodeId,
): Set<string> => {
  const reachable = new Set<string>();
  const pending = [startNodeId];
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    getOutgoingProcessEdges(graph, nodeId).forEach((edge) => {
      if (!reachable.has(edge.to)) pending.push(edge.to);
    });
  }
  return reachable;
};

export const getCompletionProcessNodes = (
  graph: PlatformProcessGraph,
): PlatformProcessNode[] => graph.nodes.filter((node) =>
  !graph.edges.some((edge) => edge.from === node.id && edge.condition.type !== "retry"));

export const getProcessBranchTargets = (
  graph: PlatformProcessGraph,
  decisionNodeId: string,
): ReadonlyMap<string, string> => new Map(
  graph.edges
    .filter((edge) => edge.from === decisionNodeId && edge.condition.type === "branch")
    .map((edge) => [
      edge.condition.type === "branch" ? edge.condition.branchKey : "",
      edge.to,
    ]),
);

export const topologicallySortProcessNodes = (
  graph: PlatformProcessGraph,
): PlatformProcessNode[] => {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  graph.edges.filter((edge) => edge.condition.type !== "retry").forEach((edge) => {
    if (indegree.has(edge.to) && indegree.has(edge.from)) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }
  });
  const pending = graph.nodes.filter((node) => indegree.get(node.id) === 0).map(({ id }) => id).sort();
  const result: PlatformProcessNode[] = [];
  while (pending.length > 0) {
    const nodeId = pending.shift()!;
    const node = nodeById.get(nodeId);
    if (node) result.push(node);
    graph.edges
      .filter((edge) => edge.from === nodeId && edge.condition.type !== "retry")
      .sort((left, right) => left.to.localeCompare(right.to) || left.id.localeCompare(right.id))
      .forEach((edge) => {
        if (!indegree.has(edge.to)) return;
        const next = (indegree.get(edge.to) ?? 0) - 1;
        indegree.set(edge.to, next);
        if (next === 0) {
          pending.push(edge.to);
          pending.sort();
        }
      });
  }
  return result;
};
