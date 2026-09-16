import type {
  ProcessDefinition,
  ProcessEdge,
  ProcessNode,
  ProcessNodeType,
} from "../../domain/types";
import type {
  PlatformProcessEdge,
  PlatformProcessGraph,
  PlatformProcessNodeType,
} from "../../platform/process/types";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer TItem)[]
    ? readonly DeepReadonly<TItem>[]
    : T extends object
      ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
      : T;

export interface ChemistryProcessNodeProjection {
  readonly platformNodeId: string;
  readonly chemistryNode: DeepReadonly<ProcessNode>;
}

export interface ChemistryProcessEdgeProjection {
  readonly platformEdgeId: string;
  readonly chemistryEdgeIndex: number;
  readonly chemistryEdge: DeepReadonly<ProcessEdge>;
}

export interface ChemistryProcessReadProjection {
  readonly graph: DeepReadonly<PlatformProcessGraph>;
  readonly source: DeepReadonly<ProcessDefinition>;
  readonly nodes: readonly ChemistryProcessNodeProjection[];
  readonly edges: readonly ChemistryProcessEdgeProjection[];
}

/**
 * Read-only port for Cycle 04's chemistry adapter. Implementations must preserve enough
 * source data for project -> restore to be structurally lossless and must not mutate the
 * supplied chemistry process or current public JSON. The platform graph is a structural
 * read projection, not an execution-admission result: chemistry runtime actions may use
 * an explicit next-node choice for a procedural repeat while retaining a validationPassed
 * source edge. That is not retry semantics, so strict platform validation may report
 * diagnostics such as process.cycle.requires-retry,
 * process.branch.insufficient-options, or process.node.unreachable; consumers must not
 * execute such a graph until a matching platform execution contract exists.
 */
export interface ChemistryProcessReadAdapter {
  readonly adapterId: "chemistry.process-read-adapter";
  readonly adapterVersion: string;
  project(source: DeepReadonly<ProcessDefinition>): ChemistryProcessReadProjection;
  restore(projection: DeepReadonly<ChemistryProcessReadProjection>): DeepReadonly<ProcessDefinition>;
}

const platformNodeType = (type: ProcessNodeType): PlatformProcessNodeType => {
  if (type === "technique" || type === "action") return "operation";
  return type;
};

const platformEdgeCondition = (
  edge: DeepReadonly<ProcessEdge>,
  edgeIndex: number,
  sourceNodeType: ProcessNodeType | undefined,
): PlatformProcessEdge["condition"] => {
  if (edge.condition.type === "retry") return { type: "retry" };
  if (sourceNodeType === "decision") {
    return { type: "branch", branchKey: `branch-${edgeIndex + 1}` };
  }
  if (edge.condition.type === "validationPassed") return { type: "completed" };
  if (edge.condition.type === "calculationResult") {
    return {
      type: "condition",
      conditionRef: `chemistry.calculation.${edge.condition.calculationId ?? `edge-${edgeIndex + 1}`}`,
      expected: "in-range",
    };
  }
  return { type: "always" };
};

export const chemistryProcessReadAdapter: ChemistryProcessReadAdapter = {
  adapterId: "chemistry.process-read-adapter",
  adapterVersion: "1.0.0",
  project(source) {
    const sourceSnapshot = structuredClone(source) as DeepReadonly<ProcessDefinition>;
    const sourceNodeTypes = new Map(sourceSnapshot.nodes.map((node) => [node.id, node.type]));
    const nodes: ChemistryProcessNodeProjection[] = sourceSnapshot.nodes.map((node) => ({
      platformNodeId: node.id,
      chemistryNode: structuredClone(node),
    }));
    const edges: ChemistryProcessEdgeProjection[] = sourceSnapshot.edges.map((edge, index) => ({
      platformEdgeId: `edge-${index + 1}`,
      chemistryEdgeIndex: index,
      chemistryEdge: structuredClone(edge),
    }));
    const graph: PlatformProcessGraph = {
      schema: "studio.process-graph",
      schemaVersion: "1.0",
      startNodeId: sourceSnapshot.startNodeId,
      nodes: sourceSnapshot.nodes.map((node) => ({
        id: node.id,
        type: platformNodeType(node.type),
        title: node.title,
        description: node.description,
        ...(node.actionId ? { operationRef: `chemistry.action.${node.actionId}` } : {}),
        evidenceRequirementRefs: node.validation.map((rule) => rule.id),
        hints: [...node.hints],
        ...(node.layout ? { layout: { ...node.layout } } : {}),
      })),
      edges: sourceSnapshot.edges.map((edge, index) => ({
        id: `edge-${index + 1}`,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        condition: platformEdgeCondition(edge, index, sourceNodeTypes.get(edge.from)),
      })),
    };

    return {
      graph,
      source: sourceSnapshot,
      nodes,
      edges,
    };
  },
  restore(projection) {
    return structuredClone(projection.source) as DeepReadonly<ProcessDefinition>;
  },
};
