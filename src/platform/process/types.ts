export const platformProcessGraphSchemaId = "studio.process-graph" as const;
export const platformProcessGraphSchemaVersion = "1.0" as const;

export type PlatformProcessNodeType =
  | "operation"
  | "checkpoint"
  | "decision"
  | "calculation"
  | "observation"
  | "reflection"
  | "teacherNote";

export interface PlatformProcessNode {
  id: string;
  type: PlatformProcessNodeType;
  title: string;
  description: string;
  operationRef?: string;
  evidenceRequirementRefs: string[];
  hints: string[];
  layout?: {
    x: number;
    y: number;
    lane?: string;
    display?: "compact" | "expanded";
  };
}

export type PlatformProcessEdgeCondition =
  | { type: "always" }
  | { type: "completed" }
  | { type: "condition"; conditionRef: string; expected?: string | boolean }
  | { type: "branch"; branchKey: string }
  | { type: "retry"; maxAttempts?: number };

export interface PlatformProcessEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  condition: PlatformProcessEdgeCondition;
}

export interface PlatformProcessGraph {
  schema: typeof platformProcessGraphSchemaId;
  schemaVersion: typeof platformProcessGraphSchemaVersion;
  startNodeId: string;
  nodes: PlatformProcessNode[];
  edges: PlatformProcessEdge[];
}
